<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  X, Clock, Stamp, Umbrella, CloudRain, Check,
  ChevronRight, Sparkles, MapPin, Route, Sun, Gift, Flag,
  Hourglass, BookOpen, AlertTriangle, Plus,
} from 'lucide-vue-next'
import type { POI } from '../../types'
import { MODE_LABEL } from '../../types'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { useWeatherStore } from '../../stores/weather'
import { deriveDay } from '../../lib/timeline'

const props = defineProps<{ dayIndex: number }>()
const emit = defineEmits<{ close: [] }>()

const trip = useTripStore()
const ui = useUiStore()
const weather = useWeatherStore()

const now = ref(new Date())
let timer = 0
onMounted(() => { timer = window.setInterval(() => { now.value = new Date() }, 30_000) })
onUnmounted(() => window.clearInterval(timer))

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function shiftDate(start: string, n: number) {
  const d = new Date(`${start}T00:00:00`)
  d.setDate(d.getDate() + n)
  return localDate(d)
}
function diffDays(a: string, b: string) {
  return Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000)
}
function hhmm(ts: number) { return new Date(ts).toTimeString().slice(0, 5) }
function yuan(cents: number) { return (cents / 100).toFixed(2) }

const day = computed(() => trip.activeTrip?.days.find(d => d.dayIndex === props.dayIndex))
const effectiveDate = computed(() => {
  const d = day.value
  if (d?.date) return d.date
  const start = trip.activeTrip?.startDate
  return start ? shiftDate(start, props.dayIndex - 1) : undefined
})
const todayStr = computed(() => localDate(now.value))
const daysAway = computed(() => effectiveDate.value ? diffDays(effectiveDate.value, todayStr.value) : 0)

type Phase = 'before' | 'ongoing' | 'done'
const phase = computed<Phase>(() => {
  if (trip.activeTrip?.completedAt || trip.activeTrip?.archived) return 'done'
  if (!effectiveDate.value) return 'before'
  if (effectiveDate.value > todayStr.value) return 'before'
  if (effectiveDate.value < todayStr.value) return 'done'
  return 'ongoing'
})

const departTime = computed(() => day.value?.departTime || '09:00')
const minutesToDepart = computed(() => {
  const [h, m] = departTime.value.split(':').map(Number)
  return (h || 9) * 60 + (m || 0) - (now.value.getHours() * 60 + now.value.getMinutes())
})
const shouldLeave = computed(() => phase.value === 'ongoing' && minutesToDepart.value <= 10 && minutesToDepart.value > -120)

// 行前锦囊：T-1 可拆，一次为限（本机记忆）
const tipKey = computed(() => `shicheng:tip:${trip.activeTrip?.id || 'none'}:${props.dayIndex}`)
const tipOpened = ref(false)
const tipAvailable = computed(() => phase.value === 'before' && daysAway.value <= 1)
function loadTip() {
  try { tipOpened.value = localStorage.getItem(tipKey.value) === '1' } catch { tipOpened.value = false }
}
function openTip() {
  tipOpened.value = true
  try { localStorage.setItem(tipKey.value, '1') } catch { /* ignore */ }
  ui.toast('行前锦囊已拆封，请收好')
}
onMounted(loadTip)

// 时间轴 → 到达时间
const arriveMap = computed(() => {
  const d = day.value
  const t = trip.activeTrip
  if (!d || !t) return new Map<string, string>()
  return new Map(deriveDay(d, t.pois, t.segments).filter(e => e.kind === 'poi').map(e => [e.poiId, e.time]))
})
const stops = computed(() => {
  const d = day.value
  const t = trip.activeTrip
  if (!d || !t) return []
  return d.poiIds.map(id => t.pois[id]).filter((p): p is POI => !!p && p.role !== 'base')
})
const visitedCount = computed(() => stops.value.filter(p => p.visitedAt).length)

function stamp(p: POI) {
  if (p.visitedAt) return
  trip.updatePoi(p.id, { visitedAt: Date.now() })
  ui.toast(`「${p.name}」已至，印章落下`)
}
function undo() { const msg = trip.undo(); if (msg) ui.toast(msg) }

