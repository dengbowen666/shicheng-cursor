<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { useCityStore } from '../../stores/city'
import { deriveDay, dayStats } from '../../lib/timeline'
import { CATEGORY_LABEL, MODE_LABEL } from '../../types'
import type { City, POI, TransportMode, TransportSegment } from '../../types'
import {
  X, ArrowUp, ArrowDown, Trash2, Home, PenLine, Clock, MapPin, ChevronDown, Search, Plus,
  Car, Footprints, Bus, Bike, AlertTriangle, TrainFront, Train, Plane, ArrowRight,
} from 'lucide-vue-next'
import { LEG_MODE_LABEL, LEG_MODE_COLOR } from '../../types'
import type { LegMode } from '../../types'

const props = defineProps<{ dayIndex: number }>()
const emit = defineEmits<{
  'select-poi': [id: string]
  'focus-poi': [id: string]
  'select-segment': [id: string]
  'insert-stop': [id: string]
  'add-leg': []
  'edit-leg': [id: string]
  close: []
}>()

const trip = useTripStore()
const ui = useUiStore()
const cityStore = useCityStore()

// O01：城市切换
const cityOpen = ref(false)
const cityKeyword = ref('')
const cityResults = computed(() => cityStore.searchCities(cityKeyword.value).slice(0, 8))
function undo() { const msg = trip.undo(); if (msg) ui.toast(msg) }

function pickCity(city: City) {
  const prev = day.value?.city
  if (prev === city.name) { cityOpen.value = false; return }
  trip.setDayCity(props.dayIndex, city)
  cityOpen.value = false
  cityKeyword.value = ''
  ui.toast(`第 ${props.dayIndex} 日已改为${city.name}`, '撤销', undo)
}

// O02：出发时间就地编辑
const editingDepart = ref(false)
const departDraft = ref('')
function startDepart() {
  editingDepart.value = true
  departDraft.value = day.value?.departTime || '09:00'
}
function commitDepart() {
  editingDepart.value = false
  const v = departDraft.value.trim()
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) && v !== (day.value?.departTime || '09:00')) {
    trip.setDayField(props.dayIndex, { departTime: v })
    ui.toast(`第 ${props.dayIndex} 日改为 ${v} 出发`, '撤销', undo)
  }
}

const day = computed(() => trip.activeTrip?.days.find(d => d.dayIndex === props.dayIndex) || null)
const poiMap = computed(() => trip.activeTrip?.pois || {})
const segmentMap = computed(() => trip.activeTrip?.segments || {})

// L02：本日城际段；新增时默认出发城 = 上一段到达城 / 当日主城
const legs = computed(() => trip.legsOfDay(props.dayIndex))
const defaultLegFrom = computed(() => {
  const list = legs.value
  return list.length ? list[list.length - 1].toCity : (day.value?.city || '')
})

// 跨城日的分隔提示（由 deriveDay 处理）
const prevCity = computed(() => {
  const days = trip.activeTrip?.days || []
  const idx = days.findIndex(d => d.dayIndex === props.dayIndex)
  return idx > 0 ? days[idx - 1]?.city : undefined
})

const legMap = computed(() => trip.activeTrip?.legs || {})
const timeline = computed(() => day.value
  ? deriveDay(day.value, poiMap.value, segmentMap.value, trip.activeTrip?.expenses, prevCity.value, legMap.value)
  : [])
const stats = computed(() => day.value ? dayStats(day.value, poiMap.value, segmentMap.value, legMap.value) : null)

/** 到达/离开时间由 deriveDay 统一推算，不自行计算 */
const poiTimes = computed(() => {
  const m = new Map<string, { arrive: string; leave: string }>()
  for (const e of timeline.value) {
    if (e.kind === 'poi') m.set(e.poiId, { arrive: e.arrive, leave: e.leave })
  }
  return m
})

// 驻地 role=base 不占白天时段，单独在夜间「宿 · XX」呈现
const stops = computed<POI[]>(() => (day.value?.poiIds || [])
  .map(id => poiMap.value[id])
  .filter((p): p is POI => !!p && p.role !== 'base'))
const basePoi = computed<POI | null>(() => {
  const id = day.value?.basePoiId
  return id && poiMap.value[id] ? poiMap.value[id] : null
})

