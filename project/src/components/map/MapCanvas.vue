<script setup lang="ts">
/**
 * 地图总装（编辑器中央画布）：
 * 短按空白不落点；长按 600ms + 墨点涟漪落自定义点（D23 / D82）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DailyWeather, Leg, LngLat, POI, TransportSegment, Trip } from '../../types'
import type { MapBounds } from '../../lib/projection'
import { expandBounds, fitBounds, project, unproject } from '../../lib/projection'
import { useLongPress } from '../../composables/useLongPress'
import { useUiStore } from '../../stores/ui'
import { useCityStore } from '../../stores/city'
import InkFallbackMap from './InkFallbackMap.vue'
import TencentBaseMap from './TencentBaseMap.vue'
import RouteLayer from './RouteLayer.vue'
import LegLayer from './LegLayer.vue'
import InkMarker from './InkMarker.vue'
import WeatherBadge from './WeatherBadge.vue'
import AnnotateLayer from './AnnotateLayer.vue'
import LayerSeals from '../layout/LayerSeals.vue'

type Pt = { x: number; y: number }

const props = withDefaults(defineProps<{
  trip: Trip
  dayIndex: number
  viewMode: 'day' | 'all'
  layers: { food: boolean; hotel: boolean; sight: boolean }
  annotateMode: boolean
  selectedPoiId?: string | null
  weather?: DailyWeather
  city?: string
  mapKey?: string
  baseMap?: 'ink' | 'paper' | 'standard'
}>(), {
  selectedPoiId: null,
  weather: undefined,
  city: '',
  mapKey: '',
  baseMap: 'paper',
})

const emit = defineEmits<{
  (e: 'select-poi', id: string): void
  (e: 'pick-poi', poi: POI): void
  (e: 'select-segment', id: string): void
  (e: 'select-leg', id: string): void
  (e: 'map-click', location: LngLat): void
  (e: 'base-poi', info: { name: string; location: LngLat }): void
  (e: 'add-stroke', points: LngLat[]): void
}>()

const rootEl = ref<HTMLDivElement | null>(null)
const size = ref({ w: 1000, h: 720 })
const k = ref(1.4)
let ro: ResizeObserver | null = null
function measure() {
  const el = rootEl.value
  if (!el) return
  const w = el.clientWidth || 1
  const h = el.clientHeight || 1
  size.value = { w: 1000, h: (1000 * h) / w }
  k.value = 1000 / w
}

const day = computed(() => props.trip.days.find(d => d.dayIndex === props.dayIndex) || props.trip.days[0])

const dayPois = computed<POI[]>(() => {
  if (props.viewMode === 'day') {
    return (day.value?.poiIds || []).map(id => props.trip.pois[id]).filter((p): p is POI => !!p)
  }
  return Object.values(props.trip.pois)
})

const visiblePois = computed<POI[]>(() => dayPois.value.filter(p => {
  if (p.category === 'food') return props.layers.food
  if (p.category === 'hotel') return props.layers.hotel
  if (p.category === 'sight') return props.layers.sight
  return true
}))

const cityStore = useCityStore()
const recs = ref<POI[]>([])
async function loadRecs() {
  if (!props.city) { recs.value = []; return }
  const cats = ['sight', 'food', 'hotel'] as const
  const packs = await Promise.all(cats.map(c => cityStore.hotPois(props.city, c, props.mapKey)))
  recs.value = packs.flatMap(p => p.list)
}
watch(() => [props.city, props.mapKey], () => { void loadRecs() }, { immediate: true })

const visibleRecs = computed<POI[]>(() => {
  // 点选只开详情，不从推荐层拿掉；入了某一日才换成行程实心印
  const taken = new Set(props.trip.days.flatMap(d => d.poiIds))
  return recs.value.filter(p => {
    if (taken.has(p.id)) return false
    if (p.category === 'food') return props.layers.food
    if (p.category === 'hotel') return props.layers.hotel
    if (p.category === 'sight') return props.layers.sight
    return true
  }).slice(0, 28)
})

const visibleSegments = computed<TransportSegment[]>(() => {
  const ids = props.viewMode === 'day' ? (day.value?.segmentIds || []) : Object.keys(props.trip.segments)
  return ids.map(id => props.trip.segments[id]).filter((s): s is TransportSegment => !!s)
})

// L04：城际段——当日只看本日的，全览看全部；两端城市中心用于连线
const visibleLegs = computed<Leg[]>(() => {
  const all = Object.values(props.trip.legs)
  if (props.viewMode === 'all') return all
  const ids = new Set(day.value?.legIds || [])
  return all.filter(l => ids.has(l.id))
})
function cityCenter(name: string): LngLat | undefined {
  return props.trip.cities.find(c => c.name === name)?.center
}

const fitted = computed(() => {
  const pts: LngLat[] = visiblePois.value.map(p => p.location)
  for (const seg of visibleSegments.value) {
    if (seg.path?.length) pts.push(...seg.path)
  }
  // L04：全览模式把城际两端城市纳入视野，才能看到跨城连线；当日模式不纳入，避免市内行程被挤成一点
  if (props.viewMode === 'all') {
    for (const leg of visibleLegs.value) {
      const a = cityCenter(leg.fromCity), b = cityCenter(leg.toCity)
      if (a) pts.push(a)
      if (b) pts.push(b)
    }
  }
  const origin = pts[0] || props.trip.cities[0]?.center
  if (origin) {
    for (const p of visibleRecs.value) {
      if (Math.abs(p.location.lng - origin.lng) < 0.09 && Math.abs(p.location.lat - origin.lat) < 0.09) {
        pts.push(p.location)
      }
    }
  }
  if (!pts.length) {
    const c = props.trip.cities[0]?.center || { lng: 104, lat: 30 }
    pts.push(c)
  }
  return fitBounds(pts, size.value.w, size.value.h)
})

/** 用户缩放 / 平移：叠在自适应视野上，滚轮、捏合、按钮共用 */
const camScale = ref(1)
const camCenter = ref<LngLat | null>(null)
const bounds = computed(() => {
  const b = fitted.value
  const s = camScale.value
  const spanX = b.spanX / s
  const spanY = b.spanY / s
  const cx = camCenter.value?.lng ?? (b.minLng + b.maxLng) / 2
  const cy = camCenter.value?.lat ?? (b.minLat + b.maxLat) / 2
  return {
    minLng: cx - spanX / b.cos / 2,
    maxLng: cx + spanX / b.cos / 2,
    minLat: cy - spanY / 2,
    maxLat: cy + spanY / 2,
    cos: b.cos,
    spanX,
    spanY,
  }
})

