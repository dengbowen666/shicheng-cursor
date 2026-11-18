<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import {
  X, Wallet, Coins, Plus, Pencil, Trash2, Check, Undo2,
  AlertTriangle, Route, ChevronDown, CircleAlert,
} from 'lucide-vue-next'
import type { Expense, ExpenseCategory } from '../../types'
import { EXPENSE_CATEGORIES } from '../../types'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'

use([CanvasRenderer, PieChart, BarChart, TooltipComponent, GridComponent])

const props = defineProps<{ dayIndex?: number }>()
const emit = defineEmits<{ close: [] }>()

const trip = useTripStore()
const ui = useUiStore()

const scopeDay = computed(() => props.dayIndex ?? ui.activeDayIndex)
const dayScoped = computed(() => props.dayIndex !== undefined)
const expenses = computed(() => {
  const all = trip.activeTrip?.expenses || []
  return dayScoped.value ? all.filter(e => e.dayIndex === scopeDay.value) : all
})
const spent = computed(() => expenses.value.reduce((s, e) => s + e.amount, 0))
/** 日抽屉不把「当日花费」和「全程预算」比成逾制；全程预算仅在总览口径下判超支 */
const budget = computed(() => (dayScoped.value ? 0 : (trip.activeTrip?.totalBudget || 0)))
const tripBudget = computed(() => trip.activeTrip?.totalBudget || 0)
const tripSpent = computed(() => (trip.activeTrip?.expenses || []).reduce((s, e) => s + e.amount, 0))
const overspent = computed(() => budget.value > 0 && spent.value > budget.value)
const remainder = computed(() => budget.value - spent.value)
const ratio = computed(() => budget.value > 0 ? Math.min(100, Math.round(spent.value / budget.value * 100)) : 0)
const hasBudget = computed(() => budget.value > 0)

function yuan(cents: number) { return (cents / 100).toFixed(2) }
function undo() { const msg = trip.undo(); if (msg) ui.toast(msg) }

const byCategory = computed(() => EXPENSE_CATEGORIES.map(c => ({
  name: c,
  value: Math.round(expenses.value.filter(e => e.category === c).reduce((s, e) => s + e.amount, 0)) / 100,
})))

const C = { cinnabar: '#A64834', celadon: '#8FA9A6', hill: '#D9CFC0', inkLight: '#6E6A62', ochre: '#B08D70' }

const pieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b} ¥{c} ({d}%)' },
  series: [{
    type: 'pie', radius: ['64%', '84%'], center: ['50%', '50%'], silent: true,
    label: { show: false },
    data: [
      { value: Math.round(spent.value) / 100, name: '已用', itemStyle: { color: overspent.value ? C.cinnabar : C.celadon } },
      { value: Math.max(0, Math.round(remainder.value)) / 100, name: '结余', itemStyle: { color: C.hill } },
    ],
  }],
}))

const barOption = computed(() => ({
  grid: { left: 46, right: 12, top: 14, bottom: 24 },
  tooltip: { trigger: 'axis', formatter: '{b}: ¥{c}' },
  xAxis: {
    type: 'category', data: EXPENSE_CATEGORIES,
    axisLabel: { fontSize: 10, color: C.inkLight }, axisTick: { show: false },
  },
  yAxis: { type: 'value', axisLabel: { fontSize: 10, color: C.inkLight }, splitLine: { lineStyle: { color: 'rgba(44,42,38,.08)' } } },
  series: [{
    type: 'bar', barWidth: '54%',
    itemStyle: { color: overspent.value ? C.cinnabar : C.ochre, borderRadius: [3, 3, 0, 0] },
    data: byCategory.value.map(x => x.value),
  }],
}))

// —— 明细增删改 ——
const showForm = ref(false)
const editingId = ref<string | null>(null)
const formTitle = ref('')
const formAmount = ref(0)
const formCat = ref<ExpenseCategory>('餐饮')
const formDay = ref(scopeDay.value)
const confirmId = ref<string | null>(null)
const dayOptions = computed(() => trip.activeTrip?.days.map(d => d.dayIndex) || [])

