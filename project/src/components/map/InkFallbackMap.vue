<script setup lang="ts">
/**
 * 无 Key / GL 失败时的地理底：按真实经纬度投影山、水，不再画与现实无关的示意街区。
 */
import { computed } from 'vue'
import { project, type MapBounds } from '../../lib/projection'
import { geoForCity, type GeoNamedRing } from '../../data/geoFeatures'
import type { LngLat } from '../../types'

const props = withDefaults(defineProps<{
  width: number
  height: number
  k: number
  bounds: MapBounds
  city?: string
}>(), { city: '' })

const geo = computed(() => geoForCity(props.city || ''))

function pathOf(ring: LngLat[]) {
  return ring.map((p, i) => {
    const xy = project(p, props.bounds, props.width, props.height)
    return `${i ? 'L' : 'M'}${xy.x.toFixed(1)} ${xy.y.toFixed(1)}`
  }).join(' ') + ' Z'
}

function labelAt(ring: LngLat[]) {
  const n = ring.length || 1
  const c = ring.reduce((s, p) => ({ lng: s.lng + p.lng / n, lat: s.lat + p.lat / n }), { lng: 0, lat: 0 })
  return project(c, props.bounds, props.width, props.height)
}

const waters = computed(() => (geo.value?.water || []).map(g => ({ ...g, d: pathOf(g.ring), label: labelAt(g.ring) })))
const hills = computed(() => (geo.value?.hills || []).map(g => ({ ...g, d: pathOf(g.ring), label: labelAt(g.ring) })))

function named(g: GeoNamedRing & { d: string }) { return g.name }
</script>

<template>
  <svg
    class="absolute inset-0 w-full h-full pointer-events-none"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="geo-paper" cx="42%" cy="38%" r="78%">
        <stop offset="0%" stop-color="#FAF4E6" />
        <stop offset="70%" stop-color="#F1E7D3" />
        <stop offset="100%" stop-color="#E6D9C0" />
      </radialGradient>
      <linearGradient id="geo-water" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8FB8AC" />
        <stop offset="100%" stop-color="#5A8A7E" />
      </linearGradient>
      <linearGradient id="geo-hill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3F5F57" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#A8C0B6" stop-opacity="0.25" />
      </linearGradient>
    </defs>

    <rect :width="width" :height="height" fill="url(#geo-paper)" />

    <path v-for="h in hills" :key="named(h)" :d="h.d" fill="url(#geo-hill)" stroke="#243F39" :stroke-width="1.2 * k" opacity="0.85" />
    <path v-for="w in waters" :key="named(w)" :d="w.d" fill="url(#geo-water)" stroke="#2A524C" :stroke-width="1.4 * k" opacity="0.88" />

    <text
      v-for="w in waters" :key="`wl-${w.name}`"
      :x="w.label.x" :y="w.label.y"
      text-anchor="middle"
      :font-size="13 * k" fill="#2F5A52" opacity="0.8"
      font-family="'Ma Shan Zheng','KaiTi',serif"
    >{{ w.name }}</text>
    <text
      v-for="h in hills" :key="`hl-${h.name}`"
      :x="h.label.x" :y="h.label.y"
      text-anchor="middle"
      :font-size="12 * k" fill="#2F544C" opacity="0.75"
      font-family="'Ma Shan Zheng','KaiTi',serif"
    >{{ h.name }}</text>
  </svg>
</template>