watch(() => [props.dayIndex, props.viewMode, props.city], () => {
  stopFocusAnim()
  camScale.value = 1
  camCenter.value = null
  focusedPoiId.value = null
  glView.value = null
  // 真实底图：切天/切城后重投影到新视野（原生模式下 bounds watch 不再自动同步）
  if (nativeDrag.value) baseMapRef.value?.refit()
})

const glView = ref<MapBounds | null>(null)
const stageEl = ref<HTMLDivElement | null>(null)

/** 底图比视口大一圈，CSS 拖拽/缩小先吃缓冲瓦片，再提交经纬度 */
const VIEW_PAD = 0.3
const VIEW_FACTOR = 1 + VIEW_PAD * 2
const LIVE_SCALE_MIN = 1 / VIEW_FACTOR + 0.04
const worldBounds = computed(() => expandBounds(bounds.value, VIEW_FACTOR))
const stageSize = computed(() => ({ w: size.value.w * VIEW_FACTOR, h: size.value.h * VIEW_FACTOR }))
const worldStyle = {
  width: `${VIEW_FACTOR * 100}%`,
  height: `${VIEW_FACTOR * 100}%`,
  left: `${-VIEW_PAD * 100}%`,
  top: `${-VIEW_PAD * 100}%`,
}

/** 拖拽/滚轮只改 CSS transform，松手再写入经纬度，避免每帧重投影卡顿 */
let liveTx = 0
let liveTy = 0
let liveS = 1
let commitTimer = 0
let liveRaf = 0
const isLivePan = ref(false)
let liveInteracting = false
let panStart: { x: number; y: number; tx: number; ty: number } | null = null
let panned = false
const pointers = new Map<number, { x: number; y: number }>()
let pinch0 = 0
let pinchLive0 = 1
let pinchTx0 = 0
let pinchTy0 = 0
let pinchMid = { x: 0, y: 0 }

