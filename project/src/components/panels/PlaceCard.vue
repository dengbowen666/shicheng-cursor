<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { annotateHighlight } from '../../lib/motion'
import {
  X, Heart, BookmarkCheck, CalendarPlus, Navigation, Wallet,
  PenLine, MapPin, Star, Clock, Stamp, Check, Coins,
} from 'lucide-vue-next'
import type { POI, ExpenseCategory, TransportMode } from '../../types'
import { CATEGORY_LABEL, EXPENSE_CATEGORIES } from '../../types'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { launchNavigation } from '../../lib/navigation'
import CityCover from '../overlay/CityCover.vue'

const props = defineProps<{ poi: POI; dayIndex?: number }>()
const emit = defineEmits<{ close: [] }>()

const trip = useTripStore()
const ui = useUiStore()

const coverFailed = ref(false)
const showExpense = ref(false)
const showNote = ref(false)
const expenseAmount = ref(0)
const expenseCat = ref<ExpenseCategory>('餐饮')
const noteDraft = ref(props.poi.note || '')
const titleRef = ref<HTMLElement | null>(null)

watch(() => props.poi.id, () => {
  coverFailed.value = false
  showExpense.value = false
  showNote.value = false
  noteDraft.value = props.poi.note || ''
})

onMounted(() => {
  // 题名手绘下划线：点睛一下，不抢戏
  if (titleRef.value) void annotateHighlight(titleRef.value, 'underline')
})

const wished = computed(() => trip.isWishlisted(props.poi.id))
const inDays = computed(() => trip.inDays(props.poi.id))
const targetDay = computed(() => props.dayIndex ?? ui.activeDayIndex)
const dayDate = computed(() => trip.activeTrip?.days.find(d => d.dayIndex === targetDay.value)?.date)

function yuan(cents: number) { return (cents / 100).toFixed(2) }
function undo() {
  const msg = trip.undo()
  if (msg) ui.toast(msg)
}

function toggleWish() {
  if (wished.value) {
    trip.removeFromWishlist(props.poi.id)
    ui.toast('已移出收藏池')
  } else {
    ui.toast(trip.addToWishlist(props.poi) ? '已收入收藏池' : '已在收藏池中')
  }
}

function addDay() {
  const res = trip.addToDay(props.poi, targetDay.value)
  if (!res.ok) { ui.toast('加入日程失败，请先打开一份行程'); return }
  if (res.existedIn?.includes(targetDay.value)) {
    ui.toast(`该处已在第 ${targetDay.value} 日`)
    return
  }
  ui.toast(`已加入第 ${targetDay.value} 日`, '撤销', undo)
  emit('close')
}

/** 按当前段方式导航：优先选中段，其次以该点为起点的出程段 */
function navMode(): TransportMode {
  const t = trip.activeTrip
  if (!t) return 'taxi'
  if (ui.selectedSegmentId && t.segments[ui.selectedSegmentId]) {
    return t.segments[ui.selectedSegmentId].mode
  }
  const day = t.days.find(d => d.dayIndex === targetDay.value)
  const out = (day?.segmentIds || [])
    .map(id => t.segments[id])
    .find(s => s?.fromPoiId === props.poi.id)
  return out?.mode || 'taxi'
}

function navigate() {
  launchNavigation(props.poi.name, props.poi.location, ui.mapKey || undefined, navMode())
  ui.toast('正在打开导航')
}

function saveExpense() {
  const cents = Math.round(Number(expenseAmount.value) * 100)
  if (!Number.isFinite(cents) || cents <= 0) { ui.toast('请填写有效金额'); return }
  trip.addExpense({
    dayIndex: targetDay.value, date: dayDate.value,
    amount: cents, category: expenseCat.value,
    title: props.poi.name, poiId: props.poi.id,
  })
  showExpense.value = false
  expenseAmount.value = 0
  ui.toast(`已记一笔 ¥${yuan(cents)}`, '撤销', undo)
}

function saveNote() {
  const text = noteDraft.value.trim().slice(0, 50)
  trip.addPoi(props.poi)
  trip.updatePoi(props.poi.id, { note: text })
  showNote.value = false
  ui.toast(text ? '题跋已落笔' : '题跋已清空')
}
</script>

