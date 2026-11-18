<script setup lang="ts">
import { computed } from 'vue'
import {
  X, CloudSun, Sun, Cloud, CloudRain, CloudSnow, CloudFog, Wind,
  Footprints, Car, Bus, Bike, ChevronRight, BedDouble,
  Coins, AlertTriangle, Sparkles,
} from 'lucide-vue-next'
import type { POI, TransportSegment, Expense, TransportMode } from '../../types'
import { MODE_LABEL } from '../../types'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { useWeatherStore } from '../../stores/weather'
import { deriveDay, dayStats } from '../../lib/timeline'

const props = defineProps<{ dayIndex: number }>()
const emit = defineEmits<{ close: [] }>()

const trip = useTripStore()
const ui = useUiStore()
const weather = useWeatherStore()

const day = computed(() => trip.activeTrip?.days.find(d => d.dayIndex === props.dayIndex))
const prevCity = computed(() => {
  const days = trip.activeTrip?.days || []
  return props.dayIndex > 1 ? days.find(d => d.dayIndex === props.dayIndex - 1)?.city : undefined
})
const entries = computed(() => {
  const d = day.value
  if (!d || !trip.activeTrip) return []
  return deriveDay(d, trip.activeTrip.pois, trip.activeTrip.segments, trip.activeTrip.expenses, prevCity.value)
})
const stats = computed(() => {
  const d = day.value
  if (!d || !trip.activeTrip) return { stopCount: 0, travelMin: 0, endTime: '—' }
  return dayStats(d, trip.activeTrip.pois, trip.activeTrip.segments)
})

const forecast = computed(() => weather.forDate(day.value?.city || '', day.value?.date))
const outOfWindow = computed(() => {
  const d = day.value
  if (!d) return true
  const list = weather.get(d.city)
  if (!list.length) return true
  return !!d.date && !list.some(x => x.date === d.date)
})
const climate = computed(() => weather.climate(day.value?.date))

function poiOf(id: string): POI | undefined { return trip.activeTrip?.pois[id] }
function segOf(id: string): TransportSegment | undefined { return trip.activeTrip?.segments[id] }
function expOf(id: string): Expense | undefined { return trip.activeTrip?.expenses.find(e => e.id === id) }
function yuan(cents: number) { return (cents / 100).toFixed(2) }

const WX_ICON = { 晴: Sun, 多云: CloudSun, 阴: Cloud, 雨: CloudRain, 雪: CloudSnow, 雾: CloudFog, 雷雨: CloudRain }
function wxIcon(text?: string) { return WX_ICON[(text || '') as keyof typeof WX_ICON] || CloudSun }
const MODE_ICON: Record<TransportMode, typeof Car> = { walk: Footprints, taxi: Car, transit: Bus, bike: Bike }

function openSegment(seg: TransportSegment) {
  ui.selectedSegmentId = seg.id
  ui.selectedPoiId = null
  ui.openModal('route', seg)
}
</script>

