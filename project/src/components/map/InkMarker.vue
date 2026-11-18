<script setup lang="ts">
/**
 * POI 篆刻印章标记（D45）：方形印文 + 按类着色（景点墨 / 美食赭 / 酒店青）+ 毛笔小楷注名。
 * 不用气泡 pin，不使用 emoji；仅 lucide 作功能图标（本组件纯装饰印章，无需图标）。
 */
import { computed } from 'vue'
import { CATEGORY_LABEL, type POI } from '../../types'
import { project, type MapBounds } from '../../lib/projection'

const props = withDefaults(defineProps<{
  pois: POI[]
  bounds: MapBounds
  width: number
  height: number
  k: number
  selectedId?: string | null
  ghost?: boolean
}>(), { selectedId: null, ghost: false })

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const C = {
  mist: '#FAF6ED', ink: '#2C2A26', grayInk: '#6E6A62',
  cinnabar: '#A64834', cinnabarDeep: '#8C3A28', cyanq: '#8FA9A6', ochre: '#B08D70',
}

const CAT_COLOR: Record<string, string> = {
  sight: C.ink, food: C.ochre, hotel: C.cyanq, shop: C.ochre, custom: C.grayInk,
}

const markers = computed(() => {
  const k = props.k
  const list = props.pois.map(poi => {
    const xy = project(poi.location, props.bounds, props.width, props.height)
    // 贴边的印章把注名往里收，避免被画布裁掉
    const margin = 70 * k
    const anchor: 'start' | 'middle' | 'end' =
      xy.x < margin ? 'start' : xy.x > props.width - margin ? 'end' : 'middle'
    return {
      poi,
      xy,
      anchor,
      labelX: anchor === 'start' ? -9 * k : anchor === 'end' ? 9 * k : 0,
      showLabel: true,
      color: CAT_COLOR[poi.category] || C.grayInk,
    }
  })

  // 注名互相压字时，靠后的只留印章，避免文字叠成一团
  const taken: { x1: number; x2: number; y1: number; y2: number }[] = []
  for (const m of list) {
    const fs = 12.5 * k
    const w = m.poi.name.length * fs * 0.96
    const cx = m.xy.x + m.labelX
    const x1 = m.anchor === 'start' ? cx : m.anchor === 'end' ? cx - w : cx - w / 2
    const box = { x1, x2: x1 + w, y1: m.xy.y - 30 * k, y2: m.xy.y - 6 * k }
    const hit = taken.some(t => box.x1 < t.x2 && box.x2 > t.x1 && box.y1 < t.y2 && box.y2 > t.y1)
    if (hit) m.showLabel = false
    else taken.push(box)
  }
  return list
})
</script>

<template>
  <svg
    class="absolute inset-0 w-full h-full pointer-events-none"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
  >
    <g
      v-for="m in markers"
      :key="m.poi.id"
      data-map-interactive
      pointer-events="auto"
      :class="['poi-marker', 'cursor-pointer', { 'is-selected': selectedId === m.poi.id }]"
      @pointerdown.stop
      @click.stop="emit('select', m.poi.id)"
    >
      <title>{{ m.poi.name }}</title>
      <!-- 外层只负责位移，动画放在内层，避免 CSS transform 覆盖 SVG transform 把印章甩到原点 -->
      <g :transform="`translate(${m.xy.x}, ${m.xy.y})`">
        <!-- 放大命中区：印章本身约 22px，手指/鼠标不容易点中 -->
        <circle :r="(ghost ? 22 : 30) * k" fill="transparent" />
        <g :class="selectedId === m.poi.id ? 'pin-pulse' : ''" :opacity="ghost ? 0.78 : 1">
          <rect
            :x="(ghost ? -8 : -11) * k" :y="(ghost ? -8 : -11) * k"
            :width="(ghost ? 16 : 22) * k" :height="(ghost ? 16 : 22) * k" :rx="2 * k"
            :fill="selectedId === m.poi.id ? C.cinnabar : C.mist"
            :stroke="selectedId === m.poi.id ? C.cinnabarDeep : m.color"
            :stroke-width="(ghost ? 1.2 : 2) * k"
            :stroke-dasharray="ghost ? `${2.2 * k} ${1.8 * k}` : '0'"
          />
          <text
            :y="(ghost ? 4 : 5.4) * k" text-anchor="middle"
            :font-size="(ghost ? 10 : 13) * k"
            :fill="selectedId === m.poi.id ? C.mist : m.color"
            font-family="'Ma Shan Zheng','KaiTi','Noto Serif SC',serif"
          >{{ CATEGORY_LABEL[m.poi.category] || '自' }}</text>
        </g>

        <text
          v-if="m.showLabel"
          :class="ghost ? 'marker-label ghost-label' : 'marker-label'"
          :x="m.labelX" :y="(ghost ? -13 : -17) * k" :text-anchor="m.anchor"
          :font-size="(ghost ? 10 : 12.5) * k"
          :fill="selectedId === m.poi.id ? C.cinnabarDeep : C.ink"
          :stroke="C.mist" :stroke-width="4 * k" paint-order="stroke" stroke-linejoin="round"
          font-family="'Noto Serif SC','Songti SC',serif"
        >{{ m.poi.name }}</text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
/* 推荐地点平时只留方印，悬浮或选中才显名，地图不再被一整片字盖住 */
.ghost-label {
  opacity: 0;
  transition: opacity 0.16s ease-out;
}
.poi-marker:hover .ghost-label,
.poi-marker.is-selected .ghost-label {
  opacity: 1;
}
@media (hover: none) {
  .ghost-label { opacity: 0.85; }
}
</style>
