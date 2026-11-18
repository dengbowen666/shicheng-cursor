<script setup lang="ts">
/**
 * 交通线路图层（D22）：
 * taxi  淡赭 #B08D70 实线 + 朱砂小车
 * walk  天青 #8FA9A6 虚线 + 脚印/小人
 * transit 青灰 #B9C6C4 双线 + 站点圆点 + 车次牌
 * bike  细线 + 单车
 * 每段挂「N′」时长牌，estimated=true 挂朱砂「估」小字。
 */
import { computed } from 'vue'
import type { POI, TransportSegment } from '../../types'
import { MODE_COLOR } from '../../types'
import { project, type MapBounds } from '../../lib/projection'
import SegmentAnimator from './SegmentAnimator.vue'

type Pt = { x: number; y: number }
type Geom = {
  seg: TransportSegment
  pts: Pt[]
  d: string
  badge: Pt
  nx: number
  ny: number
}

const props = defineProps<{
  segments: TransportSegment[]
  pois: Record<string, POI>
  bounds: MapBounds
  width: number
  height: number
  k: number
  playing?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-segment', id: string): void
}>()

const C = {
  mist: '#FAF6ED', ink: '#2C2A26', cinnabar: '#A64834', cinnabarDeep: '#8C3A28', hill: '#B9C6C4',
}

const centroid = computed<Pt>(() => {
  const pts = Object.values(props.pois).map(p => project(p.location, props.bounds, props.width, props.height))
  if (!pts.length) return { x: props.width / 2, y: props.height / 2 }
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
})

const geoms = computed<Geom[]>(() => {
  const out: Geom[] = []
  for (const seg of props.segments) {
    const from = props.pois[seg.fromPoiId]
    const to = props.pois[seg.toPoiId]
    if (!from || !to) continue
    let pts: Pt[]
    if (seg.path && seg.path.length >= 2) {
      pts = seg.path.map(p => project(p, props.bounds, props.width, props.height))
    } else {
      pts = [project(from.location, props.bounds, props.width, props.height), project(to.location, props.bounds, props.width, props.height)]
    }
    if (pts.length < 2) continue
    const a = pts[0], b = pts[pts.length - 1]
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    let nx = -dy / len, ny = dx / len
    const mid = pts[Math.floor(pts.length / 2)]
    // 徽标朝线路「外侧」偏移，保持画面中间干净
    if ((mid.x - centroid.value.x) * nx + (mid.y - centroid.value.y) * ny < 0) { nx = -nx; ny = -ny }
    const off = 19 * props.k
    out.push({
      seg, pts,
      d: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
      badge: { x: mid.x + nx * off, y: mid.y + ny * off },
      nx, ny,
    })
  }
  return out
})

/** 虚线间隔随 k 缩放，避免窄屏糊成实线 */
function dash(mode: string) {
  if (mode !== 'walk') return '0'
  return `${8 * props.k} ${6 * props.k}`
}
function strokeWidth(mode: string) {
  if (mode === 'taxi') return 4 * props.k
  if (mode === 'bike') return 2 * props.k
  if (mode === 'transit') return 2.2 * props.k
  return 2.4 * props.k
}

/** 公交换乘站点：有 path 时按间隔抽样，否则取两端 */
function stations(g: Geom) {
  if (g.seg.path && g.pts.length > 6) {
    return g.pts.filter((_, i) => i % Math.ceil(g.pts.length / 6) === 0 || i === g.pts.length - 1)
  }
  return [g.pts[0], g.pts[g.pts.length - 1]]
}
</script>

<template>
  <svg
    class="absolute inset-0 w-full h-full pointer-events-none"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
  >
    <g v-for="g in geoms" :key="g.seg.id">
      <!-- 透明加粗命中区，便于点线路切换交通方式 -->
      <path
        :d="g.d" fill="none" stroke="transparent" :stroke-width="Math.min(10 * k, 12)"
        pointer-events="stroke" data-map-interactive class="cursor-pointer"
        @click.stop="emit('select-segment', g.seg.id)"
      />

      <!-- taxi：淡赭实线 -->
      <path
        v-if="g.seg.mode === 'taxi'"
        :d="g.d" fill="none" :stroke="MODE_COLOR.taxi" :stroke-width="strokeWidth(g.seg.mode)"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.92"
      />

      <!-- walk：天青虚线 -->
      <path
        v-else-if="g.seg.mode === 'walk'"
        :d="g.d" fill="none" :stroke="MODE_COLOR.walk" :stroke-width="strokeWidth(g.seg.mode)"
        :stroke-dasharray="dash(g.seg.mode)" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"
      />

      <!-- transit：青灰双线 + 站点圆点 -->
      <template v-else-if="g.seg.mode === 'transit'">
        <path
          :d="g.d" fill="none" :stroke="MODE_COLOR.transit" :stroke-width="strokeWidth(g.seg.mode)"
          :transform="`translate(${(g.nx * 2.2 * k).toFixed(2)}, ${(g.ny * 2.2 * k).toFixed(2)})`"
          stroke-linecap="round" stroke-linejoin="round"
        />
        <path
          :d="g.d" fill="none" :stroke="MODE_COLOR.transit" :stroke-width="strokeWidth(g.seg.mode)"
          :transform="`translate(${(-g.nx * 2.2 * k).toFixed(2)}, ${(-g.ny * 2.2 * k).toFixed(2)})`"
          stroke-linecap="round" stroke-linejoin="round"
        />
        <circle
          v-for="(p, i) in stations(g)" :key="'st' + i"
          :cx="p.x" :cy="p.y" :r="3.4 * k" :fill="C.mist" :stroke="MODE_COLOR.transit" :stroke-width="1.6 * k"
        />
      </template>

      <!-- bike：细线 -->
      <path
        v-else
        :d="g.d" fill="none" :stroke="MODE_COLOR.bike" :stroke-width="strokeWidth(g.seg.mode)"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.9"
      />

      <!-- 沿线运动图标 -->
      <SegmentAnimator :points="g.pts" :mode="g.seg.mode" :k="k" :playing="playing !== false" />

      <!-- 时长牌「N′」 + 估小字 + 车次牌 -->
      <g
        data-map-interactive pointer-events="auto" class="cursor-pointer"
        :transform="`translate(${g.badge.x - 24 * k}, ${g.badge.y - 11 * k})`"
        @click.stop="emit('select-segment', g.seg.id)"
      >
        <rect :width="48 * k" :height="22 * k" :rx="3 * k" :fill="C.mist" :stroke="MODE_COLOR[g.seg.mode]" :stroke-width="1.1 * k" />
        <text
          :x="24 * k" :y="15.4 * k" text-anchor="middle"
          :fill="MODE_COLOR[g.seg.mode]" :font-size="12.5 * k"
          font-family="'Cormorant Garamond',Georgia,serif" font-weight="600"
        >{{ g.seg.durationMin }}′</text>
        <text
          v-if="g.seg.estimated"
          :x="52 * k" :y="15 * k" :font-size="10 * k" :fill="C.cinnabar"
          font-family="'Noto Serif SC','Songti SC',serif"
        >估</text>
        <text
          v-if="g.seg.mode === 'transit' && g.seg.lineNos?.length"
          :x="24 * k" :y="-5 * k" text-anchor="middle" :font-size="9 * k" :fill="C.ink"
          font-family="'Noto Serif SC','Songti SC',serif"
        >{{ g.seg.lineNos.join('/') }}</text>
      </g>
    </g>
  </svg>
</template>
