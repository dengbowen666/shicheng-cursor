<script setup lang="ts">
/** 横向日签：比竖排轨道更省宽度，避免左栏文字被压成省略号。 */
import { computed } from 'vue'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { Minus, Plus } from 'lucide-vue-next'

const trip = useTripStore()
const ui = useUiStore()

const active = computed(() => ui.activeDayIndex)
const currentTrip = computed(() => trip.activeTrip)
const todayIndex = computed(() => {
  const t = currentTrip.value
  if (!t?.startDate) return 0
  const n = Math.floor((Date.now() - new Date(t.startDate).getTime()) / 86400000) + 1
  return n >= 1 && n <= t.days.length ? n : 0
})

function selectDay(n: number) {
  ui.activeDayIndex = n
  ui.viewMode = 'day'
  // 桌面右栏可收；移动端保留当前 sheet 页签，方便换日后继续看日程
  if (!ui.isMobile) ui.closeDrawer()
}
function addDay() {
  trip.addDay()
  ui.activeDayIndex = currentTrip.value?.days.length || 1
  ui.toast('已加一天')
}
function removeDay() {
  const t = currentTrip.value
  if (!t || t.days.length <= 1) {
    ui.toast('至少保留一天')
    return
  }
  const n = active.value
  const day = t.days.find(d => d.dayIndex === n)
  const nPois = day?.poiIds.length || 0
  if (nPois && !window.confirm(`第 ${n} 日有 ${nPois} 处地点，减去后会放回心愿池。确定减去？`)) return
  trip.removeDay(n)
  const max = currentTrip.value?.days.length || 1
  ui.activeDayIndex = Math.min(n, max)
  ui.toast('已减去一天', '撤销', () => trip.undo())
}

/** 桌面：从日程面板拖 POI 落到某日（D25 / D83） */
function onDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('application/x-shicheng-poi')) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}
function onDrop(e: DragEvent, toDay: number) {
  e.preventDefault()
  const raw = e.dataTransfer?.getData('application/x-shicheng-poi')
  if (!raw) return
  try {
    const { poiId, fromDay } = JSON.parse(raw) as { poiId: string; fromDay: number }
    if (!poiId || fromDay === toDay) return
    trip.movePoi(poiId, fromDay, toDay)
    ui.activeDayIndex = toDay
    ui.toast(`已移到第 ${toDay} 日`, '撤销', () => trip.undo())
  } catch { /* ignore */ }
}
</script>

<template>
  <div class="shrink-0 border-b border-ink/15 bg-paper/35">
    <div class="flex items-center gap-1 px-2.5 py-2 overflow-x-auto hide-scrollbar">
      <span class="shrink-0 font-cn text-[8px] tracking-[0.28em] text-inkLight/75 mr-1">日程</span>
      <button
        v-for="d in currentTrip?.days || []" :key="d.dayIndex"
        class="relative shrink-0 min-w-[54px] px-2 py-1.5 border text-left transition-colors"
        :class="active === d.dayIndex
          ? 'bg-cinnabar text-mist border-cinnabar shadow-seal'
          : 'bg-mist/65 text-inkLight border-ink/15 hover:border-celadon'"
        @click="selectDay(d.dayIndex)"
        @dragover="onDragOver"
        @drop="onDrop($event, d.dayIndex)"
      >
        <span class="block font-num text-[13px] leading-none">{{ String(d.dayIndex).padStart(2, '0') }}</span>
        <span class="block font-cn text-[8px] truncate mt-1" :class="active === d.dayIndex ? 'text-mist/75' : 'text-inkLight/75'">{{ d.city }}</span>
        <span v-if="todayIndex === d.dayIndex" class="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-cinnabar ring-1 ring-paper"></span>
      </button>
      <button class="shrink-0 w-8 h-8 border border-dashed border-celadon text-celadonDeep flex items-center justify-center hover:bg-celadon/10" title="加一天" @click="addDay">
        <Plus :size="13" />
      </button>
      <button
        class="shrink-0 w-8 h-8 border border-dashed border-ink/25 text-inkLight flex items-center justify-center hover:border-cinnabar/50 hover:text-cinnabar disabled:opacity-30"
        title="减去当前日"
        :disabled="(currentTrip?.days.length || 0) <= 1"
        @click="removeDay"
      >
        <Minus :size="13" />
      </button>
    </div>
  </div>
</template>