<template>
  <aside class="scroll-drawer absolute inset-y-0 right-0 z-40 w-full max-w-[460px] bg-paper/98 paper-texture shadow-drawer border-l border-ink/25 flex flex-col">
    <!-- 轴头 -->
    <div class="scroll-axis h-1.5 w-full shrink-0"></div>

    <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-ink/15">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="seal w-8 h-8 text-xs">程</span>
          <div>
            <h2 class="font-brush text-xl text-ink leading-tight">{{ day?.title || '行程' }}</h2>
            <p class="font-cn text-[10px] text-inkLight tracking-wider">{{ day?.city }} · {{ day?.date || '日期未定' }} · {{ day?.departTime || '09:00' }} 启程</p>
          </div>
        </div>
      </div>
      <button class="w-8 h-8 shrink-0 flex items-center justify-center border border-ink/20 text-inkLight hover:text-cinnabar hover:border-cinnabar/40" title="收卷" @click="emit('close')">
        <X :size="16" />
      </button>
    </header>

    <div class="flex-1 overflow-y-auto drawer-scroll px-5 py-4">
      <!-- 天气条 -->
      <div class="paper-card p-3 mb-4">
        <div class="flex items-center gap-2 mb-1">
          <Wind :size="13" class="text-celadonDeep" />
          <span class="font-cn text-[10px] tracking-[0.2em] text-inkLight">{{ day?.city }} · 天气</span>
          <span v-if="!outOfWindow" class="tag-pill font-cn ml-auto">预报内</span>
          <span v-else class="font-cn text-[10px] text-ochreDeep ml-auto">临近出发自动更新</span>
        </div>
        <template v-if="!outOfWindow && forecast">
          <div class="flex items-center gap-3">
            <component :is="wxIcon(forecast.text)" :size="28" class="text-ochreDeep shrink-0" />
            <div>
              <p class="font-cn text-sm text-ink">{{ forecast.text }} · {{ forecast.tempMin }}°–{{ forecast.tempMax }}°</p>
              <p class="font-brush text-sm text-celadonDeep">{{ forecast.poem }}</p>
            </div>
            <span class="ml-auto font-cn text-[11px] text-inkLight border-l border-ink/15 pl-3 max-w-[110px] leading-relaxed">{{ forecast.advice }}</span>
          </div>
        </template>
        <template v-else>
          <div class="flex items-start gap-2">
            <CloudSun :size="22" class="text-ochreDeep shrink-0 mt-0.5" />
            <div>
              <p class="font-cn text-xs text-ink">临近出发自动更新</p>
              <p class="font-cn text-[11px] text-inkLight mt-1">当月气候参考 · {{ climate || '以当地实况为准' }}</p>
            </div>
          </div>
        </template>
      </div>

      <!-- 当日统计 -->
      <div class="grid grid-cols-3 gap-2 mb-4 text-center">
        <div class="bg-mist/70 border border-ink/10 py-2">
          <p class="font-num text-lg text-ink leading-none">{{ stats.stopCount }}</p>
          <p class="font-cn text-[10px] text-inkLight mt-1">处停留</p>
        </div>
        <div class="bg-mist/70 border border-ink/10 py-2">
          <p class="font-num text-lg text-ink leading-none">{{ stats.travelMin }}</p>
          <p class="font-cn text-[10px] text-inkLight mt-1">分交通</p>
        </div>
        <div class="bg-mist/70 border border-ink/10 py-2">
          <p class="font-num text-lg text-ink leading-none">{{ stats.endTime }}</p>
          <p class="font-cn text-[10px] text-inkLight mt-1">预计收</p>
        </div>
      </div>

      <!-- 时间轴 -->
      <div class="relative">
        <div class="absolute left-[52px] top-2 bottom-2 w-px bg-ink/15"></div>

        <template v-for="(e, i) in entries" :key="i">
          <!-- 跨城分隔 -->
          <div v-if="e.kind === 'divider'" class="relative flex items-center gap-3 py-3">
            <span class="w-11 shrink-0"></span>
            <div class="flex-1 flex items-center gap-2">
              <span class="ink-divider flex-1"></span>
              <span class="seal-outline seal font-cn text-[10px] px-2 py-1 shrink-0">{{ e.label }}</span>
              <span class="ink-divider flex-1"></span>
            </div>
          </div>

          <!-- 交通段 -->
          <button
            v-else-if="e.kind === 'move' && segOf(e.segmentId)"
            class="relative w-full flex items-center gap-3 py-2 text-left group"
            @click="openSegment(segOf(e.segmentId)!)"
          >
            <span class="w-11 shrink-0 text-right font-num text-[11px] text-inkLight">{{ e.time }}</span>
            <span class="relative z-10 w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-hill/60 text-ink border border-mist">
              <component :is="MODE_ICON[segOf(e.segmentId)!.mode]" :size="11" />
            </span>
            <span class="flex-1 font-cn text-[11px] text-inkLight group-hover:text-cinnabar transition-colors">
              {{ MODE_LABEL[segOf(e.segmentId)!.mode] }} · {{ segOf(e.segmentId)!.durationMin }} 分
              <span v-if="segOf(e.segmentId)!.distanceKm" class="font-num">· {{ segOf(e.segmentId)!.distanceKm }}km</span>
              <span v-if="segOf(e.segmentId)!.estimated" class="text-cinnabar">估</span>
              <span v-if="segOf(e.segmentId)!.lineNos?.length" class="font-num">· {{ segOf(e.segmentId)!.lineNos?.join('/') }}</span>
            </span>
            <ChevronRight :size="13" class="text-ink/30 shrink-0" />
          </button>

          <!-- 停留点 -->
          <div v-else-if="e.kind === 'poi' && poiOf(e.poiId)" class="relative flex gap-3 py-2">
            <span class="w-11 shrink-0 text-right pt-0.5 font-num text-xs text-ink">{{ e.time }}</span>
            <span class="relative z-10 w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-cinnabar text-mist border-2 border-mist shadow-seal">
              <span class="w-1.5 h-1.5 bg-mist rounded-full"></span>
            </span>
            <div class="flex-1 min-w-0 paper-card px-3 py-2">
              <div class="flex items-start gap-2">
                <div class="min-w-0 flex-1">
                  <p class="font-cn text-sm text-ink">{{ poiOf(e.poiId)!.name }}</p>
                  <p class="font-num text-[10px] text-inkLight mt-0.5">{{ e.arrive }} 至 {{ e.leave }} · {{ poiOf(e.poiId)!.stayMinutes || 60 }} 分</p>
                </div>
                <span v-if="poiOf(e.poiId)!.visitedAt" class="seal seal-stamp w-8 h-8 text-[9px] shrink-0">已至</span>
              </div>
              <p v-if="poiOf(e.poiId)!.address" class="font-cn text-[10px] text-inkLight mt-1 truncate">{{ poiOf(e.poiId)!.address }}</p>
              <p v-if="poiOf(e.poiId)!.note" class="font-brush text-xs text-cinnabar mt-1.5 border-l-2 border-cinnabar/40 pl-2">题：{{ poiOf(e.poiId)!.note }}</p>
            </div>
          </div>

          <!-- 夜间宿卡 -->
          <div v-else-if="e.kind === 'stay'" class="relative flex items-center gap-3 py-2">
            <span class="w-11 shrink-0"></span>
            <div class="relative z-10 w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-celadon text-mist border-2 border-mist">
              <BedDouble :size="11" />
            </div>
            <div class="flex-1 flex items-center gap-2 bg-mist/70 border border-dashed border-celadon/60 px-3 py-2">
              <BedDouble :size="14" class="text-celadonDeep shrink-0" />
              <span class="font-cn text-xs text-ink">{{ e.label }}</span>
              <span class="ml-auto font-cn text-[10px] text-inkLight">歇脚</span>
            </div>
          </div>

          <!-- 当日开销 -->
          <div v-else-if="e.kind === 'expense' && expOf(e.expenseId)" class="relative flex items-center gap-3 py-1.5">
            <span class="w-11 shrink-0"></span>
            <span class="relative z-10 w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-ochre/70 text-mist border-2 border-mist">
              <Coins :size="10" />
            </span>
            <span class="flex-1 font-cn text-[11px] text-inkLight truncate">{{ expOf(e.expenseId)!.title }}</span>
            <span class="font-num text-xs text-ochreDeep">¥{{ yuan(expOf(e.expenseId)!.amount) }}</span>
          </div>
        </template>

        <div v-if="!entries.length" class="py-16 text-center">
          <Sparkles :size="22" class="text-celadon mx-auto mb-2" />
          <p class="font-cn text-xs text-inkLight">这一日尚无安排，去地点卡里挑几处吧</p>
        </div>
      </div>

      <p class="flex items-start gap-1.5 font-cn text-[10px] text-inkLight/80 mt-4 pt-3 border-t border-ink/10 leading-relaxed">
        <AlertTriangle :size="11" class="shrink-0 mt-0.5 text-ochre" />
        交通用时按直线与经验速度估算，标「估」；点按交通段可另选走法。
      </p>
    </div>

    <div class="scroll-axis h-1.5 w-full shrink-0"></div>
  </aside>
</template>
