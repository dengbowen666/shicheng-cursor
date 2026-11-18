<script setup lang="ts">
/**
 * 真实底图：腾讯 GL + 纸色罩层。
 * 加载失败 / 超时 / tiles 异常一律 emit fail，由上层露出水墨舆图。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LngLat } from '../../types'
import type { MapBounds } from '../../lib/projection'
import { boundsFromCorners } from '../../lib/projection'
import { applyInkStyle, loadTMap } from '../../lib/tmap'

const props = defineProps<{
  mapKey: string
  bounds: MapBounds
  width: number
  height: number
  standard?: boolean
  /** true=把拖拽/缩放交还腾讯 GL 原生（GPU 合成、跟手、松手无回弹）；水墨底图为 false */
  interactive?: boolean
}>()

const emit = defineEmits<{
  (e: 'fail'): void
  (e: 'ready'): void
  (e: 'view', b: MapBounds): void
  (e: 'interacting', active: boolean): void
  (e: 'pick-poi', info: { name: string; location: LngLat }): void
}>()

const el = ref<HTMLDivElement | null>(null)
let map: any = null
let dead = false
let timer: number | undefined
let probeTimer: number | undefined
let failTimer: number | undefined
let markedReady = false
let viewRaf = 0
let focusRaf = 0

/** pan/zoom 每帧最多回传一次视野，覆盖层据此实时重投影，跟手无延迟 */
function publishViewSoon() {
  if (viewRaf || dead) return
  viewRaf = window.requestAnimationFrame(() => {
    viewRaf = 0
    publishView()
  })
}

/** 供父级按钮调用：真实底图原生缩放 */
function zoomBy(factor: number) {
  if (!map || dead) return
  cancelAnimationFrame(focusRaf)
  const z = Math.max(3, Math.min(18, (map.getZoom?.() || 10) + Math.log2(factor)))
  map.setZoom(z)
  publishViewSoon()
}

/** 供父级重置：回到自适应视野 */
function refit() { if (!dead) syncView(true) }

/** 日程聚焦：动画移动 GL 中心+缩放，逐帧回传视野让印章跟随 */
function focusOn(location: LngLat, zoomDelta = 1.3, ms = 580) {
  if (!map || dead) return
  cancelAnimationFrame(focusRaf)
  const from = map.getCenter()
  const z0 = map.getZoom?.() || 10
  const z1 = Math.max(3, Math.min(18, z0 + zoomDelta))
  const start = performance.now()
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const step = (now: number) => {
    if (!map || dead) return
    const p = Math.min(1, (now - start) / ms)
    const e = ease(p)
    map.setCenter(new window.TMap.LatLng(
      from.getLat() + (location.lat - from.getLat()) * e,
      from.getLng() + (location.lng - from.getLng()) * e,
    ))
    map.setZoom(z0 + (z1 - z0) * e)
    publishViewSoon()
    if (p < 1) focusRaf = window.requestAnimationFrame(step)
  }
  focusRaf = window.requestAnimationFrame(step)
}

defineExpose({ zoomBy, refit, focusOn })

function targetZoom() {
  const spanLng = Math.max(1e-6, props.bounds.maxLng - props.bounds.minLng)
  return Math.log2((props.width * 360) / (256 * spanLng))
}

function syncView(calibrate = false) {
  if (!map || dead) return
  const center = new window.TMap.LatLng(
    (props.bounds.minLat + props.bounds.maxLat) / 2,
    (props.bounds.minLng + props.bounds.maxLng) / 2,
  )
  const z = targetZoom()
  map.setCenter(center)
  map.setZoom(z)
  window.setTimeout(() => publishView(), calibrate ? 280 : 40)
  if (!calibrate) return
  window.setTimeout(() => {
    if (!map || dead) return
    try {
      const bb = map.getBounds()
      const ne = bb.getNorthEast()
      const sw = bb.getSouthWest()
      const measured = ne.getLng() - sw.getLng()
      const want = props.bounds.maxLng - props.bounds.minLng
      if (measured > 0 && Math.abs(measured - want) / want > 0.002) {
        map.setZoom(z + Math.log2(measured / want))
      }
      publishView()
    } catch { /* ignore */ }
  }, 260)
}

function publishView() {
  if (!map || dead) return
  try {
    const bb = map.getBounds()
    const ne = bb.getNorthEast()
    const sw = bb.getSouthWest()
    emit('view', boundsFromCorners(
      { lng: sw.getLng(), lat: sw.getLat() },
      { lng: ne.getLng(), lat: ne.getLat() },
    ))
  } catch { /* ignore */ }
}

function schedule() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => syncView(false), 80)
}

function markReady() {
  if (dead || markedReady) return
  markedReady = true
  window.clearTimeout(failTimer)
  window.clearTimeout(probeTimer)
  emit('ready')
}

function markFail() {
  if (dead || markedReady) return
  dead = true
  window.clearTimeout(failTimer)
  window.clearTimeout(probeTimer)
  try { map?.destroy?.() } catch { /* ignore */ }
  map = null
  emit('fail')
}

