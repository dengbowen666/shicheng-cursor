<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { deriveDay, dayStats } from '../../lib/timeline'
import { CATEGORY_LABEL, MODE_LABEL } from '../../types'
import type { POI, TransportMode, TransportSegment } from '../../types'
import {
  X, ArrowUp, ArrowDown, Trash2, Home, PenLine, Clock, MapPin,
  Car, Footprints, Bus, Bike, AlertTriangle,
} from 'lucide-vue-next'

const props = defineProps<{ dayIndex: number }>()
const emit = defineEmits<{
  'select-poi': [id: string]
  'select-segment': [id: string]
  close: []
}>()

const trip = useTripStore()
const ui = useUiStore()

const day = computed(() => trip.activeTrip?.days.find(d => d.dayIndex === props.dayIndex) || null)
const poiMap = computed(() => trip.activeTrip?.pois || {})
const segmentMap = computed(() => trip.activeTrip?.segments || {})

// 跨城日的分隔提示（由 deriveDay 处理）
const prevCity = computed(() => {
  const days = trip.activeTrip?.days || []
  const idx = days.findIndex(d => d.dayIndex === props.dayIndex)
  return idx > 0 ? days[idx - 1]?.city : undefined
})

const timeline = computed(() => day.value
  ? deriveDay(day.value, poiMap.value, segmentMap.value, trip.activeTrip?.expenses, prevCity.value)
  : [])
const stats = computed(() => day.value ? dayStats(day.value, poiMap.value, segmentMap.value) : null)

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

// 删除确认 + toast 撤销
const confirmingRemove = ref<string | null>(null)
function removePoi(poi: POI, at: number) {
  if (confirmingRemove.value !== poi.id) {
    confirmingRemove.value = poi.id
    return
  }
  confirmingRemove.value = null
  trip.removeFromDay(poi.id, props.dayIndex)
  ui.toast(`已移出「${poi.name}」`, '撤销', () => trip.addToDay(poi, props.dayIndex, at))
}

// 设驻地：旧驻地回退为途经点，重建交通条
function toggleBase(poi: POI) {
  const t = trip.activeTrip
  if (!t) return
  if (day.value?.basePoiId === poi.id) {
    trip.setDayField(props.dayIndex, { basePoiId: undefined })
    trip.updatePoi(poi.id, { role: 'stop' })
    trip.rebuildSegments(props.dayIndex)
    ui.toast('已取消驻地')
    return
  }
  const oldBase = day.value?.basePoiId
  if (oldBase && poiMap.value[oldBase]) trip.updatePoi(oldBase, { role: 'stop' })
  trip.setDayField(props.dayIndex, { basePoiId: poi.id })
  trip.updatePoi(poi.id, { role: 'base' })
  trip.rebuildSegments(props.dayIndex)
  ui.toast(`已设「${poi.name}」为驻地`)
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
  ui.toast(`已移到第 ${toDay} 日`, '撤销', () => trip.undo())
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
    <header class="shrink-0 paper-texture border-b border-ink/20 px-4 py-3">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="seal w-7 h-7 text-xs shrink-0">第{{ dayIndex }}</span>
            <h2 class="font-brush text-base text-ink truncate">{{ day?.title || `Day ${dayIndex}` }}</h2>
          </div>
          <p class="font-cn text-[10px] text-inkLight mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span class="inline-flex items-center gap-1"><MapPin :size="10" />{{ day?.city }}</span>
            <span class="inline-flex items-center gap-1"><Clock :size="10" />{{ day?.departTime || '09:00' }} 出发</span>
            <span v-if="stats">· {{ stats.stopCount }} 处 · 交通 {{ stats.travelMin }} 分 · 约 {{ stats.endTime }} 毕</span>
          </p>
        </div>
        <button class="w-8 h-8 shrink-0 flex items-center justify-center text-inkLight hover:text-cinnabar border border-ink/20 hover:border-cinnabar/50" title="收起" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
      <p class="font-cn text-[10px] text-inkLight/80 mt-2">先入日程，路线自动相连；点交通条可改方式</p>
    </header>

    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
      <!-- 空态 -->
      <div v-if="!day || !stops.length && !basePoi" class="text-center py-12">
        <p class="font-brush text-lg text-ink/60">第{{ dayIndex }}日尚是空白</p>
        <p class="font-cn text-[11px] text-inkLight mt-1">地图上单击推荐印章看详情，再点「加日程」</p>
      </div>

      <template v-else>
        <!-- 跨城分隔 -->
        <div v-if="timeline.some(e => e.kind === 'divider')" class="ink-divider my-2">
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
            </button>
          </div>

          <!-- POI 卡片：桌面可拖到 DayRail 跨日 -->
          <article
            class="paper-card px-3 py-2.5 flex items-start gap-2.5"
            :class="confirmingRemove === poi.id ? 'border-cinnabar' : ''"
            draggable="true"
            @dragstart="onDragStart($event, poi)"
          >
            <button class="seal w-6 h-6 text-[11px] shrink-0 mt-0.5" @click="emit('select-poi', poi.id)" :title="`查看 ${poi.name}`">
              {{ CATEGORY_LABEL[poi.category] }}
            </button>
            <div class="flex-1 min-w-0">
              <button class="block text-left font-cn text-sm text-ink truncate hover:text-cinnabar" @click="emit('select-poi', poi.id)">
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
                @click="removePoi(poi, day.poiIds.indexOf(poi.id))"
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

        <!-- 题跋入口 -->
        <button class="w-full mt-3 py-2 border border-dashed border-cinnabar/50 text-cinnabar font-cn text-[11px] hover:bg-cinnabar/5 flex items-center justify-center gap-1.5" @click="openAnnotate">
          <PenLine :size="13" /> 为此日题跋
        </button>
      </template>
    </div>
  </section>
</template>
