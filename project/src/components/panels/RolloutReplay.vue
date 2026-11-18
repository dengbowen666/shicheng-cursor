<script setup lang="ts">
/**
 * 全程回放：按日程逐站重演"这几天按什么顺序去了哪里"。
 * 不用地理投影——大理→丽江经度几乎相同会把点压成一条竖线，且只有序号看不出地名。
 * 改成线路图式：每天一行站点，带地名/到达时刻，城际段作为换乘块，当前站朱砂高亮并自动滚动到视野。
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import {
  X, Play, Pause, SkipBack, SkipForward, RotateCcw,
  TrainFront, Train, Plane, Car, Bus, Footprints, MapPin, Flag, Gauge,
} from 'lucide-vue-next'
import type { Trip, POI, LegMode, POICategory } from '../../types'
import { CATEGORY_LABEL, LEG_MODE_LABEL } from '../../types'
import { deriveDay } from '../../lib/timeline'

const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ close: [] }>()

const LEG_ICON: Record<LegMode, typeof TrainFront> = {
  highspeed: TrainFront, train: Train, flight: Plane, car: Car, coach: Bus, walk: Footprints,
}
const CAT_COLOR: Record<POICategory, string> = {
  sight: '#A64834', food: '#B08D70', hotel: '#5E857B', shop: '#8A6E9E', custom: '#6E6A62',
}

type ReplayItem =
  | { kind: 'leg'; key: string; dayIndex: number; fromCity: string; toCity: string; mode: LegMode; time: string; note?: string }
  | { kind: 'poi'; key: string; dayIndex: number; poi: POI; time: string }

/** 扁平播放序列：每天先城际段，再按时间轴顺序列出途经点（驻地不占白天） */
const items = computed<ReplayItem[]>(() => {
  const out: ReplayItem[] = []
  for (const day of props.trip.days) {
    for (const lid of day.legIds || []) {
      const l = props.trip.legs[lid]
      if (l) out.push({
        kind: 'leg', key: l.id, dayIndex: day.dayIndex,
        fromCity: l.fromCity, toCity: l.toCity, mode: l.mode,
        time: l.departTime || '', note: l.note,
      })
    }
    const tl = deriveDay(day, props.trip.pois, props.trip.segments, props.trip.expenses, undefined, props.trip.legs)
    for (const e of tl) {
      if (e.kind !== 'poi') continue
      const p = props.trip.pois[e.poiId]
      if (p && p.role !== 'base') out.push({
        kind: 'poi', key: p.id, dayIndex: day.dayIndex, poi: p, time: e.arrive,
      })
    }
  }
  return out
})

/** 某一天的全部站点（带全局序号，用于判断已过/当前/未到） */
function stopsOf(dayIndex: number) {
  return items.value
    .map((it, i) => ({ it, i }))
    .filter(x => x.it.dayIndex === dayIndex)
}

const cursor = ref(0)
const playing = ref(true)
const speed = ref(1)
const SPEEDS = [1, 2, 4]
function cycleSpeed() { speed.value = SPEEDS[(SPEEDS.indexOf(speed.value) + 1) % SPEEDS.length] }

const STEP_MS = 1500
let timer = 0
function schedule() {
  window.clearTimeout(timer)
  if (!playing.value) return
  if (cursor.value >= items.value.length - 1) { playing.value = false; return }
  timer = window.setTimeout(() => { cursor.value++; schedule() }, STEP_MS / speed.value)
}
watch([playing, speed, items], schedule, { immediate: true })
onUnmounted(() => window.clearTimeout(timer))

function togglePlay() {
  if (cursor.value >= items.value.length - 1 && !playing.value) { cursor.value = 0; playing.value = true; return }
  playing.value = !playing.value
}
function prev() { cursor.value = Math.max(0, cursor.value - 1) }
function next() { cursor.value = Math.min(items.value.length - 1, cursor.value + 1) }
function replay() { cursor.value = 0; playing.value = true }
function jumpDay(n: number) {
  const idx = items.value.findIndex(i => i.dayIndex === n)
  if (idx >= 0) cursor.value = idx
}
function jumpProgress(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  cursor.value = Math.round(p * Math.max(0, items.value.length - 1))
}

function stateOf(i: number): 'done' | 'now' | 'todo' {
  if (i < cursor.value) return 'done'
  if (i === cursor.value) return 'now'
  return 'todo'
}

const current = computed(() => items.value[cursor.value] || null)
const progressPct = computed(() => items.value.length > 1 ? (cursor.value / (items.value.length - 1)) * 100 : 100)
const totalDays = computed(() => props.trip.days.length)

const nodeEls = new Map<string, HTMLElement>()
function setNodeRef(key: string, el: unknown) {
  if (el) nodeEls.set(key, el as HTMLElement)
  else nodeEls.delete(key)
}
watch(cursor, async () => {
  await nextTick()
  const it = current.value
  if (!it) return
  const el = nodeEls.get(it.key)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
})

function dayDate(n: number) { return props.trip.days.find(d => d.dayIndex === n)?.date || '日期未定' }
function dayCity(n: number) { return props.trip.days.find(d => d.dayIndex === n)?.city || '' }
</script>