function applyLive() {
  const el = stageEl.value
  if (!el) return
  el.style.transform = `translate3d(${liveTx}px, ${liveTy}px, 0) scale(${liveS})`
}

/** 高频 pointermove 合并到一帧一次，避免把主线程压在样式写入上 */
function applyLiveSoon() {
  if (liveRaf) return
  liveRaf = window.requestAnimationFrame(() => {
    liveRaf = 0
    applyLive()
  })
}

function clampLiveScale(next: number) {
  const total = camScale.value * next
  if (total > 8) return 8 / camScale.value
  if (total < 0.7) return 0.7 / camScale.value
  if (next < LIVE_SCALE_MIN) return LIVE_SCALE_MIN
  return next
}

/** origin 在视口中心：cursor 处缩放时平移补偿 */
function zoomToward(cx: number, cy: number, next: number, w: number, h: number) {
  const ratio = next / liveS
  liveTx = (cx - w / 2) * (1 - ratio) + liveTx * ratio
  liveTy = (cy - h / 2) * (1 - ratio) + liveTy * ratio
  liveS = next
}

function commitLive() {
  window.clearTimeout(commitTimer)
  if (liveRaf) { window.cancelAnimationFrame(liveRaf); liveRaf = 0 }
  if (liveTx === 0 && liveTy === 0 && Math.abs(liveS - 1) < 1e-4) return
  const el = rootEl.value
  if (!el) return
  const w = el.clientWidth || 1
  const h = el.clientHeight || 1
  const srcX = w / 2 - liveTx / liveS
  const srcY = h / 2 - liveTy / liveS
  const loc = unproject(srcX * k.value, srcY * k.value, bounds.value, size.value.w, size.value.h)
  const nextScale = Math.min(8, Math.max(0.7, camScale.value * liveS))
  liveTx = 0
  liveTy = 0
  liveS = 1
  applyLive()
  camScale.value = nextScale
  camCenter.value = loc
}

function scheduleCommit(ms = 90) {
  window.clearTimeout(commitTimer)
  commitTimer = window.setTimeout(commitLive, ms)
}

const baseMapRef = ref<InstanceType<typeof TencentBaseMap> | null>(null)

function zoomBy(factor: number) {
  if (nativeDrag.value && baseMapRef.value) {
    baseMapRef.value.zoomBy(factor)
    return
  }
  const el = rootEl.value
  if (!el) return
  const next = clampLiveScale(liveS * factor)
  if (Math.abs(next - liveS) < 1e-4) return
  zoomToward(el.clientWidth / 2, el.clientHeight / 2, next, el.clientWidth, el.clientHeight)
  applyLive()
  commitLive()
}
function resetCam() {
  stopFocusAnim()
  if (liveRaf) { window.cancelAnimationFrame(liveRaf); liveRaf = 0 }
  liveTx = 0
  liveTy = 0
  liveS = 1
  applyLive()
  camScale.value = 1
  camCenter.value = null
  focusedPoiId.value = null
  focusRing.value = 0
  if (nativeDrag.value && baseMapRef.value) baseMapRef.value.refit()
}

