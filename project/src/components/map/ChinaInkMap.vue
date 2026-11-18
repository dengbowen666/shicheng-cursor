<script setup lang="ts">
/**
 * 首页水墨中国地图（D13 + D63–D68 + 行迹层）。
 * - 34 省 + 台湾 + 南海诸岛；四档晕墨；山水笔意；印记有机化 + 画眼
 * - CSS transform 的 translate 必须带 px
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import chinaPaths from '../../data/china-paths.json'
import { citiesByProvince, PRESET_CITIES, PROVINCE_SHORT } from '../../data/cities'
import InkBloom from '../overlay/InkBloom.vue'

interface MapMarker {
  name: string
  center: { lng: number; lat: number }
  state: 'todo' | 'active' | 'done' | 'ghost'
  count?: number
}

interface TrailLink {
  from: { lng: number; lat: number }
  to: { lng: number; lat: number }
  key: string
}

const props = withDefaults(defineProps<{
  focusProvince?: string | null
  markers?: MapMarker[]
  selectedCity?: string | null
  focusCity?: string | null
  mapMode?: 'mark' | 'trail'
  trailLinks?: TrailLink[]
}>(), {
  mapMode: 'mark',
  trailLinks: () => [],
})

const emit = defineEmits<{
  (e: 'select-province', name: string): void
  (e: 'select-city', name: string): void
  (e: 'back'): void
}>()

const C = {
  paper: '#F2ECE0', mist: '#FAF6ED', ink: '#2C2A26', grayInk: '#6E6A62',
  cinnabar: '#A64834', cinnabarDeep: '#8C3A28', cyanq: '#8FA9A6', ochre: '#B08D70',
}

const provinces = chinaPaths.provinces
const nanhai = chinaPaths.nanhai
const VB_W = 1000
const VB_H = 800
const hovered = ref<string | null>(null)
const reduceMotion = ref(false)
const entered = ref(false)

const rootEl = ref<HTMLDivElement | null>(null)
const k = ref(1.25)
let ro: ResizeObserver | null = null
function measure() {
  const el = rootEl.value
  if (!el) return
  const w = el.clientWidth || 1
  const h = el.clientHeight || 1
  k.value = Math.max(VB_W / w, VB_H / h)
}
onMounted(() => {
  measure()
  reduceMotion.value = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduceMotion.value) {
    requestAnimationFrame(() => { entered.value = true })
  } else {
    entered.value = true
  }
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure)
    ro.observe(rootEl.value)
  } else {
    window.addEventListener('resize', measure)
  }
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', measure)
})

/** 用各省行政中心把经纬度拟合到舆图 SVG，避免放大后印章漂到边框。 */
function solve3(M: number[][], v: number[]) {
  const a = M.map(row => row.slice())
  const b = v.slice()
  for (let i = 0; i < 3; i++) {
    let p = i
    for (let r = i + 1; r < 3; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r
    ;[a[i], a[p]] = [a[p], a[i]]
    ;[b[i], b[p]] = [b[p], b[i]]
    const d = a[i][i] || 1
    for (let j = i; j < 3; j++) a[i][j] /= d
    b[i] /= d
    for (let r = 0; r < 3; r++) {
      if (r === i) continue
      const f = a[r][i]
      for (let j = i; j < 3; j++) a[r][j] -= f * a[i][j]
      b[r] -= f * b[i]
    }
  }
  return b
}
function fitAffine(getY: (p: { lng: number; lat: number; x: number; y: number }) => number) {
  const pts = provinces.map(p => ({ lng: p.center[0], lat: p.center[1], x: p.cx, y: p.cy }))
  let Sll = 0, Saa = 0, Sla = 0, Sl = 0, Sa = 0, Sly = 0, Say = 0, Sy = 0
  const n = pts.length
  for (const p of pts) {
    const L = p.lng, A = p.lat, y = getY(p)
    Sll += L * L; Saa += A * A; Sla += L * A; Sl += L; Sa += A
    Sly += L * y; Say += A * y; Sy += y
  }
  return solve3([[Sll, Sla, Sl], [Sla, Saa, Sa], [Sl, Sa, n]], [Sly, Say, Sy])
}
const AX = fitAffine(p => p.x)
const AY = fitAffine(p => p.y)
function mapX(lng: number, lat = 35) { return AX[0] * lng + AX[1] * lat + AX[2] }
function mapY(lng: number, lat: number) { return AY[0] * lng + AY[1] * lat + AY[2] }

function bboxOf(d: string) {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) || []
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i], y = nums[i + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

const view = computed(() => {
  const base = { tx: 0, ty: 0, s: 1, str: 'translate(0px, 0px) scale(1)' }
  if (!props.focusProvince) return base
  const p = provinces.find(pr => pr.name === props.focusProvince)
  if (!p) return base
  const bb = bboxOf(p.d)
  const pad = Math.max(bb.w, bb.h) * 0.28
  const w = bb.w + pad * 2
  const h = bb.h + pad * 2
  const s = Math.min(VB_W / w, VB_H / h) * 0.94
  const tx = VB_W / 2 - (bb.x + bb.w / 2) * s
  const ty = VB_H / 2 - (bb.y + bb.h / 2) * s
  return { tx, ty, s, str: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(3)})` }
})

const u = computed(() => k.value / view.value.s)

/** 印章放在缩放组外，用屏幕坐标命中；CSS transform 组内小印点不中 */
function markerXY(m: MapMarker) {
  const lng = m.center.lng
  const lat = m.center.lat
  const { tx, ty, s } = view.value
  return {
    x: tx + mapX(lng, lat) * s,
    y: ty + mapY(lng, lat) * s,
  }
}

function shortName(name: string) {
  return (PROVINCE_SHORT[name] || name).replace('特别行政区', '')
}

/** D63：四档宣纸墨阶，按省名确定性 hash */
const PROVINCE_TINTS = ['#F0EAD9', '#EAE2CC', '#E3D8BD', '#DCCFAF']
function hashName(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h
}
function provinceFill(name: string) {
  if (props.focusProvince === name) return C.cinnabar
  if (hovered.value === name) return C.cyanq
  return PROVINCE_TINTS[hashName(name) % PROVINCE_TINTS.length]
}

/** D65：重点城略大印；微旋 ±4° */
const FOCUS_CITIES = new Set([
  '北京', '上海', '杭州', '成都', '西安', '厦门', '大理', '丽江',
  '桂林', '青岛', '拉萨', '乌鲁木齐', '三亚', '重庆', '广州', '深圳',
])
function sealSize(name: string) {
  const dense = !!props.focusProvince && citiesByProvince(props.focusProvince).length > 8
  const base = dense
    ? (FOCUS_CITIES.has(name) ? 24 : 20)
    : (FOCUS_CITIES.has(name) ? 28 : 22)
  return base * k.value
}
function sealRotate(name: string) {
  const h = hashName(name)
  return ((h % 9) - 4) // -4 … +4
}
function sealDelay(i: number) {
  if (reduceMotion.value) return '0ms'
  const step = props.focusProvince ? 28 : 60
  return `${Math.min(i * step, 900)}ms`
}

type LngLat = [number, number]
function smoothGeo(pts: LngLat[]) {
  if (pts.length < 2) return ''
  const xy = pts.map(([lng, lat]) => [mapX(lng, lat), mapY(lng, lat)] as [number, number])
  let d = `M${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] || xy[i]
    const p1 = xy[i]
    const p2 = xy[i + 1]
    const p3 = xy[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

/** D64：山脉连续笔触（非锯齿装饰） */
const RANGES: { name: string; pts: LngLat[]; width: number }[] = [
  { name: '喜马拉雅', width: 3.6, pts: [[78, 28.2], [82, 28.8], [86, 29.2], [90, 29.6], [94, 29.8], [96, 30.0]] },
  { name: '横断', width: 2.8, pts: [[98.2, 32.5], [99.0, 30.5], [100.2, 28.5], [101.2, 26.8]] },
  { name: '秦岭', width: 3.2, pts: [[105, 33.6], [107, 33.9], [109, 33.7], [111, 33.8], [112, 34.0]] },
  { name: '天山', width: 3.0, pts: [[79, 42.2], [82, 42.8], [86, 43.2], [90, 43.0], [92, 42.6]] },
  { name: '昆仑', width: 2.6, pts: [[78, 36.2], [84, 36.0], [90, 35.8], [96, 36.0]] },
  { name: '太行', width: 2.5, pts: [[113.2, 35.4], [114.0, 37.0], [115.2, 38.8], [115.8, 40.0]] },
  { name: '南岭', width: 2.5, pts: [[110.0, 24.8], [112.6, 25.0], [115.0, 25.4], [117.0, 25.4]] },
]

const RIVERS: { name: string; pts: LngLat[]; width: number; label: [number, number]; rotate?: number }[] = [
  {
    name: '黄河', width: 2.6, label: [108.4, 37.4], rotate: -64,
    pts: [[96, 35], [103, 36], [106, 38.5], [110, 40.5], [110.5, 35], [113, 34.8], [118.5, 37.5]],
  },
  {
    name: '长江', width: 3.0, label: [112.6, 30.0], rotate: -8,
    pts: [[98, 34], [106.5, 29.5], [114.3, 30.6], [118.8, 32], [121.5, 31.2]],
  },
  {
    name: '珠江', width: 2.0, label: [110.6, 23.6], rotate: -6,
    pts: [[104.2, 25.4], [106.6, 24.4], [108.6, 23.4], [110.4, 23.2], [112.4, 23.2], [113.6, 22.6]],
  },
]
const riverPaths = RIVERS.map(r => ({ ...r, d: smoothGeo(r.pts) }))
const rangePaths = RANGES.map(r => ({ ...r, d: smoothGeo(r.pts), width: r.width }))

const allMarkers = computed<MapMarker[]>(() => {
  const list = [...(props.markers || [])]
  const focus = props.focusProvince
  if (!focus) return list
  const seeds = citiesByProvince(focus)
  const seedNames = new Set(seeds.map(c => c.name))
  const focusShort = PROVINCE_SHORT[focus] || focus.replace(/省|市|自治区|特别行政区/g, '')
  const merged = new Map<string, MapMarker>()
  for (const m of list) {
    const preset = PRESET_CITIES.find(c => c.name === m.name)
    const cp = preset
      ? (PROVINCE_SHORT[preset.province] || preset.province.replace(/省|市|自治区|特别行政区/g, ''))
      : ''
    if (seedNames.has(m.name) || cp === focusShort) merged.set(m.name, m)
  }
  for (const c of seeds) {
    if (!merged.has(c.name)) merged.set(c.name, { name: c.name, center: c.center, state: 'todo' })
  }
  return [...merged.values()]
})

/**
 * 低 zoom（无省份聚焦）且印记较多时，按网格聚合为墨点簇（4.2 / D91）。
 * 下钻或印记 ≤12 时全量展开。
 */
const clustered = computed(() => {
  const list = allMarkers.value
  const expand = !!props.focusProvince || list.length <= 12
  if (expand) {
    return {
      seals: list.map((m, i) => {
        const size = sealSize(m.name)
        const xy = markerXY(m)
        return {
          ...m, i, size, rotate: sealRotate(m.name),
          x: xy.x, y: xy.y,
          isFocus: props.mapMode === 'mark' && props.focusCity === m.name,
          delay: sealDelay(i),
        }
      }),
      clusters: [] as { x: number; y: number; count: number; names: string[] }[],
    }
  }
  const cell = 56 * k.value
  const buckets = new Map<string, { x: number; y: number; items: MapMarker[] }>()
  for (const m of list) {
    const xy = markerXY(m)
    const gx = Math.floor(xy.x / cell)
    const gy = Math.floor(xy.y / cell)
    const key = `${gx}:${gy}`
    const b = buckets.get(key) || { x: 0, y: 0, items: [] }
    b.items.push(m)
    b.x += xy.x
    b.y += xy.y
    buckets.set(key, b)
  }
  type Seal = MapMarker & {
    i: number; size: number; rotate: number; x: number; y: number; isFocus: boolean; delay: string
  }
  const seals: Seal[] = []
  const clusters: { x: number; y: number; count: number; names: string[] }[] = []
  let i = 0
  for (const b of buckets.values()) {
    const n = b.items.length
    const x = b.x / n
    const y = b.y / n
    if (n === 1) {
      const m = b.items[0]
      seals.push({
        ...m, i, size: sealSize(m.name), rotate: sealRotate(m.name), x, y,
        isFocus: props.mapMode === 'mark' && props.focusCity === m.name,
        delay: sealDelay(i),
      })
    } else {
      clusters.push({ x, y, count: n, names: b.items.map(it => it.name) })
    }
    i++
  }
  return { seals, clusters }
})

const decoratedMarkers = computed(() => clustered.value.seals)

/** 注名去重：包围盒冲突只留印 */
const labelPlan = computed(() => {
  const kept: { name: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' }[] = []
  const boxes: { x1: number; x2: number; y1: number; y2: number }[] = []
  const fs = 10 * k.value
  // 先放重点城 / 行程印，再补其余，避免热门城被挤掉注名
  const ordered = [...decoratedMarkers.value].sort((a, b) => {
    const wa = (FOCUS_CITIES.has(a.name) ? 2 : 0) + (a.state === 'active' || a.state === 'done' ? 2 : 0) + (a.state === 'todo' ? 0 : 1)
    const wb = (FOCUS_CITIES.has(b.name) ? 2 : 0) + (b.state === 'active' || b.state === 'done' ? 2 : 0) + (b.state === 'todo' ? 0 : 1)
    return wb - wa
  })
  for (const m of ordered) {
    const approxW = m.name.length * fs * 0.95
    let anchor: 'start' | 'middle' | 'end' = 'middle'
    let lx = m.x
    if (m.x < 80) { anchor = 'start'; lx = m.x - m.size / 2 }
    else if (m.x > VB_W - 80) { anchor = 'end'; lx = m.x + m.size / 2 }
    const ly = m.y - m.size / 2 - 5 * k.value
    const x1 = anchor === 'start' ? lx : anchor === 'end' ? lx - approxW : lx - approxW / 2
    const x2 = x1 + approxW
    const y1 = ly - 11 * k.value
    const y2 = ly + 3 * k.value
    const hit = boxes.some(b => !(x2 < b.x1 || x1 > b.x2 || y2 < b.y1 || y1 > b.y2))
    if (hit) continue
    boxes.push({ x1, x2, y1, y2 })
    kept.push({ name: m.name, x: lx, y: ly, anchor })
  }
  return new Map(kept.map(x => [x.name, x]))
})

const wash = ref<{ on: boolean; x: number; y: number; key: number }>({ on: false, x: 0.5, y: 0.45, key: 0 })
/** 晕染落点：下钻用点击处；返回九州固定画面中心，不要钉在按钮上 */
function startWash(origin?: { x: number; y: number } | MouseEvent | null) {
  let x = 0.5
  let y = 0.42
  if (origin && typeof (origin as MouseEvent).clientX === 'number') {
    const el = rootEl.value
    if (el) {
      const r = el.getBoundingClientRect()
      const e = origin as MouseEvent
      x = (e.clientX - r.left) / Math.max(1, r.width)
      y = (e.clientY - r.top) / Math.max(1, r.height)
    }
  } else if (origin && typeof (origin as { x: number }).x === 'number') {
    x = (origin as { x: number; y: number }).x
    y = (origin as { x: number; y: number }).y
  }
  wash.value = {
    on: true,
    x: Math.min(0.88, Math.max(0.12, x)),
    y: Math.min(0.82, Math.max(0.18, y)),
    key: Date.now(),
  }
}
function onWashDone() {
  wash.value = { ...wash.value, on: false }
}
function onProvincePath(name: string, e: MouseEvent) {
  // 已在本省：再点省界不应空放晕染
  if (props.focusProvince === name) return
  startWash(e)
  emit('select-province', name)
}
function onCityClick(name: string, e: MouseEvent) {
  if (!props.focusProvince) {
    const city = PRESET_CITIES.find(c => c.name === name)
    startWash(e)
    emit('select-province', city?.province || name)
    return
  }
  e.stopPropagation()
  emit('select-city', name)
}
function onBack() {
  // 返九州：晕染从画面中心洇开，不跟按钮角落走
  startWash({ x: 0.5, y: 0.45 })
  emit('back')
}
</script>

<template>
  <div
    ref="rootEl"
    class="relative w-full h-full overflow-hidden transition-opacity duration-400"
    :class="entered ? 'opacity-100' : 'opacity-0'"
  >
    <svg :viewBox="`0 0 ${VB_W} ${VB_H}`" class="w-full h-full block" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="inkSea" cx="50%" cy="42%" r="70%">
          <stop offset="0%" :stop-color="C.mist" />
          <stop offset="100%" stop-color="#EADFC8" />
        </radialGradient>
        <filter id="chinaShadow"><feDropShadow dx="0" dy="1.4" stdDeviation="1.3" flood-color="#5A5449" flood-opacity="0.18" /></filter>
        <filter id="insetShadow" x="-20%" y="-8%" width="140%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#5A5449" flood-opacity="0.16" />
        </filter>
        <filter id="chinaWashBlur"><feGaussianBlur stdDeviation="22" /></filter>
        <filter id="chinaGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="linear" slope=".10" /></feComponentTransfer>
        </filter>
        <!-- D63：毛笔边线 -->
        <filter id="brushEdge" x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="eyeGlow">
          <feDropShadow dx="0" dy="0" stdDeviation="2.2" flood-color="#A64834" flood-opacity="0.35" />
        </filter>
      </defs>

      <rect :width="VB_W" :height="VB_H" fill="url(#inkSea)" />

      <g filter="url(#chinaWashBlur)" pointer-events="none" opacity="0.55">
        <ellipse cx="150" cy="150" rx="250" ry="130" fill="#A9825C" opacity="0.18" />
        <ellipse cx="855" cy="645" rx="290" ry="155" fill="#7F9B95" opacity="0.16" />
        <ellipse cx="560" cy="735" rx="240" ry="90" fill="#B7C8C2" opacity="0.20" />
      </g>

      <!-- D67：云雾过一遍后驻留低透明 -->
      <g
        v-if="!reduceMotion"
        class="cloud-pass"
        pointer-events="none"
        fill="#A9B4B2"
        opacity="0.14"
      >
        <ellipse cx="120" cy="120" rx="70" ry="22" />
        <ellipse cx="780" cy="160" rx="90" ry="26" />
        <ellipse cx="520" cy="700" rx="80" ry="20" />
      </g>

      <g filter="url(#chinaWashBlur)" fill="#AFC3BC" opacity="0.26" pointer-events="none">
        <path d="M-30 650 Q90 585 180 620 T360 610 L360 820 L-30 820 Z" />
        <path d="M670 760 Q760 690 850 720 T1040 700 L1040 820 L670 820 Z" />
      </g>

      <g :stroke="C.ochre" stroke-width="0.8" fill="none" opacity="0.3" pointer-events="none">
        <path d="M60 700 q30 -8 60 0 t60 0" />
        <path d="M120 730 q30 -8 60 0 t60 0" />
        <path d="M770 690 q30 -8 60 0 t60 0" />
        <path d="M830 722 q30 -8 60 0 t60 0" />
      </g>

      <g :style="{ transform: view.str, transformOrigin: '0 0', transition: reduceMotion ? 'none' : 'transform 0.62s cubic-bezier(0.34,0.02,0.2,1)' }">
        <g filter="url(#brushEdge)">
          <g filter="url(#chinaShadow)">
            <path
              v-for="p in provinces"
              :key="p.adcode"
              :d="p.d"
              :fill="provinceFill(p.name)"
              :fill-opacity="!focusProvince ? 1 : focusProvince === p.name ? 0.58 : hovered === p.name ? 0.36 : 0.16"
              :stroke="focusProvince === p.name ? C.cinnabarDeep : '#4F4942'"
              :stroke-width="(focusProvince === p.name ? 1.9 : 1.25) / view.s"
              stroke-linejoin="round"
              class="transition-all duration-300"
              :class="focusProvince === p.name ? 'cursor-default' : 'cursor-pointer'"
              :pointer-events="focusProvince === p.name ? 'none' : 'auto'"
              @mouseenter="hovered = p.name"
              @mouseleave="hovered = null"
              @click="onProvincePath(p.name, $event)"
            >
              <title>{{ shortName(p.name) }}</title>
            </path>
          </g>
        </g>

        <!-- D64 山脉：淡墨连续笔触 -->
        <g fill="none" stroke="#A9B4B2" opacity="0.3" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">
          <path
            v-for="(r, i) in rangePaths" :key="`range-${i}`"
            :d="r.d"
            :stroke-width="r.width / view.s"
          />
        </g>

        <!-- D64 江河：留白双勾 -->
        <g fill="none" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">
          <path v-for="(r, i) in riverPaths" :key="`rw-${i}`" :d="r.d" stroke="#6E6A62" :stroke-width="(r.width * 1.6) / view.s" opacity="0.18" />
          <path v-for="(r, i) in riverPaths" :key="`r-${i}`" :d="r.d" stroke="#FAF6ED" :stroke-width="(r.width * 1.15) / view.s" opacity="0.92" />
        </g>

        <g font-family="'Noto Serif SC','Songti SC',serif" pointer-events="none">
          <text
            v-for="p in provinces"
            :key="'t' + p.adcode"
            :x="p.cx" :y="p.cy"
            :font-size="12 * u"
            :fill="hovered === p.name || focusProvince === p.name ? C.cinnabarDeep : '#5D574D'"
            text-anchor="middle"
            :opacity="focusProvince && focusProvince !== p.name ? 0 : (hovered === p.name || focusProvince === p.name ? 1 : 0.84)"
            :stroke="C.mist" :stroke-width="2.6 * u" paint-order="stroke" stroke-linejoin="round"
          >{{ shortName(p.name) }}</text>
        </g>

        <g font-family="'Ma Shan Zheng','STKaiti','KaiTi',serif" pointer-events="none">
          <text
            v-for="(r, i) in RIVERS" :key="`rn-${i}`"
            :x="mapX(r.label[0], r.label[1])" :y="mapY(r.label[0], r.label[1])"
            :font-size="9.5 * u" fill="#3F6B66" :opacity="focusProvince ? 0 : 0.52"
            text-anchor="middle" :letter-spacing="1.2"
            :stroke="C.mist" :stroke-width="2.4 * u" paint-order="stroke" stroke-linejoin="round"
            :transform="`rotate(${r.rotate || 0} ${mapX(r.label[0], r.label[1])} ${mapY(r.label[0], r.label[1])})`"
          >{{ r.name }}</text>
        </g>
      </g>

      <!-- 行迹 / 城市印：缩放组外屏幕坐标，命中与所见一致 -->
      <g v-if="mapMode === 'trail'" fill="none" stroke="#6E6A62" stroke-dasharray="6 5" opacity="0.45" pointer-events="none">
        <line
          v-for="link in trailLinks"
          :key="link.key"
          :x1="view.tx + mapX(link.from.lng, link.from.lat) * view.s"
          :y1="view.ty + mapY(link.from.lng, link.from.lat) * view.s"
          :x2="view.tx + mapX(link.to.lng, link.to.lat) * view.s"
          :y2="view.ty + mapY(link.to.lng, link.to.lat) * view.s"
          :stroke-width="1.4 * k"
        />
      </g>

      <g v-if="clustered.clusters.length">
        <g
          v-for="(c, ci) in clustered.clusters" :key="`cl-${ci}`"
          :transform="`translate(${c.x}, ${c.y})`"
          class="cursor-pointer"
          @click.stop="onCityClick(c.names[0], $event)"
        >
          <title>{{ c.names.join('、') }}</title>
          <circle :r="16 * k" fill="transparent" />
          <circle :r="10 * k" fill="#2C2A26" opacity="0.72" />
          <circle :r="10 * k" fill="none" stroke="#A64834" :stroke-width="1.4 * k" opacity="0.85" />
          <text :y="4 * k" text-anchor="middle" :font-size="11 * k" fill="#FAF6ED" font-family="'Noto Serif SC',serif">{{ c.count }}</text>
        </g>
      </g>

      <g>
        <g
          v-for="m in decoratedMarkers"
          :key="m.name"
          :transform="`translate(${m.x}, ${m.y}) rotate(${m.rotate})`"
          class="cursor-pointer"
          :class="reduceMotion ? '' : 'stamp-in'"
          :style="{ animationDelay: m.delay }"
          @pointerdown.stop
          @click.stop="onCityClick(m.name, $event)"
        >
          <title>{{ m.name }}{{ m.count && m.count > 1 ? ` · ${m.count} 卷` : '' }}</title>
          <circle :r="Math.max(m.size * 0.9, 18 * k)" fill="transparent" />

          <g class="city-seal-inner">
            <g v-if="m.isFocus" pointer-events="none">
              <circle :r="18 * k" fill="none" :stroke="C.cinnabar" :stroke-width="1.2 * k" class="eye-breath" />
              <line x1="0" y1="0" x2="0" :y2="-48 * k" stroke="#6E6A62" :stroke-width="1 * k" opacity="0.55" />
              <circle :cy="-48 * k" :r="2.2 * k" :fill="C.cinnabar" opacity="0.85" />
              <text
                :y="-54 * k" text-anchor="middle" :font-size="11 * k" :fill="C.ink"
                font-family="'Ma Shan Zheng','KaiTi',serif"
              >{{ m.name }}</text>
            </g>

            <g :transform="`translate(${-m.size / 2}, ${-m.size / 2})`" pointer-events="none">
              <rect
                :width="m.size" :height="m.size" :rx="2 * k"
                :fill="m.state === 'active' ? C.cinnabar : m.state === 'done' ? C.cinnabar : m.state === 'ghost' ? 'transparent' : C.mist"
                :stroke="m.state === 'active' || m.state === 'done' ? C.cinnabarDeep : m.state === 'ghost' ? '#8D8880' : C.ink"
                :stroke-width="1.6 * k"
                :stroke-dasharray="m.state === 'ghost' ? `${3 * k} ${2.5 * k}` : undefined"
                :opacity="m.state === 'ghost' ? 0.75 : 1"
                :filter="m.isFocus ? 'url(#eyeGlow)' : undefined"
              />
              <text
                :x="m.size / 2" :y="m.size * 0.68" text-anchor="middle"
                :font-size="m.size * 0.52"
                :fill="m.state === 'todo' || m.state === 'ghost' ? C.ink : C.mist"
                font-family="'Ma Shan Zheng','KaiTi','Noto Serif SC',serif"
              >{{ m.state === 'done' || m.state === 'ghost' ? '行' : m.name.slice(0, 1) }}</text>
            </g>

            <text
              v-if="labelPlan.get(m.name) && !m.isFocus"
              pointer-events="none"
              :x="(labelPlan.get(m.name)!.x - m.x)"
              :y="(labelPlan.get(m.name)!.y - m.y)"
              :text-anchor="labelPlan.get(m.name)!.anchor"
              :font-size="11 * k"
              :fill="selectedCity === m.name ? C.cinnabarDeep : C.ink"
              :stroke="C.mist" :stroke-width="3 * k" paint-order="stroke" stroke-linejoin="round"
              font-family="'Noto Serif SC','Songti SC',serif"
            >{{ m.name }}</text>

            <text
              v-if="(m.count || 0) > 1"
              pointer-events="none"
              :x="m.size * 0.42" :y="-m.size * 0.42"
              :font-size="9 * k" :fill="C.cinnabarDeep"
              font-family="'Noto Serif SC',serif"
            >{{ m.count }}</text>
          </g>
        </g>
      </g>

      <g pointer-events="none" :style="{ opacity: focusProvince ? 0 : 1, transition: 'opacity 0.35s' }">
        <svg x="14" y="556" width="176" height="234" :viewBox="chinaPaths.insetViewBox" preserveAspectRatio="xMidYMid meet">
          <rect x="-9" y="-9" width="228" height="298" :fill="C.mist" filter="url(#insetShadow)" />
          <rect x="-9" y="-9" width="228" height="298" fill="none" stroke="#8A8275" stroke-width="0.9" />
          <rect x="-4" y="-4" width="218" height="288" fill="none" stroke="#B6AA92" stroke-width="0.55" stroke-dasharray="3 3" />
          <path :d="nanhai" fill="#EFE5D0" stroke="#57514A" stroke-width="0.7" stroke-linejoin="round" />
          <text x="0" y="276" font-size="11" :fill="C.grayInk" font-family="'Noto Serif SC','Songti SC',serif" letter-spacing="1.2">南海诸岛</text>
          <text x="208" y="276" font-size="8.5" fill="#8A8275" text-anchor="end" font-family="'Noto Serif SC',serif">比例尺不同</text>
        </svg>
      </g>

      <g
        transform="translate(916, 700) rotate(6)" pointer-events="none"
        :style="{ opacity: focusProvince ? 0 : 0.85, transition: 'opacity 0.35s' }"
      >
        <rect width="46" height="46" rx="2" :fill="C.cinnabar" opacity="0.8" />
        <text x="23" y="20" font-size="15" :fill="C.mist" text-anchor="middle" font-family="'Ma Shan Zheng','KaiTi',serif">九州</text>
        <text x="23" y="38" font-size="15" :fill="C.mist" text-anchor="middle" font-family="'Ma Shan Zheng','KaiTi',serif">行旅</text>
      </g>

      <rect :width="VB_W" :height="VB_H" filter="url(#chinaGrain)" opacity="0.30" pointer-events="none" class="paper-tex" />
      <rect x="6" y="6" :width="VB_W - 12" :height="VB_H - 12" fill="none" :stroke="C.ochre" stroke-width="1.2" opacity="0.22" pointer-events="none" />
    </svg>

    <InkBloom
      :key="wash.key"
      :active="wash.on"
      :x="wash.x"
      :y="wash.y"
      :duration="1400"
      @done="onWashDone"
    />

    <div v-if="focusProvince" class="absolute z-20 left-3 bottom-4 md:left-5 md:bottom-6 flex flex-col items-start gap-2">
      <button
        type="button"
        class="h-9 px-3 paper-card font-cn text-[12px] text-ink hover:text-cinnabar inline-flex items-center gap-1.5"
        @click.stop="onBack"
      >返 · 九州</button>
      <p class="font-cn text-[10px] text-inkLight/90 tracking-wider pl-0.5">
        {{ shortName(focusProvince) }} · {{ citiesByProvince(focusProvince).length }} 城可入 · 点印入城
      </p>
    </div>
  </div>
</template>

<style scoped>
.stamp-in { animation: stampIn 0.45s ease-out both; }
@keyframes stampIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.city-seal-inner {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.city-seal-inner:hover {
  transform: translateY(-2px) scale(1.05);
  filter: drop-shadow(0 3px 4px rgba(38, 35, 31, 0.22));
}
.eye-breath { animation: eyeBreath 2.4s ease-in-out infinite; }
@keyframes eyeBreath {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.15; }
}
.cloud-pass { animation: cloudDrift 3s ease-out both; }
@keyframes cloudDrift {
  from { opacity: 0.05; }
  70% { opacity: 0.16; }
  to { opacity: 0.12; }
}
@media (prefers-reduced-motion: reduce) {
  .stamp-in, .eye-breath, .cloud-pass { animation: none !important; }
  .city-seal-inner:hover { transform: none; filter: none; }
}
</style>