function onTileSignal() {
  if (dead || markedReady) return
  // 等两帧让瓦片真正画上，避免空白 canvas 抢先盖住水墨底
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!dead && !markedReady) markReady()
    })
  })
}

onMounted(async () => {
  // 仅在收到 tilesloaded/idle 后才 ready；超时未出图 → 回落水墨舆图
  failTimer = window.setTimeout(() => markFail(), 8000)
  try {
    await loadTMap(props.mapKey)
    if (dead || !el.value) return
    if (!window.TMap) {
      markFail()
      return
    }
    const TMap = window.TMap
    map = new TMap.Map(el.value, {
      center: new TMap.LatLng(
        (props.bounds.minLat + props.bounds.maxLat) / 2,
        (props.bounds.minLng + props.bounds.maxLng) / 2,
      ),
      zoom: targetZoom(),
      minZoom: 3,
      maxZoom: 18,
      pitch: 0,
      rotation: 0,
      viewMode: '2D',
      showControl: false,
      // 真实底图交还 GL 原生交互：GPU 合成、跟手、有惯性，松手无 CSS transform 回弹
      draggable: !!props.interactive,
      scrollable: !!props.interactive,
      doubleClickZoom: !!props.interactive,
      touchZoomable: !!props.interactive,
      baseMap: {
        type: 'vector',
        // point 必须开着，原生 POI 才会进 click 事件的 evt.poi；纸韵档靠样式隐藏文字避免叠字
        features: ['base', 'road', 'building', 'point'],
      },
    })
    applyInkStyle(map, !!props.standard)
    let bound = false
    try {
      map.on('idle', () => { onTileSignal(); publishView() })
      map.on('tilesloaded', () => { onTileSignal(); publishView() })
      map.on('error', () => markFail())
      if (props.interactive) {
        // 拖拽/缩放过程中持续回传视野，覆盖层每帧跟上；起止态给上层暂停线路动画
        map.on('pan', publishViewSoon)
        map.on('zoom', publishViewSoon)
        map.on('center_changed', publishViewSoon)
        map.on('dragstart', () => emit('interacting', true))
        map.on('panstart', () => emit('interacting', true))
        map.on('dragend', () => { emit('interacting', false); publishView() })
        map.on('panend', () => { emit('interacting', false); publishView() })
        map.on('zoomend', () => publishView())
      }
      // 真实底图上的原生 POI：官方 click 事件会带 evt.poi（名称 + 坐标）。
      // 只认 GL 的事件，不要额外 DOM click 兜底——否则空白处/拖拽尾也会弹卡。
      map.on('click', (evt: any) => {
        const poi = evt?.poi
        if (!poi?.name) return
        const ll = poi.latLng || evt?.latLng
        if (!ll || typeof ll.getLng !== 'function') return
        emit('pick-poi', {
          name: String(poi.name),
          location: { lng: ll.getLng(), lat: ll.getLat() },
        })
      })
      bound = true
    } catch { /* 老版本事件不全 */ }

    // 无事件 API 时：等 canvas 出现后再延迟确认；绝不在 1.8s 盲目 ready
    if (!bound) {
      let probes = 0
      const probe = () => {
        if (dead || markedReady) return
        probes += 1
        const canvas = el.value?.querySelector('canvas')
        if (canvas && probes >= 4) {
          markReady()
          return
        }
        if (probes >= 14) {
          markFail()
          return
        }
        probeTimer = window.setTimeout(probe, 500)
      }
      probeTimer = window.setTimeout(probe, 700)
    }
    window.setTimeout(() => syncView(true), 320)
  } catch {
    markFail()
  }
})

onBeforeUnmount(() => {
  dead = true
  window.clearTimeout(timer)
  window.clearTimeout(probeTimer)
  window.clearTimeout(failTimer)
  if (viewRaf) window.cancelAnimationFrame(viewRaf)
  if (focusRaf) window.cancelAnimationFrame(focusRaf)
  try { map?.destroy?.() } catch { /* ignore */ }
  map = null
})

// 原生交互下别让父级 camCenter 的回写把地图拽回去：view 才是真值，只在非交互态同步 props.bounds
watch(() => [props.bounds.minLng, props.bounds.maxLng, props.bounds.minLat, props.bounds.maxLat], () => {
  if (!props.interactive) schedule()
})
watch(() => [props.width, props.height], () => {
  try { map?.resize?.() } catch { /* ignore */ }
  schedule()
})
</script>

<template>
  <div class="absolute inset-0 overflow-hidden">
    <div ref="el" class="absolute inset-0" :class="standard ? '' : 'gl-paper'" />
    <template v-if="!standard">
      <div class="pointer-events-none absolute inset-0 gl-wash" />
      <div class="pointer-events-none absolute inset-0 gl-mist" />
      <div class="pointer-events-none absolute inset-0 gl-ink-bleed" />
      <div class="pointer-events-none absolute inset-0 gl-grain" />
    </template>
  </div>
</template>