/** 日程/时间轴点地点 → 地图平滑移到该处并放大；供父组件通过 ref 调用 */
const focusedPoiId = ref<string | null>(null)
const focusRing = ref(0)
let focusAnim = 0
function stopFocusAnim() {
  if (focusAnim) { window.cancelAnimationFrame(focusAnim); focusAnim = 0 }
}
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
function focusOn(location: LngLat, poiId: string | null = null, targetScale = 2.6, ms = 620) {
  stopFocusAnim()
  clearTimeout(commitTimer)
  if (liveRaf) { window.cancelAnimationFrame(liveRaf); liveRaf = 0 }
  liveTx = 0; liveTy = 0; liveS = 1
  applyLive()
  focusedPoiId.value = poiId
  focusRing.value = Date.now()
  if (nativeDrag.value && baseMapRef.value) {
    // 真实底图：直接驱动 GL 中心+缩放，逐帧回传视野让印章跟随
    baseMapRef.value.focusOn(location, Math.log2(Math.max(1, targetScale)), ms)
    const ringAt = focusRing.value
    window.setTimeout(() => { if (focusRing.value === ringAt) focusRing.value = 0 }, 1200)
    return
  }
  const fromC = camCenter.value || { lng: (fitted.value.minLng + fitted.value.maxLng) / 2, lat: (fitted.value.minLat + fitted.value.maxLat) / 2 }
  const fromS = camScale.value
  const toC = location
  const toS = Math.max(1, Math.min(8, targetScale))
  const start = performance.now()
  const step = (now: number) => {
    const p = easeInOut(Math.min(1, (now - start) / ms))
    camCenter.value = { lng: fromC.lng + (toC.lng - fromC.lng) * p, lat: fromC.lat + (toC.lat - fromC.lat) * p }
    camScale.value = fromS + (toS - fromS) * p
    if (p < 1) focusAnim = window.requestAnimationFrame(step)
    else {
      focusAnim = 0
      const ringAt = focusRing.value
      window.setTimeout(() => { if (focusRing.value === ringAt) focusRing.value = 0 }, 1200)
    }
  }
  focusAnim = window.requestAnimationFrame(step)
}
function focusPoi(poi: POI) { focusOn(poi.location, poi.id) }

/** 真实底图且已就绪时，拖拽/缩放完全交还腾讯 GL；水墨底图仍走 CSS transform 模拟 */
const nativeDrag = computed(() => useRealBase.value && glReady.value && !props.annotateMode)

function onWheel(e: WheelEvent) {
  if (nativeDrag.value) return // GL 自己处理滚轮，preventDefault 会掐掉原生缩放
  e.preventDefault()
  stopFocusAnim()
  const el = rootEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const factor = e.deltaY > 0 ? 0.9 : 1.11
  const next = clampLiveScale(liveS * factor)
  if (Math.abs(next - liveS) < 1e-4) return
  zoomToward(cx, cy, next, el.clientWidth, el.clientHeight)
  applyLiveSoon()
  scheduleCommit(e.deltaY > 0 ? 50 : 90)
}

function onMapPointerDown(e: PointerEvent) {
  const interactive = (e.target as Element | null)?.closest?.('[data-map-interactive]')
  if (interactive) {
    panned = false
    panStart = null
    return
  }
  // 真实底图：绝不 setPointerCapture——它会把 click 从底图 canvas 劫到根节点，
  // 导致酒店/学校等原生 POI 点不动；拖拽交给 GL 原生处理。
  if (nativeDrag.value) return
  stopFocusAnim()
  longPress.onPointerDown(e)
  if (props.annotateMode) return
  window.clearTimeout(commitTimer)
  liveInteracting = true
  isLivePan.value = true
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  panned = false
  try { rootEl.value?.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinch0 = Math.hypot(a.x - b.x, a.y - b.y) || 1
    pinchLive0 = liveS
    pinchTx0 = liveTx
    pinchTy0 = liveTy
    const rect = rootEl.value!.getBoundingClientRect()
    pinchMid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }
    panStart = null
    return
  }
  panStart = { x: e.clientX, y: e.clientY, tx: liveTx, ty: liveTy }
}