<template>
  <div class="absolute inset-0 z-40 flex items-center justify-center bg-ink/55 backdrop-blur-[2px] p-3 sm:p-6" @click.self="emit('close')">
    <div class="paper-card double-border w-full max-w-[1000px] bg-paper rounded-sm overflow-hidden flex flex-col max-h-full animate-fade-up">
      <!-- 头 -->
      <header class="flex items-start justify-between gap-3 px-5 py-3 border-b border-ink/15 shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="seal w-8 h-8 text-xs shrink-0">览</span>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="font-brush text-lg text-ink truncate">{{ trip.title }} · 全程回放</h2>
              <span class="tag-pill font-cn shrink-0">{{ items.length }} 站 · {{ totalDays }} 日</span>
            </div>
            <p class="font-cn text-[10px] text-inkLight truncate">逐站重演按日程走过的每一处，看顺序而非坐标</p>
          </div>
        </div>
        <button class="w-8 h-8 shrink-0 flex items-center justify-center border border-ink/20 text-inkLight hover:text-cinnabar" title="关闭" @click="emit('close')">
          <X :size="16" />
        </button>
      </header>

      <!-- 当前站信息（固定） -->
      <div class="flex items-center gap-3 px-5 py-2.5 border-b border-ink/12 bg-mist/45 shrink-0">
        <template v-if="current">
          <span
            class="seal w-10 h-10 text-sm shrink-0 flex items-center justify-center"
            :style="current.kind === 'poi' ? { background: CAT_COLOR[current.poi.category] } : {}"
          >{{ current.kind === 'poi' ? CATEGORY_LABEL[current.poi.category] : '行' }}</span>
          <div class="min-w-0">
            <p class="font-brush text-lg text-ink leading-tight truncate">
              <template v-if="current.kind === 'poi'">{{ current.poi.name }}</template>
              <template v-else>{{ current.fromCity }} → {{ current.toCity }}</template>
            </p>
            <p class="font-cn text-[10px] text-inkLight truncate">
              第 {{ current.dayIndex }} 日 · {{ dayCity(current.dayIndex) }} · {{ dayDate(current.dayIndex) }}
              <template v-if="current.kind === 'poi'"> · {{ current.time }} 抵达</template>
              <template v-else-if="current.time"> · {{ current.time }} 发（{{ LEG_MODE_LABEL[current.mode] }}<template v-if="current.note"> {{ current.note }}</template>）</template>
            </p>
          </div>
        </template>
        <template v-else>
          <span class="seal w-10 h-10 text-sm shrink-0">始</span>
          <div><p class="font-brush text-lg text-ink">尚无行程可回放</p></div>
        </template>
        <div class="ml-auto shrink-0 font-num text-xs text-inkLight">{{ items.length ? cursor + 1 : 0 }} / {{ items.length }}</div>
      </div>

      <!-- 行程卷轴：每天一行站点线路 -->
      <div class="flex-1 min-h-0 overflow-y-auto drawer-scroll px-5 py-4">
        <section v-for="day in trip.days" :key="day.dayIndex" class="mb-6 last:mb-1">
          <div class="flex items-center gap-2 mb-3">
            <span class="seal w-7 h-7 text-[11px] shrink-0">{{ day.dayIndex }}</span>
            <h3 class="font-brush text-base text-ink shrink-0">第 {{ day.dayIndex }} 日 · {{ day.city }}</h3>
            <span class="font-cn text-[10px] text-inkLight shrink-0">{{ day.date || '日期未定' }}</span>
            <span class="ink-divider flex-1 ml-1"></span>
            <span class="font-num text-[10px] text-inkLight/70 shrink-0">{{ stopsOf(day.dayIndex).length }} 站</span>
          </div>

          <div class="flex items-start overflow-x-auto hide-scrollbar pb-2">
            <template v-for="(row, i) in stopsOf(day.dayIndex)" :key="row.it.key">
              <!-- 站点 -->
              <div
                :ref="el => setNodeRef(row.it.key, el)"
                class="shrink-0 flex flex-col items-center transition-all duration-300"
                :class="row.it.kind === 'leg' ? 'w-[158px]' : 'w-[104px]'"
              >
                <div class="w-full flex items-center">
                  <span class="flex-1 h-px" :class="i > 0 ? 'bg-ink/25' : 'opacity-0'"></span>

                  <!-- 城际换乘块 -->
                  <template v-if="row.it.kind === 'leg'">
                    <span
                      class="shrink-0 inline-flex items-center gap-1 border px-2 py-1 rounded-sm transition-all duration-300"
                      :class="stateOf(row.i) === 'now'
                        ? 'border-cinnabar bg-cinnabar/10 text-cinnabar shadow-seal'
                        : stateOf(row.i) === 'done'
                          ? 'border-ink/25 bg-mist/60 text-inkLight'
                          : 'border-ink/12 bg-paper text-inkLight/45'"
                    >
                      <component :is="LEG_ICON[row.it.mode]" :size="13" />
                      <span class="font-cn text-[10px] whitespace-nowrap">{{ row.it.fromCity }}→{{ row.it.toCity }}</span>
                    </span>
                  </template>

                  <!-- POI 印章节点 -->
                  <template v-else>
                    <span
                      class="w-9 h-9 rounded-full border-2 flex items-center justify-center font-cn text-[12px] transition-all duration-300 shrink-0"
                      :class="[
                        stateOf(row.i) === 'now' ? 'node-now border-cinnabarDeep scale-110'
                          : stateOf(row.i) === 'done' ? 'border-ink/35 bg-ink/20 text-ink'
                            : 'border-ink/15 bg-mist text-inkLight/50',
                      ]"
                      :style="stateOf(row.i) === 'now' ? { background: CAT_COLOR[row.it.poi.category], color: '#FAF6ED' } : {}"
                    >{{ CATEGORY_LABEL[row.it.poi.category] }}</span>
                  </template>

                  <span class="flex-1 h-px" :class="i < stopsOf(day.dayIndex).length - 1 ? 'bg-ink/25' : 'opacity-0'"></span>
                </div>

                <!-- 名称 + 时刻 -->
                <p
                  class="mt-1.5 w-full text-center font-cn text-[11px] leading-tight truncate transition-colors duration-300"
                  :class="stateOf(row.i) === 'now' ? 'text-cinnabar' : stateOf(row.i) === 'done' ? 'text-ink/75' : 'text-inkLight/45'"
                >
                  <template v-if="row.it.kind === 'poi'">{{ row.it.poi.name }}</template>
                  <template v-else>{{ LEG_MODE_LABEL[row.it.mode] }}<span v-if="row.it.note" class="font-num"> · {{ row.it.note }}</span></template>
                </p>
                <p class="font-num text-[9px] text-inkLight/70 mt-0.5 truncate w-full text-center">
                  {{ row.it.kind === 'poi' ? (row.it.time ? row.it.time + ' 至' : '—') : (row.it.time ? row.it.time + ' 发' : '城际') }}
                </p>
              </div>
            </template>
          </div>
        </section>

        <div v-if="!items.length" class="py-16 text-center">
          <Flag :size="24" class="text-celadon mx-auto mb-2" />
          <p class="font-cn text-xs text-inkLight">尚无行程节点可回放</p>
        </div>
      </div>

      <!-- 控制条 -->
      <div class="px-5 py-3 border-t border-ink/15 shrink-0 space-y-2.5">
        <div class="flex items-center gap-2">
          <button class="w-9 h-9 shrink-0 flex items-center justify-center border border-ink/25 text-ink hover:border-cinnabar hover:text-cinnabar" title="上一站" @click="prev"><SkipBack :size="15" /></button>
          <button class="w-9 h-9 shrink-0 flex items-center justify-center bg-cinnabar text-mist hover:bg-cinnabarDeep" :title="playing ? '暂停' : '继续'" @click="togglePlay">
            <component :is="playing ? Pause : Play" :size="15" />
          </button>
          <button class="w-9 h-9 shrink-0 flex items-center justify-center border border-ink/25 text-ink hover:border-cinnabar hover:text-cinnabar" title="下一站" @click="next"><SkipForward :size="15" /></button>
          <button class="w-9 h-9 shrink-0 flex items-center justify-center border border-ink/25 text-ink hover:border-cinnabar hover:text-cinnabar" title="从头重播" @click="replay"><RotateCcw :size="15" /></button>

          <div class="flex-1 min-w-0 h-1.5 bg-ink/10 overflow-hidden rounded-full mx-1 cursor-pointer" title="点击跳转" @click="jumpProgress">
            <div class="h-full bg-cinnabar" :style="{ width: progressPct + '%' }"></div>
          </div>

          <button class="h-9 px-2 shrink-0 inline-flex items-center gap-1 border border-ink/25 text-inkLight font-num text-[10px] hover:border-cinnabar hover:text-cinnabar" title="切换速度" @click="cycleSpeed">
            <Gauge :size="12" /> {{ speed }}×
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <span class="font-cn text-[10px] text-inkLight mr-0.5">跳至</span>
          <button
            v-for="d in trip.days" :key="d.dayIndex"
            class="px-2.5 py-1 border font-cn text-[10px] transition-colors"
            :class="current?.dayIndex === d.dayIndex ? 'bg-cinnabar text-mist border-cinnabar' : 'border-ink/20 text-inkLight hover:border-celadon hover:text-celadonDeep'"
            @click="jumpDay(d.dayIndex)"
          >第 {{ d.dayIndex }} 日</button>
          <span class="ml-auto inline-flex items-center gap-1 font-cn text-[10px] text-inkLight/70"><MapPin :size="11" /> 点进度条可跳站</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.node-now { animation: nodeBreath 1.5s ease-in-out infinite; }
@keyframes nodeBreath {
  0%, 100% { box-shadow: 0 0 0 0 rgba(166, 72, 52, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(166, 72, 52, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .node-now { animation: none; box-shadow: 0 0 0 4px rgba(166, 72, 52, 0.28); }
}
</style>
