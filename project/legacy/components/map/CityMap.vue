<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CityGuide, GuideNode, GuideLeg } from '../../types'
import { MODE_STYLE } from '../../lib/transport'

const props = defineProps<{
  guide: CityGuide
  activeDay: number
  selectedNodeId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select-node', id: string): void
}>()

const day = computed(() => props.guide.days.find(d => d.dayIndex === props.activeDay) || props.guide.days[0])
const nodes = computed<GuideNode[]>(() => day.value?.nodes || [])
const legs = computed<GuideLeg[]>(() => day.value?.legs || [])

/* ============ 自适应画布 ============
 * 用容器真实宽高比作 viewBox，画面既不会被上下留白裁切，
 * 也不会因为窄屏把文字缩成看不清的小点。
 * k = 1 CSS 像素对应的 viewBox 单位，所有视觉尺寸都乘 k。
 */
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

onMounted(() => {
  measure()
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

const PAD = 1.34          // 四周留白倍率
const MIN_SPAN = 0.012    // 最小地理跨度（度），避免点位过密时无限放大

/**
 * 视野计算：先把经纬度按 cos(纬度) 做等距修正，再把跨度撑到与画布同比例，
 * 这样既保证地图形状不失真，又让点位铺满画面而不是挤在一角。
 */
const bounds = computed(() => {
  const c = props.guide.center
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  if (nodes.value.length === 0) {
    minLng = c.lng - 0.02; maxLng = c.lng + 0.02
    minLat = c.lat - 0.02; maxLat = c.lat + 0.02
  } else {
    for (const n of nodes.value) {
      minLng = Math.min(minLng, n.lng); maxLng = Math.max(maxLng, n.lng)
      minLat = Math.min(minLat, n.lat); maxLat = Math.max(maxLat, n.lat)
    }
  }
  const midLat = (minLat + maxLat) / 2
  const cos = Math.cos((midLat * Math.PI) / 180)

  let spanX = Math.max(maxLng - minLng, MIN_SPAN) * cos * PAD
  let spanY = Math.max(maxLat - minLat, MIN_SPAN) * PAD

  const viewAspect = size.value.w / size.value.h
  if (spanX / spanY > viewAspect) spanY = spanX / viewAspect
  else spanX = spanY * viewAspect

  const cx = (minLng + maxLng) / 2, cy = (minLat + maxLat) / 2
  return {
    minLng: cx - spanX / cos / 2, maxLng: cx + spanX / cos / 2,
    minLat: cy - spanY / 2, maxLat: cy + spanY / 2,
    spanX, spanY, cos,
  }
})

function proj(lng: number, lat: number) {
  const b = bounds.value
  return {
    x: (((lng - b.minLng) * b.cos) / b.spanX) * size.value.w,
    y: ((b.maxLat - lat) / b.spanY) * size.value.h,
  }
}
const nodeXY = (n: GuideNode) => proj(n.lng, n.lat)

function legGeom(leg: GuideLeg) {
  const a = nodes.value.find(n => n.id === leg.fromId)
  const b = nodes.value.find(n => n.id === leg.toId)
  if (!a || !b) return null
  const pa = nodeXY(a), pb = nodeXY(b)
  const dx = pb.x - pa.x, dy = pb.y - pa.y
  const len = Math.hypot(dx, dy) || 1
  // 徽标沿法线偏移，避开线路与节点；选「朝外」的一侧，保持画面中间干净
  let nx = -dy / len, ny = dx / len
  const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
  const c = centroid.value
  if ((mid.x - c.x) * nx + (mid.y - c.y) * ny < 0) { nx = -nx; ny = -ny }
  const off = 15 * k.value
  return { from: pa, to: pb, mx: mid.x + nx * off, my: mid.y + ny * off }
}

const centroid = computed(() => {
  const pts = nodes.value.map(n => nodeXY(n))
  if (!pts.length) return { x: size.value.w / 2, y: size.value.h / 2 }
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
})

const allNodes = computed(() => props.guide.days.flatMap(d => d.nodes.map(n => ({ ...n, dayIndex: d.dayIndex }))))

const catColor: Record<string, string> = {
  sight: '#8FA9A6', food: '#B08D70', hotel: '#7A8C9E', transport: '#6E6A62', shop: '#B08D70',
}

// 交通图标路径（24x24 视框）
const ICON_PATH: Record<string, string> = {
  drive: 'M5 17h14M6 17v-4l2-5h8l2 5v4M6 13h12',
  walk: 'M13 4.5a1.8 1.8 0 1 0 0 .01M11 21l2-6-3-2 1-5 3 2 2 3M9 21l1-4',
  bike: 'M6 17a3.2 3.2 0 1 0 0 .01M18 17a3.2 3.2 0 1 0 0 .01M6 17l4-7h4l-2 7M10 10l-1-3h4',
}

/** 虚线间隔也要跟着缩放，否则窄屏上虚线会糊成实线 */
function dashOf(mode: string) {
  const d = MODE_STYLE[mode as keyof typeof MODE_STYLE]?.dash || '0'
  if (d === '0') return '0'
  return d.split(' ').map(n => (Number(n) * k.value).toFixed(1)).join(' ')
}

/** 比例尺：把视窗宽度换算成公里，取一个整数距离画成尺子 */
const scaleBar = computed(() => {
  const kmPerPx = (bounds.value.spanX * 111.32) / size.value.w
  const candidates = [20, 10, 5, 3, 2, 1, 0.5, 0.3, 0.2, 0.1, 0.05]
  let km = candidates[0], bestErr = Infinity
  for (const c of candidates) {
    const err = Math.abs(c / kmPerPx - 110 * k.value * 0.7)
    if (err < bestErr) { bestErr = err; km = c }
  }
  return {
    px: km / kmPerPx,
    label: km >= 1 ? `${km} 公里` : `${Math.round(km * 1000)} 米`,
  }
})

/** 远山随画布高度伸缩 */
const mtn1 = computed(() => {
  const { w, h } = size.value
  return `M-40 ${h * 0.74} Q${w * 0.16} ${h * 0.6} ${w * 0.32} ${h * 0.7} T${w * 0.66} ${h * 0.67} T${w + 40} ${h * 0.73} L${w + 40} ${h + 60} L-40 ${h + 60} Z`
})
const mtn2 = computed(() => {
  const { w, h } = size.value
  return `M-40 ${h * 0.84} Q${w * 0.2} ${h * 0.73} ${w * 0.44} ${h * 0.8} T${w * 0.8} ${h * 0.78} T${w + 40} ${h * 0.85} L${w + 40} ${h + 60} L-40 ${h + 60} Z`
})
</script>

<template>
  <div ref="rootEl" class="relative w-full h-full overflow-hidden" style="background: linear-gradient(150deg, #FAF6ED 0%, #F2EAD8 55%, #E5DBC4 100%)">
    <svg :viewBox="`0 0 ${size.w} ${size.h}`" class="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        <radialGradient id="cityGlow" cx="50%" cy="45%" r="72%">
          <stop offset="0%" stop-color="#FAF6ED"/>
          <stop offset="100%" stop-color="#E5DBC4"/>
        </radialGradient>
        <filter id="softBlur"><feGaussianBlur :stdDeviation="24 * k"/></filter>
        <filter id="legShadow"><feDropShadow dx="0" :dy="1 * k" :stdDeviation="1.2 * k" flood-color="#2C2A26" flood-opacity="0.22"/></filter>
      </defs>

      <rect :width="size.w" :height="size.h" fill="url(#cityGlow)"/>

      <!-- 淡墨远山 -->
      <path :d="mtn1" fill="#C9D4D0" opacity="0.35" filter="url(#softBlur)"/>
      <path :d="mtn2" fill="#B9C6C4" opacity="0.28" filter="url(#softBlur)"/>

      <!-- 经纬网格 -->
      <g stroke="#B6AA92" :stroke-width="0.6 * k" opacity="0.16">
        <line v-for="i in 9" :key="'gx'+i" :x1="(size.w / 9) * i" y1="0" :x2="(size.w / 9) * i" :y2="size.h"/>
        <line v-for="i in 7" :key="'gy'+i" x1="0" :y1="(size.h / 6) * i" :x2="size.w" :y2="(size.h / 6) * i"/>
      </g>

      <!-- 非当天淡化节点 -->
      <g opacity="0.22">
        <circle v-for="n in allNodes.filter(n => n.dayIndex !== activeDay)" :key="'d-'+n.id"
                :cx="proj(n.lng, n.lat).x" :cy="proj(n.lng, n.lat).y" :r="4.5 * k" fill="#6E6A62"/>
      </g>

      <!-- 交通线路 -->
      <g v-for="leg in legs" :key="'ln-'+leg.id">
        <template v-if="legGeom(leg)">
          <line
            :x1="legGeom(leg)!.from.x" :y1="legGeom(leg)!.from.y"
            :x2="legGeom(leg)!.to.x" :y2="legGeom(leg)!.to.y"
            :stroke="MODE_STYLE[leg.mode].color"
            :stroke-width="MODE_STYLE[leg.mode].width * k * 0.82"
            :stroke-dasharray="dashOf(leg.mode)"
            stroke-linecap="round"
            filter="url(#legShadow)"
          />
        </template>
      </g>

      <!-- 交通图标 + 时间徽标（画在 SVG 内，与线路严格对齐） -->
      <g v-for="leg in legs" :key="'ic-'+leg.id">
        <template v-if="legGeom(leg)">
          <g :transform="`translate(${legGeom(leg)!.mx - 27 * k}, ${legGeom(leg)!.my - 11 * k})`">
            <rect :width="54 * k" :height="22 * k" :rx="2.5 * k" fill="#FAF6ED" :stroke="MODE_STYLE[leg.mode].color" :stroke-width="1.1 * k"/>
            <!-- 图标 -->
            <g :transform="`translate(${4.6 * k}, ${5.4 * k}) scale(${0.48 * k})`" :stroke="MODE_STYLE[leg.mode].color" fill="none" :stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="leg.mode === 'transit'">
                <rect x="5" y="4" width="14" height="13" rx="2"/><path d="M5 10h14M8 21v-2M16 21v-2"/>
              </template>
              <template v-else-if="leg.mode === 'train'">
                <rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l2-3M15 21l-2-3"/>
              </template>
              <template v-else>
                <path :d="ICON_PATH[leg.mode]"/>
                <circle v-if="leg.mode === 'drive'" cx="8.5" cy="17" r="1.4"/>
                <circle v-if="leg.mode === 'drive'" cx="15.5" cy="17" r="1.4"/>
                <circle v-if="leg.mode === 'walk'" cx="13" cy="4.5" r="1.6"/>
                <circle v-if="leg.mode === 'bike'" cx="6" cy="17" r="2.8"/>
                <circle v-if="leg.mode === 'bike'" cx="18" cy="17" r="2.8"/>
              </template>
            </g>
            <text :x="20.5 * k" :y="15.2 * k" :fill="MODE_STYLE[leg.mode].color" :font-size="11.5 * k" font-family="'Cormorant Garamond',Georgia,serif" font-weight="600">
              {{ leg.durationMin }}′
            </text>
          </g>
        </template>
      </g>

      <!-- 节点 -->
      <g v-for="(n, i) in nodes" :key="n.id" class="cursor-pointer" @click="emit('select-node', n.id)">
        <circle
          :cx="nodeXY(n).x" :cy="nodeXY(n).y" :r="13.5 * k"
          :fill="selectedNodeId === n.id ? '#A64834' : '#FAF6ED'"
          :stroke="selectedNodeId === n.id ? '#8C3A28' : catColor[n.category]"
          :stroke-width="2.4 * k" filter="url(#legShadow)"
        />
        <text :x="nodeXY(n).x" :y="nodeXY(n).y + 4.6 * k" text-anchor="middle"
              :fill="selectedNodeId === n.id ? '#FAF6ED' : '#2C2A26'"
              :font-size="13 * k" font-family="'Cormorant Garamond',Georgia,serif" font-weight="600">{{ i + 1 }}</text>
        <text :x="nodeXY(n).x" :y="nodeXY(n).y - 21 * k" text-anchor="middle"
              :font-size="12.5 * k" font-family="'Noto Serif SC','Songti SC',serif" fill="#2C2A26"
              :stroke="'#FAF6ED'" :stroke-width="4 * k" paint-order="stroke" stroke-linejoin="round">{{ n.shortName }}</text>
      </g>

      <!-- 罗盘（指北） -->
      <g :transform="`translate(${48 * k}, ${64 * k})`" pointer-events="none" opacity="0.9">
        <circle :r="17 * k" fill="#FAF6ED" fill-opacity="0.8" stroke="#B6AA92" :stroke-width="k"/>
        <circle :r="13 * k" fill="none" stroke="#B6AA92" :stroke-width="0.5 * k" :stroke-dasharray="`${2 * k} ${3 * k}`"/>
        <path :d="`M0 ${-11.5 * k} L${3.8 * k} ${2.6 * k} L0 ${-0.4 * k} L${-3.8 * k} ${2.6 * k} Z`" fill="#A64834"/>
        <text :y="-21 * k" text-anchor="middle" :font-size="10 * k" fill="#6B6559" font-family="'Noto Serif SC',serif" letter-spacing="1">北</text>
      </g>

      <!-- 比例尺 -->
      <g :transform="`translate(${size.w - 32 * k - scaleBar.px}, ${size.h - 30 * k})`" pointer-events="none" opacity="0.9">
        <text x="0" :y="-9 * k" :font-size="10 * k" fill="#6B6559" font-family="'Noto Serif SC',serif">{{ scaleBar.label }}</text>
        <line x1="0" y1="0" :x2="scaleBar.px" y2="0" stroke="#57514A" :stroke-width="1.2 * k"/>
        <line x1="0" :y1="-5 * k" x2="0" :y2="5 * k" stroke="#57514A" :stroke-width="1.2 * k"/>
        <line :x1="scaleBar.px" :y1="-5 * k" :x2="scaleBar.px" :y2="5 * k" stroke="#57514A" :stroke-width="1.2 * k"/>
        <line :x1="scaleBar.px / 2" :y1="-3.5 * k" :x2="scaleBar.px / 2" :y2="3.5 * k" stroke="#57514A" :stroke-width="0.8 * k"/>
        <rect x="0" :y="-2 * k" :width="scaleBar.px / 2" :height="2 * k" fill="#57514A" opacity="0.55"/>
      </g>
    </svg>

    <!-- 空状态 -->
    <div v-if="nodes.length === 0" class="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
      <div class="text-center">
        <div class="seal w-14 h-14 text-xl mx-auto mb-3 animate-seal-in">始</div>
        <p class="font-brush text-lg text-ink/70">从左侧景点库选一处风景，开始行程</p>
        <p class="font-cn text-[11px] text-inkLight mt-1 leading-relaxed">点两处之间的交通标签，可切换打车 / 步行 / 骑行 / 公交</p>
      </div>
    </div>
  </div>
</template>