function onMapPointerMove(e: PointerEvent) {
  if (nativeDrag.value) return
  longPress.onPointerMove(e)
  if (props.annotateMode) return
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) {
    const el = rootEl.value
    if (!el) return
    const [a, b] = [...pointers.values()]
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
    liveS = pinchLive0
    liveTx = pinchTx0
    liveTy = pinchTy0
    const next = clampLiveScale(pinchLive0 * (dist / pinch0))
    zoomToward(pinchMid.x, pinchMid.y, next, el.clientWidth, el.clientHeight)
    applyLiveSoon()
    panned = true
    return
  }
  if (!panStart) return
  const dx = e.clientX - panStart.x
  const dy = e.clientY - panStart.y
  if (!panned && Math.hypot(dx, dy) < 8) return
  panned = true
  liveTx = panStart.tx + dx
  liveTy = panStart.ty + dy
  applyLiveSoon()
}

function onMapPointerUp(e: PointerEvent) {
  if (nativeDrag.value) return
  longPress.onPointerUp()
  pointers.delete(e.pointerId)
  panStart = null
  if (pointers.size < 2) pinch0 = 0
  try { rootEl.value?.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  if (panned) commitLive()
  if (pointers.size === 0) {
    liveInteracting = false
    isLivePan.value = false
  }
}

onMounted(() => {
  measure()
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    ro.observe(rootEl.value)
  } else {
    window.addEventListener('resize', measure)
  }
  rootEl.value?.addEventListener('wheel', onWheel, { passive: false })
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', measure)
  rootEl.value?.removeEventListener('wheel', onWheel)
  window.clearTimeout(commitTimer)
  if (liveRaf) window.cancelAnimationFrame(liveRaf)
  stopFocusAnim()
})

const glFailed = ref(false)
const glReady = ref(false)
const overlayBounds = computed(() => (glReady.value && glView.value) ? glView.value : worldBounds.value)
const useRealBase = computed(() => !!props.mapKey && !glFailed.value)
const standardBase = computed(() => props.baseMap === 'standard')

const ui = useUiStore()
let glFailToasted = false
function onGlFail() {
  glFailed.value = true
  glReady.value = false
  if (!glFailToasted) {
    glFailToasted = true
    ui.toast('真实底图未就绪，已回落水墨舆图（可在设置切换）')
  }
}

/** Key / 底图档切换时重置，允许重新尝试真实底图 */
watch(() => [props.mapKey, props.baseMap], () => {
  glFailed.value = false
  glReady.value = false
})

const weatherOpen = ref(false)
const annotateRef = ref<InstanceType<typeof AnnotateLayer> | null>(null)
const ripple = ref<{ x: number; y: number; key: number } | null>(null)

function locationFromEvent(e: PointerEvent | MouseEvent): LngLat | null {
  const el = rootEl.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const w = el.clientWidth || 1
  const h = el.clientHeight || 1
  const sx = e.clientX - rect.left
  const sy = e.clientY - rect.top
  const vx = w / 2 + (sx - w / 2 - liveTx) / liveS
  const vy = h / 2 + (sy - h / 2 - liveTy) / liveS
  const x = vx * k.value + VIEW_PAD * size.value.w
  const y = vy * k.value + VIEW_PAD * size.value.h
  return unproject(x, y, overlayBounds.value, stageSize.value.w, stageSize.value.h)
}

function showRipple(e: PointerEvent) {
  const el = rootEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  ripple.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    key: Date.now(),
  }
  window.setTimeout(() => { ripple.value = null }, 700)
}

const longPress = useLongPress((e) => {
  if (props.annotateMode) return
  const target = e.target as Element | null
  if (target?.closest?.('[data-map-interactive]')) return
  showRipple(e)
  const loc = locationFromEvent(e)
  if (loc) emit('map-click', loc)
}, { ms: 600 })