// 雨备候选：收藏池中的博物馆 / 展馆 / 美食类
const RAIN_WORD = /博物馆|展馆|美术馆|纪念馆|科技馆|艺术馆|文化馆|美食|餐厅|小吃|茶馆|咖啡/
const rainCandidates = computed(() => {
  const t = trip.activeTrip
  if (!t) return []
  return t.wishlist
    .map(id => t.pois[id])
    .filter((p): p is POI => !!p && (p.category === 'food' || RAIN_WORD.test([p.name, p.intro || '', ...p.tags].join(' '))))
    .slice(0, 5)
})
const rainy = computed(() => /雨/.test(weather.forDate(day.value?.city || '', day.value?.date)?.text || ''))
function addRain(p: POI) {
  const res = trip.addToDay(p, props.dayIndex)
  ui.toast(res.ok ? `「${p.name}」已列入第 ${props.dayIndex} 日雨备` : '加入失败', res.ok ? '撤销' : undefined, res.ok ? undo : undefined)
}

// 当日小结
const daySpent = computed(() => (trip.activeTrip?.expenses || []).filter(e => e.dayIndex === props.dayIndex).reduce((s, e) => s + e.amount, 0))
const travelMin = computed(() => {
  const d = day.value
  const t = trip.activeTrip
  if (!d || !t) return 0
  return d.segmentIds.reduce((s, id) => s + (t.segments[id]?.durationMin || 0), 0)
})
const firstSeg = computed(() => {
  const d = day.value
  const t = trip.activeTrip
  if (!d || !t) return undefined
  return t.segments[d.segmentIds[0]]
})
const forecast = computed(() => weather.forDate(day.value?.city || '', day.value?.date))
</script>