watch(scopeDay, v => { formDay.value = v })

function resetForm() {
  editingId.value = null
  formTitle.value = ''
  formAmount.value = 0
  formCat.value = '餐饮'
  formDay.value = scopeDay.value
}

function submit() {
  const cents = Math.round(Number(formAmount.value) * 100)
  if (!formTitle.value.trim()) { ui.toast('请填写项目名'); return }
  if (!Number.isFinite(cents) || cents <= 0) { ui.toast('请填写有效金额'); return }
  const date = trip.activeTrip?.days.find(d => d.dayIndex === formDay.value)?.date
  if (editingId.value) {
    trip.updateExpense(editingId.value, { title: formTitle.value.trim(), amount: cents, category: formCat.value, dayIndex: formDay.value, date })
    ui.toast('已改账')
  } else {
    trip.addExpense({ title: formTitle.value.trim(), amount: cents, category: formCat.value, dayIndex: formDay.value, date })
    ui.toast(`已记一笔 ¥${yuan(cents)}`, '撤销', undo)
  }
  showForm.value = false
  resetForm()
}

function edit(e: Expense) {
  editingId.value = e.id
  formTitle.value = e.title
  formAmount.value = e.amount / 100
  formCat.value = e.category
  formDay.value = e.dayIndex
  showForm.value = true
}

function remove(e: Expense) {
  if (confirmId.value !== e.id) { confirmId.value = e.id; return }
  trip.deleteExpense(e.id)
  confirmId.value = null
  if (editingId.value === e.id) resetForm()
  ui.toast('已删除账目', '撤销', undo)
}

/** 交通段预填：把有估算车费的段补成交通类账目（cost 为元，入库按分）。 */
function prefillTransport() {
  const t = trip.activeTrip
  if (!t) return
  const ids = props.dayIndex === undefined ? Object.keys(t.segments) : (t.days.find(d => d.dayIndex === scopeDay.value)?.segmentIds || [])
  let added = 0
  for (const sid of ids) {
    const seg = t.segments[sid]
    if (!seg?.cost) continue
    const from = t.pois[seg.fromPoiId]?.name || '?'
    const to = t.pois[seg.toPoiId]?.name || '?'
    const title = `${from} → ${to}`
    if (t.expenses.some(e => e.title === title && e.category === '交通')) continue
    trip.addExpense({
      title, amount: Math.round(seg.cost * 100), category: '交通',
      dayIndex: props.dayIndex === undefined ? (t.days.find(d => d.segmentIds.includes(sid))?.dayIndex || 1) : scopeDay.value,
    })
    added++
  }
  ui.toast(added ? `已预填 ${added} 笔交通开销` : '没有可预填的交通费用', added ? '撤销' : undefined, added ? undo : undefined)
}
</script>