function onClick(e: MouseEvent) {
  if (props.annotateMode) return
  if (longPress.didFire()) return
  if (panned) { panned = false; return }
  // 短按空白：仅收起天气条，不落点（防误触）
  const target = e.target as Element | null
  if (target?.closest?.('[data-map-interactive]')) return
  weatherOpen.value = false
}

/** 朱笔地理真值（D98）：屏幕笔画 → 经纬度点列；视野变化时按投影重绘，笔迹跟随地图 */
const geoStrokes = ref<LngLat[][]>([])

function strokeToScreen(locs: LngLat[]): Pt[] {
  return locs.map(p => {
    const s = project(p, overlayBounds.value, stageSize.value.w, stageSize.value.h)
    return { x: s.x / k.value, y: s.y / k.value }
  })
}

function onStroke(points: Pt[]) {
  const locs = points.map(p => unproject(p.x * k.value, p.y * k.value, overlayBounds.value, stageSize.value.w, stageSize.value.h))
  geoStrokes.value.push(locs)
  emit('add-stroke', locs)
}

watch(overlayBounds, () => {
  const list = geoStrokes.value.map(strokeToScreen).filter(p => p.length >= 2)
  if (list.length) annotateRef.value?.redraw(list)
})

/** 持久化批注载入：只存地理点列，按当前视野投影还原 */
function loadPersisted(strokes: { points?: LngLat[] }[]) {
  geoStrokes.value = strokes
    .map(s => (s.points || []).filter(p => Number.isFinite(p?.lng) && Number.isFinite(p?.lat)))
    .filter(p => p.length >= 2)
  const list = geoStrokes.value.map(strokeToScreen)
  if (list.length) annotateRef.value?.redraw(list)
}

function selectPoi(id: string) {
  if (panned) { panned = false; return }
  emit('select-poi', id)
}
function pickRec(id: string) {
  if (panned) { panned = false; return }
  const poi = recs.value.find(p => p.id === id)
  if (poi) emit('pick-poi', poi)
}
function onGlView(b: MapBounds) {
  // 原生拖拽下 view 是真值，必须逐帧接受才能跟上；水墨模拟拖拽时才屏蔽半路重投影
  if (nativeDrag.value || !liveInteracting) glView.value = b
}
function onGlInteracting(active: boolean) { isLivePan.value = active }
/** 真实底图自带地点：只在前台没有拖动/长按时抬起详情，由用户自己决定后续动作 */
function onBaseMapPoi(info: { name: string; location: LngLat }) {
  if (panned || longPress.didFire()) return
  emit('base-poi', info)
}
function selectSegment(id: string) { emit('select-segment', id) }
function selectLeg(id: string) { emit('select-leg', id) }

function undoAnnotation() { geoStrokes.value.pop(); annotateRef.value?.undo() }
function clearAnnotations() { geoStrokes.value = []; annotateRef.value?.clear() }
const activeSelectedId = computed(() => focusedPoiId.value || props.selectedPoiId)
defineExpose({ undoAnnotation, clearAnnotations, loadPersisted, focusOn, focusPoi, resetCam })
</script>