<template>
  <aside class="scroll-drawer absolute inset-y-0 right-0 z-40 w-full max-w-[500px] bg-paper/98 paper-texture shadow-drawer border-l border-ink/25 flex flex-col">
    <div class="scroll-axis h-1.5 w-full shrink-0"></div>

    <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-ink/15">
      <div class="flex items-center gap-2">
        <span class="seal w-8 h-8 text-xs">今</span>
        <div>
          <h2 class="font-brush text-xl text-ink leading-tight">{{ day?.title || `第 ${dayIndex} 日` }}</h2>
          <p class="font-cn text-[10px] text-inkLight tracking-wider">今日 · {{ effectiveDate || '日期未定' }} · {{ todayStr }}</p>
        </div>
      </div>
      <button class="w-8 h-8 shrink-0 flex items-center justify-center border border-ink/20 text-inkLight hover:text-cinnabar" title="收起" @click="emit('close')">
        <X :size="16" />
      </button>
    </header>

    <div class="flex-1 overflow-y-auto drawer-scroll px-5 py-4 space-y-4">
      <!-- 三态横幅 -->
      <div class="paper-card relative overflow-hidden px-4 py-5" :class="phase === 'done' ? 'border-cinnabar/40' : ''">
        <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 bg-celadon"></div>
        <div class="flex items-center gap-3 relative">
          <span class="seal w-12 h-12 text-lg seal-stamp">{{ phase === 'before' ? '待' : phase === 'ongoing' ? '行' : '完' }}</span>
          <div class="min-w-0">
            <p class="font-brush text-2xl text-ink">
              {{ phase === 'before' ? '尚未启程' : phase === 'ongoing' ? '行 中' : '已 完' }}
            </p>
            <p class="font-cn text-[11px] text-inkLight mt-1">
              <template v-if="phase === 'before'">距启程 {{ daysAway > 0 ? daysAway + ' 日' : '在即' }} · {{ departTime }} 出发</template>
              <template v-else-if="phase === 'ongoing'">已至 {{ visitedCount }} / {{ stops.length }} 处 · {{ departTime }} 启程</template>
              <template v-else>此程已收卷 · 共 {{ visitedCount }} 处留下印章</template>
            </p>
          </div>
          <component :is="phase === 'before' ? Hourglass : phase === 'ongoing' ? Route : Flag" :size="22" class="ml-auto text-celadonDeep shrink-0" />
        </div>

        <!-- 该出发了：提前 10 分钟朱砂提示 -->
        <div v-if="shouldLeave" class="mt-4 flex items-center gap-2 bg-cinnabar text-mist px-3 py-2 seal-stamp">
          <Clock :size="16" class="shrink-0" />
          <span class="font-brush text-base">该出发了</span>
          <span class="font-cn text-[11px] ml-auto">
            {{ minutesToDepart >= 0 ? `距启程 ${minutesToDepart} 分` : '已过启程时' }}
          </span>
        </div>
      </div>

      <!-- 天气与诗句 -->
      <div class="flex items-center gap-3 paper-card px-4 py-3">
        <component :is="rainy ? CloudRain : Sun" :size="20" :class="rainy ? 'text-celadonDeep' : 'text-ochreDeep'" class="shrink-0" />
        <div class="min-w-0">
          <p class="font-cn text-xs text-ink">{{ forecast ? `${forecast.text} ${forecast.tempMin}°–${forecast.tempMax}°` : '临近出发自动更新' }}</p>
          <p v-if="forecast?.poem" class="font-brush text-sm text-celadonDeep truncate">{{ forecast.poem }}</p>
          <p v-else class="font-cn text-[10px] text-inkLight">当月气候参考 · {{ weather.climate(effectiveDate) }}</p>
        </div>
        <span v-if="forecast?.advice" class="ml-auto font-cn text-[10px] text-inkLight max-w-[110px] text-right leading-relaxed">{{ forecast.advice }}</span>
      </div>

      <!-- 行前锦囊：T-1 拆封一次 -->
      <div v-if="phase === 'before' && tipAvailable" class="paper-card p-4 border-celadon/40">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Gift :size="16" class="text-cinnabar" />
            <span class="font-brush text-base text-ink">行前锦囊</span>
            <span class="tag-pill font-cn">T-1</span>
          </div>
          <button v-if="!tipOpened" class="px-3 py-1 bg-cinnabar text-mist font-cn text-xs hover:bg-cinnabarDeep" @click="openTip">拆封</button>
          <span v-else class="font-cn text-[10px] text-celadonDeep">已拆封</span>
        </div>
        <div v-if="tipOpened" class="mt-3 space-y-2 ink-reveal border-t border-ink/10 pt-3">
          <p class="flex items-start gap-2 font-cn text-[11px] text-ink/80 leading-relaxed">
            <BookOpen :size="12" class="text-ochreDeep shrink-0 mt-0.5" />
            证件与票务：身份证随身，预约门票与车次截图离线留存。
          </p>
          <p class="flex items-start gap-2 font-cn text-[11px] text-ink/80 leading-relaxed">
            <Route :size="12" class="text-ochreDeep shrink-0 mt-0.5" />
            首段交通：{{ firstSeg ? `${MODE_LABEL[firstSeg.mode]}约 ${firstSeg.durationMin} 分` : '待定' }}，留足缓冲。
          </p>
          <p v-if="forecast" class="flex items-start gap-2 font-cn text-[11px] text-ink/80 leading-relaxed">
            <Umbrella :size="12" class="text-ochreDeep shrink-0 mt-0.5" />
            天候：{{ forecast.text }}，{{ forecast.advice }}。
          </p>
          <p class="flex items-start gap-2 font-cn text-[11px] text-ink/80 leading-relaxed">
            <Umbrella :size="12" class="text-ochreDeep shrink-0 mt-0.5" />
            雨备：收藏池中的博物馆、展馆与美食处已备好，雨天不扫兴。
          </p>
        </div>
        <p v-else class="font-cn text-[10px] text-inkLight mt-2">启程前一日方可拆封，且只拆这一次。</p>
      </div>

      <!-- 已至盖章 -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-cn text-xs text-ink tracking-wider flex items-center gap-1.5"><Stamp :size="13" class="text-cinnabar" /> 沿途足迹</h3>
          <span class="font-num text-xs text-inkLight">{{ visitedCount }} / {{ stops.length }}</span>
        </div>
        <div class="h-1.5 bg-ink/10 overflow-hidden rounded-full mb-3">
          <div class="h-full bg-cinnabar transition-all duration-500" :style="{ width: (stops.length ? visitedCount / stops.length * 100 : 0) + '%' }"></div>
        </div>
        <div class="space-y-1.5">
          <div v-for="(p, i) in stops" :key="p.id" class="flex items-center gap-2 paper-card px-3 py-2">
            <span class="font-num text-xs text-inkLight w-5 shrink-0">{{ String(i + 1).padStart(2, '0') }}</span>
            <div class="min-w-0 flex-1">
              <p class="font-cn text-xs text-ink truncate">{{ p.name }}</p>
              <p class="font-num text-[10px] text-inkLight">约 {{ arriveMap.get(p.id) || '—' }} 抵达</p>
            </div>
            <span v-if="p.visitedAt" class="seal seal-stamp w-12 h-8 text-[10px] shrink-0 flex-col leading-none">
              <span>已至</span><span class="font-num text-[8px]">{{ hhmm(p.visitedAt) }}</span>
            </span>
            <button v-else class="inline-flex items-center gap-1 px-2 py-1 border border-cinnabar/50 text-cinnabar font-cn text-[10px] hover:bg-cinnabar/10 shrink-0" @click="stamp(p)">
              <Stamp :size="11" /> 已至
            </button>
          </div>
          <div v-if="!stops.length" class="py-8 text-center">
            <MapPin :size="18" class="mx-auto text-celadon mb-2" />
            <p class="font-cn text-[11px] text-inkLight">这一日尚未安排去处</p>
          </div>
        </div>
      </div>

      <!-- 雨备候选 -->
      <div class="paper-card p-3" :class="rainy ? 'border-celadon/60' : ''">
        <div class="flex items-center gap-2 mb-2">
          <Umbrella :size="14" :class="rainy ? 'text-cinnabar' : 'text-celadonDeep'" />
          <span class="font-cn text-xs text-ink tracking-wider">雨备 · 收藏池</span>
          <span v-if="rainy" class="tag-pill font-cn ml-auto">今日有雨</span>
        </div>
        <div v-if="rainCandidates.length" class="space-y-1.5">
          <div v-for="p in rainCandidates" :key="p.id" class="flex items-center gap-2 border-b border-ink/10 last:border-0 pb-1.5 last:pb-0">
            <Sparkles :size="12" class="text-ochreDeep shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="font-cn text-[11px] text-ink truncate">{{ p.name }}</p>
              <p class="font-cn text-[10px] text-inkLight truncate">{{ p.category === 'food' ? '美食' : '展馆' }} · {{ p.city }}</p>
            </div>
            <button class="inline-flex items-center gap-0.5 text-celadonDeep hover:text-cinnabar font-cn text-[10px] shrink-0" @click="addRain(p)">
              <Plus :size="11" /> 列入
            </button>
          </div>
        </div>
        <p v-else class="font-cn text-[10px] text-inkLight leading-relaxed">收藏池里还没有博物馆、展馆或美食类地点。遇到雨天，可先在收藏中添几处。</p>
      </div>

      <!-- 当日小结 -->
      <div class="paper-card p-4">
        <div class="flex items-center gap-2 mb-3">
          <Check :size="14" class="text-celadonDeep" />
          <span class="font-cn text-xs text-ink tracking-wider">当日小结</span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div>
            <p class="font-num text-lg text-ink leading-none">{{ visitedCount }}/{{ stops.length }}</p>
            <p class="font-cn text-[10px] text-inkLight mt-1">已至</p>
          </div>
          <div class="border-x border-ink/10">
            <p class="font-num text-lg text-ochreDeep leading-none">¥{{ yuan(daySpent) }}</p>
            <p class="font-cn text-[10px] text-inkLight mt-1">当日开销</p>
          </div>
          <div>
            <p class="font-num text-lg text-celadonDeep leading-none">{{ travelMin }}</p>
            <p class="font-cn text-[10px] text-inkLight mt-1">交通分</p>
          </div>
        </div>
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-ink/10 font-cn text-[10px] text-inkLight">
          <span class="inline-flex items-center gap-1"><Clock :size="11" /> {{ departTime }} 启程</span>
          <span class="inline-flex items-center gap-1"><ChevronRight :size="11" /> {{ stops.length }} 处 · {{ travelMin }} 分在途</span>
        </div>
      </div>

      <p class="flex items-start gap-1.5 font-cn text-[10px] text-inkLight/80 leading-relaxed">
        <AlertTriangle :size="11" class="shrink-0 mt-0.5 text-ochre" />
        「已至」据实落章，不做定位校验；雨备取收藏池中展馆与美食，仅供临雨一念。
      </p>
    </div>

    <div class="scroll-axis h-1.5 w-full shrink-0"></div>
  </aside>
</template>
