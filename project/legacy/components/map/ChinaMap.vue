<script setup lang="ts">
import { ref, computed } from 'vue'
import chinaPaths from '../../data/china-paths.json'
import { PROVINCE_SHORT } from '../../mock/cities'

const props = defineProps<{
  focusProvince: string | null
}>()

const emit = defineEmits<{
  (e: 'select-province', name: string): void
}>()

const hovered = ref<string | null>(null)
const provinces = chinaPaths.provinces
const nanhai = chinaPaths.nanhai
const VB = { w: 1000, h: 800 }

function bboxOf(d: string) {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) || []
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i], y = nums[i + 1]
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

const view = computed(() => {
  const identity = { str: 'translate(0px, 0px) scale(1)', scale: 1 }
  if (!props.focusProvince) return identity
  const p = provinces.find(pr => pr.name === props.focusProvince)
  if (!p) return identity
  const bb = bboxOf(p.d)
  const pad = Math.max(bb.w, bb.h) * 0.28
  const w = bb.w + pad * 2, h = bb.h + pad * 2
  const s = Math.min(VB.w / w, VB.h / h) * 0.94
  const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2
  const tx = VB.w / 2 - cx * s
  const ty = VB.h / 2 - cy * s
  // 注意：CSS transform 的长度必须带单位，否则整条 transform 会被丢弃
  return { str: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(3)})`, scale: s }
})

// 标签字号随缩放反补，保持视觉恒定
const labelSize = computed(() => Math.min(13, 12 / Math.max(0.5, view.value.scale)))
</script>

<template>
  <svg :viewBox="`0 0 ${VB.w} ${VB.h}`" class="w-full h-full block" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="seaPaper" cx="50%" cy="42%" r="68%">
        <stop offset="0%" stop-color="#F8F2E4"/>
        <stop offset="100%" stop-color="#EADFC8"/>
      </radialGradient>
      <filter id="mapShadow"><feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#5A5449" flood-opacity="0.18"/></filter>
      <filter id="insetShadow" x="-20%" y="-8%" width="140%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#5A5449" flood-opacity="0.16"/>
      </filter>
    </defs>

    <rect :width="VB.w" :height="VB.h" fill="url(#seaPaper)"/>

    <!-- 海面淡墨波纹（装饰） -->
    <g stroke="#C6BDAA" stroke-width="0.8" fill="none" opacity="0.35">
      <path d="M60 700 q30 -8 60 0 t60 0"/>
      <path d="M120 730 q30 -8 60 0 t60 0"/>
      <path d="M760 690 q30 -8 60 0 t60 0"/>
      <path d="M820 720 q30 -8 60 0 t60 0"/>
    </g>

    <g :style="{ transform: view.str, transformOrigin: '0 0', transition: 'transform 0.62s cubic-bezier(0.34,0.02,0.2,1)' }">
      <!-- 省界 -->
      <g filter="url(#mapShadow)">
        <path
          v-for="p in provinces"
          :key="p.adcode"
          :d="p.d"
          :fill="focusProvince === p.name ? '#A64834' : hovered === p.name ? '#8FA9A6' : '#F1E8D6'"
          :fill-opacity="focusProvince === p.name ? 0.4 : hovered === p.name ? 0.48 : 1"
          :stroke="focusProvince === p.name ? '#8C3A28' : '#6E6A62'"
          :stroke-width="(focusProvince === p.name ? 1.8 : 1.1) / view.scale"
          stroke-linejoin="round"
          class="cursor-pointer transition-all duration-300"
          @mouseenter="hovered = p.name"
          @mouseleave="hovered = null"
          @click="emit('select-province', p.name)"
        >
          <title>{{ PROVINCE_SHORT[p.name] || p.name }}</title>
        </path>
      </g>

      <!-- 省名标注 -->
      <g font-family="'Noto Serif SC','Songti SC',serif" pointer-events="none">
        <text
          v-for="p in provinces"
          :key="'t' + p.adcode"
          :x="p.cx"
          :y="p.cy"
          :font-size="labelSize"
          :fill="hovered === p.name || focusProvince === p.name ? '#8C3A28' : '#6B6559'"
          text-anchor="middle"
          :opacity="hovered === p.name || focusProvince === p.name ? 1 : 0.72"
          style="transition: fill 0.25s, opacity 0.25s; pointer-events: none"
        >
          {{ (PROVINCE_SHORT[p.name] || p.name).replace('特别行政区', '') }}
        </text>
      </g>
    </g>

    <!-- 南海诸岛插图（制图惯例：独立小图，比例尺不同，置于左下空海域，不遮挡任何领土） -->
    <g
      transform="translate(14, 560) scale(0.78)" pointer-events="none"
      :style="{ opacity: focusProvince ? 0 : 1, transition: 'opacity 0.35s' }"
    >
      <rect x="-9" y="-9" width="228" height="298" fill="#FAF6ED" filter="url(#insetShadow)"/>
      <rect x="-9" y="-9" width="228" height="298" fill="none" stroke="#8A8275" stroke-width="0.9"/>
      <rect x="-4" y="-4" width="218" height="288" fill="none" stroke="#B6AA92" stroke-width="0.55" stroke-dasharray="3 3"/>
      <path :d="nanhai" fill="#EFE5D0" stroke="#57514A" stroke-width="0.7" stroke-linejoin="round"/>
      <text x="0" y="276" font-size="11" fill="#6B6559" font-family="'Noto Serif SC','Songti SC',serif" letter-spacing="1.2">南海诸岛</text>
      <text x="208" y="276" font-size="8.5" fill="#8A8275" text-anchor="end" font-family="'Noto Serif SC',serif">比例尺不同</text>
    </g>

    <!-- 卷轴闲章 -->
    <g
      transform="translate(920, 704) rotate(6)" pointer-events="none"
      :style="{ opacity: focusProvince ? 0 : 0.85, transition: 'opacity 0.35s' }"
    >
      <rect width="46" height="46" rx="2" fill="#A64834" opacity="0.8"/>
      <text x="23" y="20" font-size="15" fill="#F7EFE0" text-anchor="middle" font-family="'Ma Shan Zheng','KaiTi',serif">九州</text>
      <text x="23" y="38" font-size="15" fill="#F7EFE0" text-anchor="middle" font-family="'Ma Shan Zheng','KaiTi',serif">行旅</text>
    </g>
  </svg>
</template>