<template>
  <!-- 根节点不要写死 relative/h-full：父级 absolute inset-0 负责定位，relative 会把 absolute 挤掉导致画布塌缩 -->
  <div
    ref="rootEl"
    class="map-cursor w-full h-full overflow-hidden bg-paper touch-none"
    :class="[annotateMode ? 'is-annotate' : '', isLivePan ? 'is-live-pan' : '']"
    @click="onClick"
    @pointerdown="onMapPointerDown"
    @pointermove="onMapPointerMove"
    @pointerup="onMapPointerUp"
    @pointercancel="onMapPointerUp"
  >
    <div ref="stageEl" class="map-stage-live absolute inset-0 origin-center">
    <div class="map-stage-world absolute" :style="worldStyle">
    <!-- 无真实瓦片时才画地理山、水；有腾讯底图时不再叠示意涂鸦 -->
    <InkFallbackMap
      v-if="!glReady"
      class="absolute inset-0 z-0"
      :width="stageSize.w"
      :height="stageSize.h"
      :k="k"
      :bounds="overlayBounds"
      :city="city"
    />

    <TencentBaseMap
      v-if="useRealBase"
      ref="baseMapRef"
      :key="`${mapKey}-${standardBase ? 'std' : 'ink'}`"
      class="absolute inset-0 z-[1]"
      :class="[glReady ? 'opacity-100' : 'opacity-0', glReady && !annotateMode ? 'pointer-events-auto' : 'pointer-events-none']"
      :map-key="mapKey"
      :bounds="worldBounds"
      :width="stageSize.w"
      :height="stageSize.h"
      :standard="standardBase"
      :interactive="!annotateMode"
      :layers="props.layers"
      @ready="glReady = true"
      @fail="onGlFail"
      @view="onGlView"
      @interacting="onGlInteracting"
      @pick-poi="onBaseMapPoi"
    />

    <RouteLayer
      class="absolute inset-0 z-[2]"
      :segments="visibleSegments" :pois="trip.pois" :bounds="overlayBounds"
      :width="stageSize.w" :height="stageSize.h" :k="k" :playing="!isLivePan"
      @select-segment="selectSegment"
    />

    <LegLayer
      class="absolute inset-0 z-[3]"
      :legs="visibleLegs" :cities="trip.cities" :bounds="overlayBounds"
      :width="stageSize.w" :height="stageSize.h" :k="k" :view-mode="viewMode"
      @select-leg="selectLeg"
    />

    <InkMarker
      class="absolute inset-0 z-[5]"
      :pois="visibleRecs" :bounds="overlayBounds" :width="stageSize.w" :height="stageSize.h" :k="k"
      :selected-id="activeSelectedId"
      ghost
      @select="pickRec"
    />

    <InkMarker
      class="absolute inset-0 z-[6]"
      :pois="visiblePois" :bounds="overlayBounds" :width="stageSize.w" :height="stageSize.h" :k="k"
      :selected-id="activeSelectedId"
      @select="selectPoi"
    />

    <AnnotateLayer ref="annotateRef" class="absolute inset-0 z-[4]" :active="annotateMode" @stroke="onStroke" />
    </div>
    </div>

    <WeatherBadge v-if="weather" class="z-[5]" :weather="weather" @open="weatherOpen = !weatherOpen" />

    <div
      v-if="weather && weatherOpen"
      data-map-interactive
      class="absolute top-14 right-4 z-20 w-44 rounded-lg border border-cyanq/40 bg-mist/95 p-3 shadow-paper"
    >
      <div class="font-cn text-xs text-ink">{{ weather.tempMin }}° ~ {{ weather.tempMax }}° · {{ weather.text }}</div>
      <div v-if="weather.poem" class="mt-1 font-brush text-sm text-cinnabar">{{ weather.poem }}</div>
      <div class="mt-1 font-cn text-[11px] leading-relaxed text-inkLight">{{ weather.advice }}</div>
    </div>

    <!-- 长按墨点涟漪 -->
    <div
      v-if="ripple"
      :key="ripple.key"
      class="ink-ripple pointer-events-none absolute z-30"
      :style="{ left: `${ripple.x}px`, top: `${ripple.y}px` }"
    />

    <!-- 日程聚焦：画布中心的扩散墨圈，短暂停留后淡出 -->
    <div
      v-if="focusRing"
      :key="focusRing"
      class="focus-ring pointer-events-none absolute z-20 left-1/2 top-1/2"
    >
      <span class="focus-ring-core"></span>
      <span class="focus-ring-wave"></span>
      <span class="focus-ring-wave focus-ring-wave-2"></span>
    </div>

    <div
      v-if="annotateMode"
      class="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 border border-cinnabar/40 bg-mist/90 px-3 py-1 font-cn text-[11px] text-cinnabar"
    >朱笔批注中 · 拖动落笔</div>

    <div
      v-if="!annotateMode"
      class="absolute right-3 top-16 z-20 flex flex-col items-center gap-2"
    >
      <div class="flex flex-col overflow-hidden border border-ink/15 bg-mist/90 shadow-paper">
        <button type="button" class="w-9 h-9 font-cn text-lg text-ink hover:text-cinnabar" title="放大" @click.stop="zoomBy(1.25)">+</button>
        <button type="button" class="w-9 h-9 font-cn text-lg text-ink hover:text-cinnabar border-t border-ink/10" title="缩小" @click.stop="zoomBy(0.8)">−</button>
        <button
          v-if="camScale !== 1 || camCenter"
          type="button"
          class="w-9 h-9 font-cn text-[10px] text-cinnabar border-t border-ink/10"
          title="复位视野"
          @click.stop="resetCam"
        >复</button>
      </div>
      <!-- 图层篆印：景/食/宿，同时控制自有印章与底图原生 POI（唯一一组） -->
      <div class="pointer-events-auto border border-ink/15 bg-mist/90 shadow-paper px-1.5 py-1.5">
        <LayerSeals />
      </div>
    </div>

    <div v-if="visiblePois.length === 0 && visibleRecs.length === 0 && !annotateMode" class="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
      <div class="text-center">
        <div class="seal mx-auto mb-3 h-14 w-14 text-xl">始</div>
        <p class="font-brush text-lg text-ink/70">单击地图上的印章查看详情</p>
        <p class="mt-1 font-cn text-[11px] leading-relaxed text-inkLight">可加入日程 · 左侧景/食/宿印可隐藏图层</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-stage-live {
  will-change: transform;
  backface-visibility: hidden;
  contain: layout style;
}
/* 拖动瞬间卸掉昂贵滤镜/混合层，松手后再恢复纸韵，保证手势连续 */
.map-cursor.is-live-pan :deep(.gl-paper),
.map-cursor.is-live-pan :deep(.gl-wash),
.map-cursor.is-live-pan :deep(.gl-mist),
.map-cursor.is-live-pan :deep(.gl-ink-bleed),
.map-cursor.is-live-pan :deep(.gl-grain) {
  filter: none !important;
  mix-blend-mode: normal !important;
}
.map-cursor.is-live-pan :deep(.gl-ink-bleed),
.map-cursor.is-live-pan :deep(.gl-grain) {
  display: none !important;
}
.map-cursor.is-live-pan :deep(.pin-pulse) {
  animation: none !important;
}
.ink-ripple {
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 999px;
  background: rgba(166, 72, 52, 0.55);
  box-shadow: 0 0 0 0 rgba(166, 72, 52, 0.35);
  animation: inkRipple 0.65s ease-out forwards;
}
@keyframes inkRipple {
  to {
    transform: scale(4.8);
    opacity: 0;
    box-shadow: 0 0 0 18px rgba(166, 72, 52, 0);
  }
}
.focus-ring {
  width: 0;
  height: 0;
}
.focus-ring-core,
.focus-ring-wave {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 999px;
  transform: translate(-50%, -50%);
}
.focus-ring-core {
  width: 12px;
  height: 12px;
  margin: 0;
  background: rgba(166, 72, 52, 0.85);
  box-shadow: 0 0 0 3px rgba(250, 246, 237, 0.9);
  animation: focusCore 1.2s ease-out forwards;
}
.focus-ring-wave {
  width: 28px;
  height: 28px;
  border: 1.5px solid rgba(166, 72, 52, 0.7);
  animation: focusWave 1.2s ease-out forwards;
}
.focus-ring-wave-2 { animation-delay: 0.18s; }
@keyframes focusCore {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}
@keyframes focusWave {
  0% { opacity: 0.85; transform: translate(-50%, -50%) scale(0.5); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(3.6); }
}
@media (prefers-reduced-motion: reduce) {
  .ink-ripple { animation: none; opacity: 0.7; }
  .focus-ring-core, .focus-ring-wave { animation-duration: 0.3s; }
}
</style>