/** 先入日程再连线：交通段由 store 依 poiIds 自动生成，这里只展示与改方式 */
function segmentBetween(fromId: string, toId: string): TransportSegment | null {
  const ids = day.value?.segmentIds || []
  for (const id of ids) {
    const s = segmentMap.value[id]
    if (s && s.fromPoiId === fromId && s.toPoiId === toId) return s
  }
  return null
}

const MODE_ICON: Record<TransportMode, typeof Footprints> = {
  walk: Footprints, taxi: Car, transit: Bus, bike: Bike,
}
const LEG_ICON: Record<LegMode, typeof TrainFront> = {
  highspeed: TrainFront, train: Train, flight: Plane, car: Car, coach: Bus, walk: Footprints,
}
const MODE_CLASS: Record<TransportMode, string> = {
  walk: 'text-cyanq border-cyanq/50',
  taxi: 'text-ochre border-ochre/50',
  transit: 'text-inkLight border-hill',
  bike: 'text-celadonDeep border-celadonDeep/50',
}
function needKey(seg: TransportSegment) {
  return seg.mode === 'transit' && seg.durationMin === 0
}

// 停留时长可改
const editingStay = ref<string | null>(null)
const stayDraft = ref('')
function startStay(poi: POI) {
  editingStay.value = poi.id
  stayDraft.value = String(poi.stayMinutes ?? 60)
}
function commitStay(poi: POI) {
  const v = Number.parseInt(stayDraft.value, 10)
  if (!Number.isNaN(v) && v >= 0 && v <= 1440) trip.updatePoi(poi.id, { stayMinutes: v })
  editingStay.value = null
}

// 删除确认 + 统一撤销（O03）
const confirmingRemove = ref<string | null>(null)
function removePoi(poi: POI) {
  if (confirmingRemove.value !== poi.id) {
    confirmingRemove.value = poi.id
    return
  }
  confirmingRemove.value = null
  trip.removeFromDay(poi.id, props.dayIndex)
  ui.toast(`已移出「${poi.name}」`, '撤销', () => { const m = trip.undo(); if (m) ui.toast(m) })
}

// 设驻地：store 内原子完成，内部多次 mutation 合并一条快照
function toggleBase(poi: POI) {
  const wasBase = day.value?.basePoiId === poi.id
  trip.toggleBasePoi(props.dayIndex, poi.id)
  ui.toast(wasBase ? '已取消驻地' : `已设「${poi.name}」为驻地`)
}

function openAnnotate() {
  ui.annotateMode = true
  ui.toast('题跋模式已开启 · 可在地图上落笔')
}

