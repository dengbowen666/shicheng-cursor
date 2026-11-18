<script setup lang="ts">
import { computed } from 'vue'

/**
 * 水墨山水封面：不依赖外部图片，按城市名取一套色，生成「远山—中景—近岸」三层景深。
 * 避免直接用网络城市照片出现张冠李戴，也与全站宣纸水墨风格一致。
 */
const props = defineProps<{ city: string }>()

const PALETTES = [
  { sky: ['#FBF7EC', '#D6E3DE'], far: '#AFBFBC', mid: '#7E9E9A', near: '#4E6E6C', sun: '#C08A3E' }, // 青绿
  { sky: ['#FCF6E9', '#E6D3B8'], far: '#C6B393', mid: '#A57C58', near: '#6E4F33', sun: '#A64834' }, // 赭石
  { sky: ['#F8F4EC', '#D8DED6'], far: '#B7C2B4', mid: '#8AA18C', near: '#546B58', sun: '#B08D70' }, // 松烟
  { sky: ['#FDF4E7', '#E4CFB8'], far: '#CFB593', mid: '#AC7F56', near: '#734F31', sun: '#8C3A28' }, // 檀
  { sky: ['#F6F4EE', '#D5DFE4'], far: '#B2C2CA', mid: '#7E97A4', near: '#4C6674', sun: '#C9A24A' }, // 黛蓝
]

const p = computed(() => {
  const sum = [...props.city].reduce((s, c) => s + c.charCodeAt(0), 0)
  return PALETTES[sum % PALETTES.length]
})
const uid = computed(() => 'cv-' + [...props.city].map(c => c.charCodeAt(0).toString(36)).join(''))
</script>

<template>
  <svg class="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient :id="uid + '-sky'" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="p.sky[0]"/>
        <stop offset="100%" :stop-color="p.sky[1]"/>
      </linearGradient>
      <filter :id="uid + '-blur'"><feGaussianBlur stdDeviation="7"/></filter>
      <filter :id="uid + '-soft'"><feGaussianBlur stdDeviation="2.2"/></filter>
    </defs>

    <rect width="400" height="200" :fill="`url(#${uid}-sky)`"/>

    <!-- 日/月 -->
    <circle cx="306" cy="50" r="12" :fill="p.sun" opacity="0.34"/>
    <circle cx="306" cy="50" r="20" :fill="p.sun" opacity="0.1"/>

    <!-- 远山（雾里） -->
    <path d="M-20 132 Q40 78 96 108 T196 92 T300 106 T420 84 L420 220 L-20 220 Z" :fill="p.far" opacity="0.6" :filter="`url(#${uid}-soft)`"/>
    <!-- 中景 -->
    <path d="M-20 152 Q56 108 128 136 Q196 162 248 128 Q312 90 420 134 L420 220 L-20 220 Z" :fill="p.mid" opacity="0.86"/>
    <!-- 近岸 -->
    <path d="M-20 178 Q72 156 156 172 Q252 190 320 168 Q376 152 420 168 L420 220 L-20 220 Z" :fill="p.near" opacity="0.95"/>

    <!-- 云雾 -->
    <ellipse cx="120" cy="146" rx="112" ry="15" fill="#FFFFFF" opacity="0.32" :filter="`url(#${uid}-blur)`"/>
    <ellipse cx="300" cy="160" rx="96" ry="12" fill="#FFFFFF" opacity="0.26" :filter="`url(#${uid}-blur)`"/>

    <!-- 水纹 -->
    <g :stroke="p.near" stroke-width="0.8" fill="none" opacity="0.35">
      <path d="M28 188 q18 -4 36 0 t36 0"/>
      <path d="M300 190 q18 -4 36 0 t36 0"/>
    </g>
  </svg>
</template>