<template>
  <div class="paper-card double-border w-full max-w-[460px] bg-mist rounded-sm overflow-hidden animate-fade-up">
    <!-- 封面：加载失败降级水墨渐变 -->
    <div class="relative h-40 overflow-hidden img-fallback">
      <CityCover :city="poi.city" />
      <img
        v-if="poi.coverImage && !coverFailed"
        :src="poi.coverImage"
        :alt="poi.name"
        class="absolute inset-0 w-full h-full object-cover"
        @error="coverFailed = true"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent"></div>
      <button
        type="button"
        class="absolute top-2 right-2 z-30 w-8 h-8 flex items-center justify-center bg-mist/95 text-ink hover:text-cinnabar rounded-sm pointer-events-auto"
        title="关闭" @click.stop="emit('close')"
      ><X :size="15" /></button>
      <div class="absolute left-3 bottom-2 right-3 flex items-end gap-2">
        <span class="seal w-7 h-7 text-[11px] shrink-0">{{ CATEGORY_LABEL[poi.category] }}</span>
        <div class="min-w-0">
          <h3 ref="titleRef" class="font-brush text-xl text-mist truncate drop-shadow inline-block max-w-full">{{ poi.name }}</h3>
          <p class="font-cn text-[10px] text-mist/80 truncate">{{ poi.city }} · {{ poi.address || '地址待补' }}</p>
        </div>
        <span v-if="poi.visitedAt" class="seal seal-stamp w-9 h-9 text-[10px] shrink-0 ml-auto">已至</span>
      </div>
    </div>

    <div class="px-4 py-3 space-y-3">
      <!-- 概览 -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-cn text-[11px] text-inkLight">
        <span v-if="poi.rating" class="inline-flex items-center gap-1 text-ochreDeep">
          <Star :size="12" fill="currentColor" /> {{ poi.rating.toFixed(1) }}
        </span>
        <span v-if="poi.pricePerPerson" class="inline-flex items-center gap-1">
          <Coins :size="12" /> 人均 ¥{{ poi.pricePerPerson }}
        </span>
        <span v-if="poi.openTime" class="inline-flex items-center gap-1">
          <Clock :size="12" /> {{ poi.openTime }}
        </span>
        <span v-if="poi.stayMinutes" class="inline-flex items-center gap-1">
          <MapPin :size="12" /> 建议 {{ poi.stayMinutes }} 分钟
        </span>
      </div>

      <p v-if="poi.intro" class="font-cn text-xs leading-relaxed text-ink/80 border-l-2 border-celadon/60 pl-3">
        {{ poi.intro }}
      </p>

      <div v-if="poi.tags?.length || inDays.length" class="flex flex-wrap gap-1.5">
        <span v-for="t in poi.tags" :key="t" class="tag-pill font-cn">{{ t }}</span>
        <span v-for="d in inDays" :key="d" class="font-cn text-[10px] text-celadonDeep border border-celadon/40 px-2 py-0.5 rounded-full">第 {{ d }} 日</span>
      </div>

      <!-- 操作 -->
      <div class="grid grid-cols-5 gap-1.5 pt-1">
        <button class="act-btn" :class="wished ? 'text-cinnabar border-cinnabar/40' : ''" @click="toggleWish">
          <component :is="wished ? BookmarkCheck : Heart" :size="16" />
          <span>{{ wished ? '已藏' : '收藏' }}</span>
        </button>
        <button class="act-btn" @click="addDay"><CalendarPlus :size="16" /><span>加日程</span></button>
        <button class="act-btn" @click="navigate"><Navigation :size="16" /><span>导航</span></button>
        <button class="act-btn" :class="showExpense ? 'text-cinnabar border-cinnabar/40' : ''" @click="showExpense = !showExpense; showNote = false">
          <Wallet :size="16" /><span>记一笔</span>
        </button>
        <button class="act-btn" :class="showNote ? 'text-cinnabar border-cinnabar/40' : ''" @click="showNote = !showNote; showExpense = false">
          <PenLine :size="16" /><span>题跋</span>
        </button>
      </div>

      <!-- 记一笔：金额以元录入，按分存储 -->
      <div v-if="showExpense" class="bg-paper/70 border border-ochre/30 p-3 space-y-2">
        <div class="flex items-center gap-2">
          <span class="font-cn text-[11px] text-ink shrink-0">金额（元）</span>
          <input v-model.number="expenseAmount" type="number" min="0" step="0.01" placeholder="0.00"
            class="w-24 h-8 px-2 bg-mist border border-ink/20 font-num text-sm text-ink outline-none focus:border-cinnabar" />
          <select v-model="expenseCat" class="flex-1 h-8 px-2 bg-mist border border-ink/20 font-cn text-xs text-ink outline-none focus:border-cinnabar">
            <option v-for="c in EXPENSE_CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="flex items-center justify-between">
          <span class="font-cn text-[10px] text-inkLight">记入第 {{ targetDay }} 日</span>
          <button class="inline-flex items-center gap-1 px-3 py-1 bg-cinnabar text-mist font-cn text-xs hover:bg-cinnabarDeep" @click="saveExpense">
            <Check :size="13" /> 落账
          </button>
        </div>
      </div>

      <!-- 题跋：不超过 50 字 -->
      <div v-if="showNote" class="bg-paper/70 border border-ochre/30 p-3 space-y-2">
        <textarea v-model="noteDraft" maxlength="50" rows="2" placeholder="题跋留白，至多五十字"
          class="w-full px-2 py-1.5 bg-mist border border-ink/20 font-cn text-xs text-ink outline-none focus:border-cinnabar resize-none"></textarea>
        <div class="flex items-center justify-between">
          <span class="font-num text-[10px] text-inkLight">{{ noteDraft.length }}/50</span>
          <button class="inline-flex items-center gap-1 px-3 py-1 bg-cinnabar text-mist font-cn text-xs hover:bg-cinnabarDeep" @click="saveNote">
            <Stamp :size="13" /> 落笔
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.act-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  height: 52px; border: 1px solid rgba(44,42,38,.18); color: #6E6A62;
  font-family: 'Noto Serif SC', serif; font-size: 10px;
  transition: color .18s, border-color .18s, background .18s;
}
.act-btn:hover { color: #A64834; border-color: rgba(166,72,52,.45); background: rgba(166,72,52,.05); }
</style>
