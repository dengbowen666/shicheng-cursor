<script setup lang="ts">
/**
 * 交通段沿线动画：小车 / 脚印 / 单车 / 公交，沿 path 点列插值移动（D22、D54）。
 * 低端机或 reduced-motion 降级为静态图标（停在线路中点），保留静态样式线 + 时长牌。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Bike, Bus, Car, Footprints } from 'lucide-vue-next'
import type { TransportMode } from '../../types'
import { moveAlong } from '../../lib/motion'

type Pt = { x: number; y: number }

const props = withDefaults(defineProps<{
  points: Pt[]
  mode: TransportMode
  k: number
  playing?: boolean
}>(), { playing: true })

const pathRef = ref<SVGPathElement | null>(null)
const markerRef = ref<SVGGElement | null>(null)

const COLOR: Record<TransportMode, string> = {
  taxi: '#A64834', walk: '#8FA9A6', transit: '#B9C6C4', bike: '#6E8B88',
}
const DURATION: Record<TransportMode, number> = {
  taxi: 2600, walk: 3600, transit: 3000, bike: 3200,
}
const ICON = { taxi: Car, walk: Footprints, transit: Bus, bike: Bike }
const icon = computed(() => ICON[props.mode])
const color = computed(() => COLOR[props.mode])
const size = computed(() => 18 * props.k)

const pathD = computed(() => {
  const pts = props.points
  if (!pts.length) return ''
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y} L${pts[0].x} ${pts[0].y}`
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
})

let cancel: (() => void) | null = null
let timer: number | null = null
let disposed = false

function placeStatic() {
  const marker = markerRef.value
  const pts = props.points
  if (!marker || !pts.length) return
  const p = pts[Math.floor(pts.length / 2)]
  marker.setAttribute('transform', `translate(${p.x}, ${p.y})`)
}

function start() {
  cancel?.()
  if (timer !== null) { window.clearTimeout(timer); timer = null }
  const pathEl = pathRef.value
  const marker = markerRef.value
  if (!props.playing || !pathEl || !marker || props.points.length < 2) {
    placeStatic()
    return
  }
  // reduced-motion / 低端机降级
  const nav = navigator as Navigator & { deviceMemory?: number }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || (nav.deviceMemory && nav.deviceMemory <= 2)) {
    placeStatic()
    return
  }
  const loop = () => {
    cancel = moveAlong(marker, pathEl, DURATION[props.mode], () => {
      if (disposed) return
      timer = window.setTimeout(() => { if (!disposed) loop() }, 700)
    })
  }
  loop()
}

onMounted(start)
onBeforeUnmount(() => {
  disposed = true
  cancel?.()
  if (timer !== null) window.clearTimeout(timer)
})
watch(() => props.points, start, { deep: true })
watch(() => props.playing, start)
</script>

<template>
  <g data-map-interactive pointer-events="none">
    <path ref="pathRef" :d="pathD" fill="none" stroke="none" />
    <g ref="markerRef">
      <g :transform="`translate(${-size / 2}, ${-size / 2})`">
        <component :is="icon" :size="size" :stroke-width="1.8" :color="color" />
      </g>
    </g>
  </g>
</template>