const moveMenuFor = ref<string | null>(null)
function moveToDay(poi: POI, toDay: number) {
  if (toDay === props.dayIndex) return
  trip.movePoi(poi.id, props.dayIndex, toDay)
  moveMenuFor.value = null
  ui.toast(`已移到第 ${toDay} 日`, '撤销', () => { const m = trip.undo(); if (m) ui.toast(m) })
}
function onDragStart(e: DragEvent, poi: POI) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('application/x-shicheng-poi', JSON.stringify({ poiId: poi.id, fromDay: props.dayIndex }))
  e.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <section class="flex flex-col h-full bg-paper text-ink overflow-hidden">
    <!-- 卷轴头 -->
    <header class="shrink-0 paper-texture border-b border-ink/20 px-4 py-3 relative z-20">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="seal w-7 h-7 text-xs shrink-0">第{{ dayIndex }}</span>
            <h2 class="font-brush text-base text-ink truncate">{{ day?.title || `Day ${dayIndex}` }}</h2>
          </div>
          <p class="font-cn text-[10px] text-inkLight mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <button class="inline-flex items-center gap-1 hover:text-cinnabar border-b border-dashed border-ink/30" title="改这一天所在城市" @click="cityOpen = !cityOpen; editingDepart = false">
              <MapPin :size="10" />{{ day?.city }} <ChevronDown :size="10" />
            </button>
            <template v-if="editingDepart">
              <input
                v-model="departDraft" type="time"
                class="h-5 w-[72px] px-1 bg-mist border border-cyanq/60 outline-none font-num text-[10px] text-ink"
                @keydown.enter="commitDepart" @blur="commitDepart"
              />
            </template>
            <button v-else class="inline-flex items-center gap-1 hover:text-cinnabar border-b border-dashed border-ink/30" title="改出发时间" @click="startDepart(); cityOpen = false">
              <Clock :size="10" />{{ day?.departTime || '09:00' }} 出发
            </button>
            <span v-if="stats">· {{ stats.stopCount }} 处 · 交通 {{ stats.travelMin }} 分 · 约 {{ stats.endTime }} 毕</span>
          </p>
        </div>
        <button class="w-8 h-8 shrink-0 flex items-center justify-center text-inkLight hover:text-cinnabar border border-ink/20 hover:border-cinnabar/50" title="收起" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
      <p class="font-cn text-[10px] text-inkLight/80 mt-2">先入日程，路线自动相连；点交通条可改方式</p>

      <!-- O01：城市切换浮层 -->
      <div v-if="cityOpen" class="absolute left-3 right-3 top-full mt-1 z-30 paper-card p-2 shadow-paper">
        <div class="flex items-center gap-1.5 h-8 px-2 bg-mist border border-ink/20">
          <Search :size="12" class="text-inkLight shrink-0" />
          <input v-model="cityKeyword" class="flex-1 min-w-0 bg-transparent outline-none font-cn text-[11px] text-ink" placeholder="搜城市，改这一天所在地" @keydown.esc="cityOpen = false" />
          <button class="text-inkLight hover:text-cinnabar" @click="cityOpen = false"><X :size="12" /></button>
        </div>
        <div class="max-h-[200px] overflow-y-auto mt-1.5 drawer-scroll">
          <button v-for="c in cityResults" :key="c.id" type="button"
            class="w-full text-left px-2 py-1.5 font-cn text-[11px] hover:bg-cinnabar/8 flex items-center justify-between"
            :class="c.name === day?.city ? 'text-cinnabar' : 'text-ink'"
            @click="pickCity(c)">
            <span>{{ c.name }}</span><span class="text-inkLight text-[10px]">{{ c.province }}</span>
          </button>
          <p v-if="!cityResults.length" class="text-center font-cn text-[10px] text-inkLight py-3">未找到该城市</p>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
      <!-- 空态 -->
      <div v-if="!day || (!stops.length && !basePoi && !legs.length)" class="text-center py-12">
        <p class="font-brush text-lg text-ink/60">第{{ dayIndex }}日尚是空白</p>
        <p class="font-cn text-[11px] text-inkLight mt-1">地图上单击推荐印章看详情，再点「加日程」</p>
        <button class="mt-4 px-4 py-2 border border-dashed border-ink/30 text-inkLight font-cn text-[11px] hover:border-cinnabar/50 hover:text-cinnabar inline-flex items-center gap-1.5" @click="emit('add-leg')">
          <Plus :size="13" /> 或先增设一段城际
        </button>
      </div>

      <template v-else>
        <!-- L02/L03：城际段——一等公民，可点编辑/删除 -->
        <template v-if="legs.length">
          <button
            v-for="leg in legs" :key="leg.id"
            class="w-full paper-card px-3 py-2 flex items-center gap-2.5 text-left hover:border-cinnabar/50 transition-colors"
            :title="`编辑城际段 · ${leg.fromCity}→${leg.toCity}`"
            @click="emit('edit-leg', leg.id)"
          >
            <span class="w-7 h-7 shrink-0 flex items-center justify-center border" :style="{ color: LEG_MODE_COLOR[leg.mode], borderColor: LEG_MODE_COLOR[leg.mode] }">
              <component :is="LEG_ICON[leg.mode]" :size="15" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5 font-cn text-[13px] text-ink">
                {{ leg.fromCity }} <ArrowRight :size="12" class="text-cinnabar shrink-0" /> {{ leg.toCity }}
              </span>
              <span class="block font-cn text-[10px] text-inkLight mt-0.5">
                {{ LEG_MODE_LABEL[leg.mode] }}
                <template v-if="leg.departTime"> · {{ leg.departTime }}<template v-if="leg.arriveTime">–{{ leg.arriveTime }}</template></template>
                <template v-if="leg.note"> · {{ leg.note }}</template>
                <span v-if="leg.estimated" class="text-cinnabar"> · 估</span>
              </span>
            </span>
            <PenLine :size="13" class="text-inkLight/60 shrink-0" />
          </button>
        </template>
        <!-- 兼容旧数据：无 Leg 但仍是跨城日时，保留分隔提示 -->
        <div v-else-if="timeline.some(e => e.kind === 'divider')" class="ink-divider my-2">
          <span class="block text-center font-cn text-[10px] text-inkLight">
            {{ (timeline.find(e => e.kind === 'divider') as any)?.label }}
          </span>
        </div>

        <template v-for="(poi, i) in stops" :key="`${poi.id}-${i}`">
          <!-- 到达该点的交通段 -->
          <div v-if="i > 0 && segmentBetween(stops[i - 1].id, poi.id)" class="relative pl-4 py-1">
            <span class="absolute left-[15px] top-0 bottom-0 border-l border-dashed border-ink/25"></span>
            <button
              class="relative inline-flex items-center gap-1.5 px-2 py-1 bg-mist border font-cn text-[11px] hover:bg-paper transition-colors"
              :class="MODE_CLASS[segmentBetween(stops[i - 1].id, poi.id)!.mode]"
              :title="`改交通方式 · ${segmentBetween(stops[i - 1].id, poi.id)!.mode}`"
              @click="emit('select-segment', segmentBetween(stops[i - 1].id, poi.id)!.id)"
            >
              <component :is="MODE_ICON[segmentBetween(stops[i - 1].id, poi.id)!.mode]" :size="12" />
              <span>{{ MODE_LABEL[segmentBetween(stops[i - 1].id, poi.id)!.mode] }}</span>
              <span v-if="segmentBetween(stops[i - 1].id, poi.id)!.distanceKm" class="font-num text-[10px] opacity-80">
                {{ segmentBetween(stops[i - 1].id, poi.id)!.distanceKm }}km
              </span>
              <span v-if="!needKey(segmentBetween(stops[i - 1].id, poi.id)!)" class="font-num text-[10px] opacity-80">
                {{ segmentBetween(stops[i - 1].id, poi.id)!.durationMin }}分
              </span>
              <span v-if="segmentBetween(stops[i - 1].id, poi.id)!.estimated" class="text-cinnabar text-[10px]">估</span>
              <span v-if="needKey(segmentBetween(stops[i - 1].id, poi.id)!)" class="inline-flex items-center gap-0.5 text-cinnabar text-[10px]">
                <AlertTriangle :size="10" />需 Key
              </span>
              <span v-if="segmentBetween(stops[i - 1].id, poi.id)!.pinned" class="text-cinnabar text-[9px] border-l border-ink/20 pl-1.5">固定</span>
            </button>
            <button
              class="ml-1 inline-flex items-center justify-center h-5 w-5 border border-ink/20 text-inkLight hover:border-cinnabar hover:text-cinnabar align-middle"
              :title="'在这段之间插入一处经停'"
              @click="emit('insert-stop', segmentBetween(stops[i - 1].id, poi.id)!.id)"
            ><Plus :size="12" /></button>
          </div>

          <!-- POI 卡片：桌面可拖到 DayRail 跨日 -->
          <article
            class="paper-card px-3 py-2.5 flex items-start gap-2.5"
            :class="confirmingRemove === poi.id ? 'border-cinnabar' : ''"
            draggable="true"
            @dragstart="onDragStart($event, poi)"
          >
            <button class="seal w-6 h-6 text-[11px] shrink-0 mt-0.5 focus-poi-seal" :class="ui.selectedPoiId === poi.id ? 'ring-1 ring-cinnabar' : ''" @click="emit('focus-poi', poi.id)" :title="`在地图上聚焦 ${poi.name}`">
              {{ CATEGORY_LABEL[poi.category] }}
            </button>
            <div class="flex-1 min-w-0">
              <button class="block text-left font-cn text-sm text-ink truncate hover:text-cinnabar focus-poi-name" @click="emit('focus-poi', poi.id)" title="在地图上聚焦此处；点左侧印章看详情">
                {{ poi.name }}
              </button>
              <div class="font-num text-[11px] text-cinnabar mt-0.5">
                {{ poiTimes.get(poi.id)?.arrive || '--:--' }}
                <span class="text-inkLight">→</span>
                {{ poiTimes.get(poi.id)?.leave || '--:--' }}
              </div>

              <!-- 停留时长可改 -->
              <div class="mt-1.5 flex items-center gap-1 font-cn text-[10px] text-inkLight">
                <Clock :size="10" />
                <span>停</span>
                <template v-if="editingStay === poi.id">
                  <input
                    v-model="stayDraft" type="number" min="0" max="1440"
                    class="w-14 h-6 px-1 bg-mist border border-cyanq/60 outline-none font-num text-[11px] text-ink"
                    @keydown.enter="commitStay(poi)" @blur="commitStay(poi)"
                  />
                  <span>分</span>
                </template>
                <button v-else class="px-1.5 py-0.5 border border-ink/20 hover:border-cinnabar/60 text-ink hover:text-cinnabar" @click="startStay(poi)">
                  {{ poi.stayMinutes ?? 60 }} 分 · 改
                </button>
              </div>
            </div>

            <!-- 移动端按钮菜单，不做拖拽 -->
            <div class="shrink-0 flex flex-col items-center gap-0.5 relative">
              <button class="p-1 text-inkLight/70 hover:text-ink disabled:opacity-30" :disabled="i === 0" title="上移" @click="trip.reorderPoi(poi.id, dayIndex, -1)">
                <ArrowUp :size="13" />
              </button>
              <button class="p-1 text-inkLight/70 hover:text-ink disabled:opacity-30" :disabled="i === stops.length - 1" title="下移" @click="trip.reorderPoi(poi.id, dayIndex, 1)">
                <ArrowDown :size="13" />
              </button>
              <button class="p-1 hover:text-ochre" :class="day?.basePoiId === poi.id ? 'text-cinnabar' : 'text-inkLight/70'" title="设/取消驻地" @click="toggleBase(poi)">
                <Home :size="13" />
              </button>
              <button
                class="p-1 text-inkLight/70 hover:text-cinnabar font-cn text-[9px]"
                title="移到其他日"
                @click="moveMenuFor = moveMenuFor === poi.id ? null : poi.id"
              >日</button>
              <button
                class="p-1 hover:text-cinnabar"
                :class="confirmingRemove === poi.id ? 'text-cinnabar' : 'text-inkLight/70'"
                :title="confirmingRemove === poi.id ? '再点一次确认移出' : '移出日程'"
                @click="removePoi(poi)"
              >
                <Trash2 :size="13" />
              </button>
              <span v-if="confirmingRemove === poi.id" class="font-cn text-[9px] text-cinnabar whitespace-nowrap">确认移出？</span>
              <div
                v-if="moveMenuFor === poi.id"
                class="absolute right-8 top-0 z-10 paper-card p-1.5 min-w-[88px] shadow-paper"
              >
                <p class="font-cn text-[9px] text-inkLight px-1 pb-1">移到</p>
                <button
                  v-for="d in trip.activeTrip?.days || []" :key="d.dayIndex"
                  type="button"
                  class="w-full text-left px-2 py-1 font-cn text-[11px] hover:bg-cinnabar/8"
                  :class="d.dayIndex === dayIndex ? 'text-inkLight/40 pointer-events-none' : 'text-ink'"
                  @click="moveToDay(poi, d.dayIndex)"
                >第 {{ d.dayIndex }} 日</button>
              </div>
            </div>
          </article>
        </template>

        <!-- 夜间驻地 -->
        <div v-if="basePoi" class="mt-2 pt-2 border-t border-dashed border-ink/20 flex items-center gap-2 font-cn text-xs text-ink">
          <Home :size="13" class="text-ochre" />
          <span>宿 · {{ basePoi.name }}</span>
          <span class="ml-auto font-cn text-[10px] text-inkLight">夜间锚点 · 不占白天</span>
        </div>

        <!-- L02：增设城际段入口 -->
        <button class="w-full mt-3 py-2 border border-dashed border-ink/30 text-inkLight font-cn text-[11px] hover:border-cinnabar/50 hover:text-cinnabar flex items-center justify-center gap-1.5" @click="emit('add-leg')">
          <Plus :size="13" /> 增设城际段 · 从{{ defaultLegFrom }}去往他城
        </button>

        <!-- 题跋入口 -->
        <button class="w-full mt-3 py-2 border border-dashed border-cinnabar/50 text-cinnabar font-cn text-[11px] hover:bg-cinnabar/5 flex items-center justify-center gap-1.5" @click="openAnnotate">
          <PenLine :size="13" /> 为此日题跋
        </button>
      </template>
    </div>
  </section>
</template>