<template>
  <aside class="scroll-drawer absolute inset-y-0 right-0 z-40 w-full max-w-[500px] bg-paper/98 paper-texture shadow-drawer border-l border-ink/25 flex flex-col" :class="overspent ? 'is-over' : ''">
    <div class="scroll-axis h-1.5 w-full shrink-0"></div>

    <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-ink/15">
      <div class="flex items-center gap-2">
        <span class="seal w-8 h-8 text-xs">{{ overspent ? '逾' : '账' }}</span>
        <div>
          <h2 class="font-brush text-xl text-ink leading-tight">{{ dayIndex ? `第 ${dayIndex} 日记账` : '全程账本' }}</h2>
          <p class="font-cn text-[10px] text-inkLight tracking-wider">六类分明 · 分厘不差</p>
        </div>
      </div>
      <button class="w-8 h-8 shrink-0 flex items-center justify-center border border-ink/20 text-inkLight hover:text-cinnabar" title="合卷" @click="emit('close')">
        <X :size="16" />
      </button>
    </header>

    <div class="flex-1 overflow-y-auto drawer-scroll px-5 py-4 space-y-4">
      <!-- 逾制提示 -->
      <div v-if="overspent" class="flex items-center gap-3 bg-cinnabar/10 border border-cinnabar/40 px-4 py-3 seal-stamp">
        <CircleAlert :size="20" class="text-cinnabar shrink-0" />
        <div>
          <p class="font-brush text-lg text-cinnabar">已逾制</p>
          <p class="font-cn text-[11px] text-inkLight">支出 ¥{{ yuan(spent) }}，超出预算 ¥{{ yuan(-remainder) }}</p>
        </div>
        <span class="seal w-12 h-12 text-sm ml-auto">逾制</span>
      </div>

      <!-- 总览：有预算显示环形 + 柱状，无预算只显示累计支出 -->
      <template v-if="hasBudget">
        <div class="paper-card p-3 grid grid-cols-2 gap-3">
          <div class="relative h-[150px]">
            <VChart :option="pieOption" class="w-full h-full" />
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span class="font-num text-xl" :class="overspent ? 'text-cinnabar' : 'text-ink'">¥{{ yuan(spent) }}</span>
              <span class="font-cn text-[10px] text-inkLight">预算 ¥{{ yuan(budget) }}</span>
            </div>
          </div>
          <div class="h-[150px]"><VChart :option="barOption" class="w-full h-full" /></div>
        </div>
        <div class="flex items-center justify-between font-cn text-[11px] text-inkLight">
          <span>预算执行 {{ ratio }}%</span>
          <span :class="overspent ? 'text-cinnabar' : 'text-celadonDeep'">{{ remainder >= 0 ? '结余' : '超支' }} ¥{{ yuan(Math.abs(remainder)) }}</span>
        </div>
      </template>
      <template v-else>
        <div class="paper-card p-5 text-center">
          <Coins :size="20" class="mx-auto text-ochreDeep mb-2" />
          <p class="font-cn text-[11px] text-inkLight tracking-widest">{{ dayScoped ? '当日支出' : '累计支出' }}</p>
          <p class="font-num text-3xl text-ink mt-1">¥{{ yuan(spent) }}</p>
          <p v-if="dayScoped && tripBudget" class="font-cn text-[10px] text-inkLight mt-2">
            全程预算 ¥{{ yuan(tripBudget) }} · 已用 ¥{{ yuan(tripSpent) }}
            <span v-if="tripSpent > tripBudget" class="text-cinnabar ml-1">全程已逾制</span>
          </p>
          <p v-else class="font-cn text-[10px] text-inkLight mt-2">未设预算 · 可在行程设置中添置，以见盈缩</p>
          <div class="h-[120px] mt-3"><VChart :option="barOption" class="w-full h-full" /></div>
        </div>
      </template>

      <!-- 操作条 -->
      <div class="flex gap-2">
        <button class="flex-1 h-9 inline-flex items-center justify-center gap-1.5 bg-cinnabar text-mist font-cn text-xs hover:bg-cinnabarDeep" @click="showForm = !showForm; resetForm()">
          <Plus :size="14" /> 记一笔
        </button>
        <button class="flex-1 h-9 inline-flex items-center justify-center gap-1.5 border border-celadon/60 text-celadonDeep font-cn text-xs hover:bg-celadon/10" @click="prefillTransport">
          <Route :size="14" /> 交通段预填
        </button>
      </div>
      <p class="flex items-start gap-1.5 font-cn text-[10px] text-inkLight/80 leading-relaxed">
        <AlertTriangle :size="11" class="shrink-0 mt-0.5 text-ochre" />
        交通预填按「距离 × 经验车费」估算，仅补入尚未记录的线段，可在明细中改额或删除。
      </p>

      <!-- 新增/编辑表单 -->
      <div v-if="showForm" class="paper-card p-3 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-cn text-xs text-ink">{{ editingId ? '改一笔' : '新账目' }}</span>
          <button class="text-inkLight hover:text-cinnabar" @click="showForm = false; resetForm()"><ChevronDown :size="15" /></button>
        </div>
        <input v-model="formTitle" placeholder="项目名，如：客栈 / 午餐 / 门票" maxlength="30"
          class="w-full h-8 px-2 bg-mist border border-ink/20 font-cn text-xs text-ink outline-none focus:border-cinnabar" />
        <div class="flex gap-2">
          <div class="relative flex-1">
            <span class="absolute left-2 top-1.5 font-num text-sm text-inkLight">¥</span>
            <input v-model.number="formAmount" type="number" min="0" step="0.01" placeholder="0.00"
              class="w-full h-8 pl-6 pr-2 bg-mist border border-ink/20 font-num text-sm text-ink outline-none focus:border-cinnabar" />
          </div>
          <select v-model="formCat" class="w-24 h-8 px-1 bg-mist border border-ink/20 font-cn text-xs text-ink outline-none focus:border-cinnabar">
            <option v-for="c in EXPENSE_CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model.number="formDay" class="w-20 h-8 px-1 bg-mist border border-ink/20 font-num text-xs text-ink outline-none focus:border-cinnabar">
            <option v-for="n in dayOptions" :key="n" :value="n">Day {{ n }}</option>
          </select>
        </div>
        <div class="flex justify-end">
          <button class="inline-flex items-center gap-1 px-4 py-1.5 bg-cinnabar text-mist font-cn text-xs hover:bg-cinnabarDeep" @click="submit">
            <Check :size="13" /> {{ editingId ? '保存修改' : '落账' }}
          </button>
        </div>
      </div>

      <!-- 明细 -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-cn text-xs text-ink tracking-wider">记账明细 · {{ expenses.length }} 笔</h3>
          <span class="font-num text-xs text-inkLight">合计 ¥{{ yuan(spent) }}</span>
        </div>
        <div class="space-y-1.5">
          <div v-for="e in expenses" :key="e.id" class="flex items-center gap-2 paper-card px-3 py-2">
            <span class="seal-outline seal w-7 h-7 text-[10px] shrink-0">{{ e.category.slice(0, 1) }}</span>
            <div class="min-w-0 flex-1">
              <p class="font-cn text-xs text-ink truncate">{{ e.title }}</p>
              <p class="font-num text-[10px] text-inkLight">Day {{ e.dayIndex }} · {{ e.category }}</p>
            </div>
            <span class="font-num text-sm shrink-0" :class="overspent ? 'text-cinnabar' : 'text-ochreDeep'">¥{{ yuan(e.amount) }}</span>
            <button class="text-inkLight hover:text-celadonDeep shrink-0" title="改" @click="edit(e)"><Pencil :size="13" /></button>
            <button
              class="shrink-0 inline-flex items-center gap-1"
              :class="confirmId === e.id ? 'text-cinnabar font-cn text-[10px]' : 'text-inkLight hover:text-cinnabar'"
              :title="confirmId === e.id ? '再按一次确认删除' : '删除'"
              @click="remove(e)"
            >
              <Undo2 v-if="confirmId === e.id" :size="13" />
              <Trash2 v-else :size="13" />
              <span v-if="confirmId === e.id">确认</span>
            </button>
          </div>
          <div v-if="!expenses.length" class="py-10 text-center">
            <Wallet :size="20" class="mx-auto text-celadon mb-2" />
            <p class="font-cn text-[11px] text-inkLight">账本尚空，记下第一笔吧</p>
          </div>
        </div>
      </div>
    </div>

    <div class="scroll-axis h-1.5 w-full shrink-0"></div>
  </aside>
</template>

<style scoped>
.is-over :deep(.paper-card) { border-color: rgba(166,72,52,.45); }
.is-over .seal { background: #A64834; }
</style>
