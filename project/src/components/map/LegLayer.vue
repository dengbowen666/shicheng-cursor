<script setup lang="ts">
/**
 * L04：城际线段图层——与市内 POI 连线（RouteLayer）区分：
 * 朱砂系长虚线 + 端点城名 + 方式/车次牌；线可点选进入 LegEditor。
 * 当日模式下到达城常在视野外，线段裁剪到画布边缘并画方向箭头，不把市内行程挤小。
 */
import { computed } from 'vue'
import type { City, Leg, LngLat } from '../../types'
import { LEG_MODE_COLOR, LEG_MODE_LABEL } from '../../types'
import { project, type MapBounds } from '../../lib/projection'

type Pt = { x: number; y: number }

const props = defineProps<{
  legs: Leg[]
  cities: City[]
  bounds: MapBounds
  width: number
  height: number
  k: number
  viewMode: 'day' | 'all'
}>()
const emit = defineEmits<{ (e: 'select-leg', id: string): void }>()

const C = {
  mist: '#FAF6ED', ink: '#2C2A26', cinnabar: '#A64834', cinnabarDeep: '#8C3A28',
}
function centerOf(name: string): LngLat | undefined {
  return props.cities.find(c => c.name === name)?.center
}

/** Liang–Barsky 线段裁剪到画布矩形，返回可见段端点；完全在外返回 null */
function clip(p0: Pt, p1: Pt): [Pt, Pt] | null {
  const xmin = 0, xmax = props.width, ymin = 0, ymax = props.height
  let t0 = 0, t1 = 1
  const dx = p1.x - p0.x, dy = p1.y - p0.y
  const checks: [number, number][] = [
    [-dx, p0.x - xmin], [dx, xmax - p0.x], [-dy, p0.y - ymin], [dy, ymax - p0.y],
  ]
  for (const [p, q] of checks) {
    if (p === 0) { if (q < 0) return null; continue }
    const r = q / p
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r }
    else { if (r < t0) return null; if (r < t1) t1 = r }
  }
  const at = (t: number): Pt => ({ x: p0.x + t * dx, y: p0.y + t * dy })
  return [at(t0), at(t1)]
}

type Geom = {
  leg: Leg
  a: Pt
  b: Pt
  d: string
  mid: Pt
  color: string
  clipped: boolean
  dirAngle: number
}

const geoms = computed<Geom[]>(() => {
  const out: Geom[] = []
  for (const leg of props.legs) {
    const ca = centerOf(leg.fromCity), cb = centerOf(leg.toCity)
    if (!ca || !cb) continue
    const pa = project(ca, props.bounds, props.width, props.height)
    const pb = project(cb, props.bounds, props.width, props.height)
    const seg = clip(pa, pb)
    if (!seg) continue
    const [a, b] = seg
    const clipped = Math.abs(a.x - pa.x) > 0.5 || Math.abs(a.y - pa.y) > 0.5 ||
      Math.abs(b.x - pb.x) > 0.5 || Math.abs(b.y - pb.y) > 0.5
    out.push({
      leg, a, b,
      d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      color: LEG_MODE_COLOR[leg.mode],
      clipped,
      dirAngle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
    })
  }
  return out
})
</script>

<template>
  <svg
    class="absolute inset-0 w-full h-full pointer-events-none"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
  >
    <g v-for="g in geoms" :key="g.leg.id">
      <!-- 透明加粗命中区 -->
      <path
        :d="g.d" fill="none" stroke="transparent" :stroke-width="Math.max(12, 12 * k)"
        pointer-events="stroke" data-map-interactive class="cursor-pointer"
        @click.stop="emit('select-leg', g.leg.id)"
      />
      <!-- 底衬（宣纸留白感） -->
      <path :d="g.d" fill="none" :stroke="C.mist" :stroke-width="Math.max(4, 4.4 * k)" stroke-linecap="round" opacity="0.9" />
      <!-- 朱砂长虚线 -->
      <path
        :d="g.d" fill="none" :stroke="g.color" :stroke-width="Math.max(1.8, 2 * k)"
        :stroke-dasharray="`${10 * k} ${7 * k}`" stroke-linecap="round" opacity="0.92"
      />
      <!-- 两端城名（未被裁剪时） -->
      <template v-if="!g.clipped">
        <g :transform="`translate(${g.a.x}, ${g.a.y})`" pointer-events="none">
          <circle :r="3.2 * k" :fill="C.mist" :stroke="g.color" :stroke-width="1.5 * k" />
          <text :y="-7 * k" text-anchor="middle" :font-size="11 * k" :fill="C.ink" :stroke="C.mist" :stroke-width="3 * k" paint-order="stroke" font-family="'Noto Serif SC','Songti SC',serif">{{ g.leg.fromCity }}</text>
        </g>
        <g :transform="`translate(${g.b.x}, ${g.b.y})`" pointer-events="none">
          <circle :r="3.2 * k" :fill="g.color" />
          <text :y="-7 * k" text-anchor="middle" :font-size="11 * k" :fill="g.color" :stroke="C.mist" :stroke-width="3 * k" paint-order="stroke" font-family="'Noto Serif SC','Songti SC',serif">{{ g.leg.toCity }}</text>
        </g>
      </template>
      <!-- 裁剪到边缘时的方向箭头 -->
      <g v-else :transform="`translate(${g.b.x}, ${g.b.y}) rotate(${g.dirAngle})`" pointer-events="none">
        <path :d="`M${2 * k} 0 L${-7 * k} ${-5 * k} L${-7 * k} ${5 * k} Z`" :fill="g.color" />
      </g>

      <!-- 方式/车次牌 -->
      <g
        data-map-interactive pointer-events="auto" class="cursor-pointer"
        :transform="`translate(${g.mid.x}, ${g.mid.y})`"
        @click.stop="emit('select-leg', g.leg.id)"
      >
        <rect :x="-30 * k" :y="-11 * k" :width="60 * k" :height="22 * k" :rx="3 * k" :fill="C.mist" :stroke="g.color" :stroke-width="1.1 * k" />
        <text :x="-21 * k" :y="4.2 * k" text-anchor="middle" :fill="g.color" :font-size="10 * k" font-family="'Noto Serif SC','Songti SC',serif">{{ LEG_MODE_LABEL[g.leg.mode] }}</text>
        <text v-if="g.leg.note" :x="4 * k" :y="4 * k" text-anchor="middle" :fill="C.ink" :font-size="9.5 * k" font-family="'Cormorant Garamond',Georgia,serif" font-weight="600">{{ g.leg.note }}</text>
        <text v-else :x="4 * k" :y="4 * k" text-anchor="middle" :fill="C.ink" :font-size="9.5 * k" font-family="'Noto Serif SC','Songti SC',serif">{{ g.leg.departTime || '→' }}</text>
      </g>
    </g>
  </svg>
</template>
