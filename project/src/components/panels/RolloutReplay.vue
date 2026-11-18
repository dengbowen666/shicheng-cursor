<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  X, Car, Pause, Play, RotateCcw, SkipBack, SkipForward,
  MapPin, Info, Flag, Clock,
} from 'lucide-vue-next'
import type { Trip, POI } from '../../types'
import { fitBounds, project } from '../../lib/projection'

const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ close: [] }>()

const W = 1000
const H = 560

interface RouteItem { poi: POI; dayIndex: number }
const route = computed<RouteItem[]>(() => {
  const out: RouteItem[] = []
  for (const d of props.trip.days) {
    for (const id of d.poiIds) {
      const p = props.trip.pois[id]
      if (!p || p.role === 'base') continue
      out.push({ poi: p, dayIndex: d.dayIndex })
    }
  }
  return out
})
const bounds = computed(() => fitBounds(route.value.map(r => r.poi.location), W, H, 1.22))
const points = computed(() => route.value.map(r => ({
  ...project(r.poi.location, bounds.value, W, H),
  poi: r.poi, dayIndex: r.dayIndex,
})))

const cumulative = computed(() => {
  const c = [0]
  for (let i = 1; i < points.value.length; i++) {
    const a = points.value[i - 1], b = points.value[i]
    c.push(c[i - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  return c
})
const totalLen = computed(() => cumulative.value[cumulative.value.length - 1] || 1)
const totalMs = computed(() => Math.min(40000, Math.max(20000, props.trip.days.length * 7000)))

const progress = ref(0)
const paused = ref(false)

function posAt(t: number) {
  const list = points.value
  if (!list.length) return { x: W / 2, y: H / 2, idx: 0 }
  const target = t * totalLen.value
  let i = 1
  while (i < cumulative.value.length && cumulative.value[i] < target) i++
  if (i >= list.length) return { ...list[list.length - 1], idx: list.length - 1 }
  const a = list[i - 1], b = list[i]
  const segLen = cumulative.value[i] - cumulative.value[i - 1] || 1
  const f = (target - cumulative.value[i - 1]) / segLen
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, idx: i }
}

const car = computed(() => posAt(progress.value))
const currentDay = computed(() => points.value[Math.min(car.value.idx, points.value.length - 1)]?.dayIndex || 1)
const elapsedLabel = computed(() => `${Math.round(progress.value * totalMs.value / 1000)}s`)
const totalLabel = computed(() => `${Math.round(totalMs.value / 1000)}s`)

function jumpDay(n: number) {
  const idx = points.value.findIndex(p => p.dayIndex === n)
  if (idx < 0) return
  progress.value = cumulative.value[idx] / totalLen.value
  paused.value = false
  last = 0
}
function stepDay(delta: number) {
  const days = props.trip.days.map(d => d.dayIndex)
  const pos = days.indexOf(currentDay.value)
  const next = days[Math.max(0, Math.min(days.length - 1, pos + delta))]
  if (next !== undefined) jumpDay(next)
}
function replay() { progress.value = 0; paused.value = false; last = 0 }

let raf = 0
let last = 0
function tick(ts: number) {
  if (last && !paused.value && progress.value < 1) {
    progress.value = Math.min(1, progress.value + (ts - last) / totalMs.value)
  }
  last = ts
  if (progress.value < 1) raf = window.requestAnimationFrame(tick)
}
onMounted(() => { raf = window.requestAnimationFrame(tick) })
onUnmounted(() => window.cancelAnimationFrame(raf))

const pathPoints = computed(() => points.value.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
</script>

<template>
  <div class="absolute inset-0 z-40 flex items-center justify-center bg-ink/55 backdrop-blur-[2px] p-3 sm:p-6" @click.self="emit('close')">
    <div class="paper-card double-border w-full max-w-[980px] bg-paper rounded-sm overflow-hidden flex flex-col max-h-full animate-fade-up">
      <!-- 头 -->
      <header class="flex items-start justify-between gap-3 px-5 py-3 border-b border-ink/15 shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="seal w-8 h-8 text-xs shrink-0">览</span>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="font-brush text-lg text-ink truncate">{{ trip.title }} · 全程一览</h2>
              <span class="tag-pill font-cn shrink-0">演示向</span>
            </div>
            <p class="font-cn text-[10px] text-inkLight truncate">按日程顺序示意行进，非真实轨迹与用时</p>
          </div>
        </div>
        <button class="w-8 h-8 shrink-0 flex items-center justify-center border border-ink/20 text-inkLight hover:text-cinnabar" title="关闭" @click="emit('close')">
          <X :size="16" />
        </button>
      </header>

      <!-- 全览画布 -->
      <div class="relative mx-4 mt-3 border border-ink/20 bg-mist overflow-hidden shrink-0" style="aspect-ratio: 1000 / 560;">
        <svg class="absolute inset-0 w-full h-full" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="replay-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FBF7EC" />
              <stop offset="100%" stop-color="#DCE5E0" />
            </linearGradient>
          </defs>
          <rect :width="W" :height="H" fill="url(#replay-sky)" />
          <path d="M-20 200 Q120 110 260 176 T520 150 T780 172 T1020 130 L1020 300 L-20 300 Z" fill="#B9C6C4" opacity=".42" />
          <path d="M-20 250 Q160 170 340 228 T700 206 T1020 236 L1020 360 L-20 360 Z" fill="#8FA9A6" opacity=".35" />
          <path d="M-20 470 Q200 420 420 458 T820 440 T1020 456 L1020 580 L-20 580 Z" fill="#B9C6C4" opacity=".28" />

          <polyline :points="pathPoints" fill="none" stroke="#F7EFE0" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" opacity=".85" />
          <polyline :points="pathPoints" fill="none" stroke="#A64834" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="2 9" />

          <g v-for="(p, i) in points" :key="i">
            <circle :cx="p.x" :cy="p.y" :r="currentDay === p.dayIndex ? 13 : 9" :fill="currentDay === p.dayIndex ? '#A64834' : '#F7EFE0'" :stroke="currentDay === p.dayIndex ? '#F7EFE0' : '#8FA9A6'" stroke-width="2" />
            <text :x="p.x" :y="p.y + 4" text-anchor="middle" :fill="currentDay === p.dayIndex ? '#F7EFE0' : '#2C2A26'" font-size="11" font-family="Georgia, serif">{{ i + 1 }}</text>
          </g>
        </svg>

        <!-- 小车 -->
        <div
          v-if="route.length"
          class="absolute z-10 transform -translate-x-1/2 -translate-y-1/2 transition-none"
          :style="{ left: (car.x / W * 100) + '%', top: (car.y / H * 100) + '%' }"
        >
          <div class="seal w-9 h-9 rounded-full border-2 border-mist"><Car :size="17" /></div>
          <div class="w-1.5 h-1.5 bg-cinnabar rounded-full mx-auto mt-0.5"></div>
        </div>

        <!-- 当前站 -->
        <div v-if="route.length" class="absolute left-3 bottom-3 paper-card px-3 py-2 max-w-[62%]">
          <div class="flex items-center gap-2">
            <MapPin :size="13" class="text-cinnabar shrink-0" />
            <span class="font-cn text-[11px] text-ink truncate">{{ points[Math.min(car.idx, points.length - 1)]?.poi.name }}</span>
          </div>
          <p class="font-cn text-[10px] text-inkLight mt-0.5">第 {{ currentDay }} 日 · {{ trip.days.find(d => d.dayIndex === currentDay)?.title }}</p>
        </div>

        <div v-if="!route.length" class="absolute inset-0 flex flex-col items-center justify-center">
          <Flag :size="24" class="text-celadon mb-2" />
          <p class="font-cn text-xs text-inkLight">尚无行程节点可演示</p>
        </div>
      </div>

      <!-- 控制条 -->
      <div class="px-5 py-3 space-y-2 shrink-0">
        <div class="flex items-center gap-2">
          <button class="w-9 h-9 shrink-0 flex items-center justify-center border border-ink/25 text-ink hover:border-cinnabar hover:text-cinnabar" title="上一天" @click="stepDay(-1)"><SkipBack :size="15" /></button>
          <button class="w-9 h-9 shrink-0 flex items-center justify-center bg-cinnabar text-mist hover:bg-cinnabarDeep" :title="paused ? '继续' : '暂停'" @click="paused = !paused; last = 0">
            <component :is="paused ? Play : Pause" :size="15" />
          </button>
          <button class="w-9 h-9 shrink-0 flex items-center justify-center border border-ink/25 text-ink hover:border-cinnabar hover:text-cinnabar" title="下一天" @click="stepDay(1)"><SkipForward :size="15" /></button>
          <button class="w-9 h-9 shrink-0 flex items-center justify-center border border-ink/25 text-ink hover:border-cinnabar hover:text-cinnabar" title="重播" @click="replay"><RotateCcw :size="15" /></button>
          <div class="flex-1 h-1.5 bg-ink/10 overflow-hidden rounded-full mx-1">
            <div class="h-full bg-cinnabar transition-none" :style="{ width: (progress * 100) + '%' }"></div>
          </div>
          <span class="font-num text-xs text-inkLight shrink-0 inline-flex items-center gap-1"><Clock :size="12" /> {{ elapsedLabel }} / {{ totalLabel }}</span>
        </div>

        <!-- 跳日 -->
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="d in trip.days" :key="d.dayIndex"
            class="px-2.5 py-1 border font-cn text-[10px] transition-colors"
            :class="currentDay === d.dayIndex ? 'bg-cinnabar text-mist border-cinnabar' : 'border-ink/20 text-inkLight hover:border-celadon hover:text-celadonDeep'"
            @click="jumpDay(d.dayIndex)"
          >Day {{ d.dayIndex }}</button>
        </div>

        <p class="flex items-start gap-1.5 font-cn text-[10px] text-inkLight/80 leading-relaxed">
          <Info :size="11" class="shrink-0 mt-0.5 text-ochre" />
          演示向 · {{ totalLabel }} 快进全程，位置由日程节点平滑推算；暂停、跳日随心，不构成实际导航。
        </p>
      </div>
    </div>
  </div>
</template>
