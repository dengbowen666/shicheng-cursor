<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { TooltipComponent, GridComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import {
  X, Stamp, BookOpen, TrendingUp, MapPin,
  CalendarDays, ScrollText, LockKeyhole, Compass, Sparkles,
} from 'lucide-vue-next'
import type { Trip } from '../../types'
import { CATEGORY_LABEL } from '../../types'

use([CanvasRenderer, LineChart, TooltipComponent, GridComponent])

const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ close: [] }>()

function yuan(cents: number) { return (cents / 100).toFixed(2) }
function dateLabel(ts?: number) { return ts ? new Date(ts).toLocaleDateString('zh-CN') : '' }

const visited = computed(() => Object.values(props.trip.pois).filter(p => p.visitedAt).sort((a, b) => (a.visitedAt || 0) - (b.visitedAt || 0)))
const totalSpent = computed(() => props.trip.expenses.reduce((s, e) => s + e.amount, 0))
const travelMin = computed(() => Object.values(props.trip.segments).reduce((s, x) => s + x.durationMin, 0))
const annotations = computed(() => Object.values(props.trip.pois).filter(p => !!p.note?.trim()))

const byDay = computed(() => props.trip.days.map(d => {
  const ids = d.poiIds.filter(id => props.trip.pois[id])
  const stamped = ids.map(id => props.trip.pois[id]).filter(p => p.visitedAt)
  return { day: d, ids, stamped }
}))

const curve = computed(() => props.trip.days.map(d => ({
  day: `D${d.dayIndex}`,
  value: Math.round(props.trip.expenses.filter(e => e.dayIndex === d.dayIndex).reduce((s, e) => s + e.amount, 0)) / 100,
})))

const lineOption = computed(() => ({
  grid: { left: 48, right: 16, top: 18, bottom: 26 },
  tooltip: { trigger: 'axis', formatter: '{b} · ¥{c}' },
  xAxis: {
    type: 'category', boundaryGap: false,
    data: curve.value.map(x => x.day),
    axisLabel: { fontSize: 10, color: '#6E6A62' }, axisTick: { show: false },
  },
  yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#6E6A62' }, splitLine: { lineStyle: { color: 'rgba(44,42,38,.08)' } } },
  series: [{
    type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
    data: curve.value.map(x => x.value),
    lineStyle: { color: '#6E8B88', width: 2 },
    itemStyle: { color: '#A64834' },
    areaStyle: { color: 'rgba(143,169,166,.22)' },
  }],
}))
</script>

<template>
  <aside class="scroll-drawer absolute inset-y-0 right-0 z-40 w-full max-w-[540px] bg-paper/98 paper-texture shadow-drawer border-l border-ink/25 flex flex-col">
    <div class="scroll-axis h-1.5 w-full shrink-0"></div>

    <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-ink/15">
      <div class="flex items-center gap-2">
        <span class="seal w-8 h-8 text-xs">忆</span>
        <div class="min-w-0">
          <h2 class="font-brush text-xl text-ink leading-tight">忆游回顾</h2>
          <p class="font-cn text-[10px] text-inkLight tracking-wider truncate">{{ trip.title }} · {{ trip.cities.map(c => c.name).join(' · ') }}</p>
        </div>
      </div>
      <button class="w-8 h-8 shrink-0 flex items-center justify-center border border-ink/20 text-inkLight hover:text-cinnabar" title="收卷" @click="emit('close')">
        <X :size="16" />
      </button>
    </header>

    <div class="flex-1 overflow-y-auto drawer-scroll px-5 py-4 space-y-4">
      <!-- 行程小结 -->
      <div class="paper-card p-4">
        <div class="flex items-center justify-between mb-3">
          <span class="font-brush text-base text-ink flex items-center gap-1.5"><ScrollText :size="15" class="text-cinnabar" /> 行程小结</span>
          <span class="font-cn text-[10px] text-inkLight inline-flex items-center gap-1"><CalendarDays :size="11" /> {{ trip.days.length }} 日</span>
        </div>
        <div class="grid grid-cols-4 gap-1 text-center">
          <div>
            <p class="font-num text-xl text-cinnabar leading-none">{{ visited.length }}</p>
            <p class="font-cn text-[10px] text-inkLight mt-1">已至</p>
          </div>
          <div class="border-x border-ink/10">
            <p class="font-num text-xl text-ink leading-none">{{ Object.keys(trip.pois).length }}</p>
            <p class="font-cn text-[10px] text-inkLight mt-1">收录</p>
          </div>
          <div class="border-r border-ink/10">
            <p class="font-num text-xl text-ochreDeep leading-none">¥{{ yuan(totalSpent) }}</p>
            <p class="font-cn text-[10px] text-inkLight mt-1">支出</p>
          </div>
          <div>
            <p class="font-num text-xl text-celadonDeep leading-none">{{ travelMin }}</p>
            <p class="font-cn text-[10px] text-inkLight mt-1">在途分</p>
          </div>
        </div>
        <div v-if="trip.totalBudget" class="mt-3 pt-3 border-t border-ink/10 flex items-center justify-between font-cn text-[11px]">
          <span class="text-inkLight">预算 ¥{{ yuan(trip.totalBudget) }}</span>
          <span :class="totalSpent > trip.totalBudget ? 'text-cinnabar' : 'text-celadonDeep'">
            {{ totalSpent > trip.totalBudget ? '已逾制' : '尚有余裕' }}
          </span>
        </div>
      </div>

      <!-- 花费曲线 -->
      <div class="paper-card p-3">
        <div class="flex items-center gap-2 mb-1">
          <TrendingUp :size="14" class="text-celadonDeep" />
          <span class="font-cn text-xs text-ink tracking-wider">逐日花费</span>
          <span class="ml-auto font-num text-xs text-inkLight">合计 ¥{{ yuan(totalSpent) }}</span>
        </div>
        <div class="h-[170px]"><VChart :option="lineOption" class="w-full h-full" /></div>
      </div>

      <!-- 已至印章分布 -->
      <div>
        <div class="flex items-center gap-2 mb-2">
          <Stamp :size="14" class="text-cinnabar" />
          <h3 class="font-cn text-xs text-ink tracking-wider">已至印章分布</h3>
          <span class="ml-auto font-num text-xs text-inkLight">{{ visited.length }} 印</span>
        </div>
        <div class="space-y-2">
          <div v-for="row in byDay" :key="row.day.dayIndex" class="paper-card px-3 py-2">
            <div class="flex items-center justify-between mb-2">
              <span class="font-cn text-[11px] text-ink">{{ row.day.title }}</span>
              <span class="font-num text-[10px] text-inkLight">{{ row.stamped.length }} / {{ row.ids.length }}</span>
            </div>
            <div v-if="row.stamped.length" class="flex flex-wrap gap-2">
              <div v-for="p in row.stamped" :key="p.id" class="flex items-center gap-1.5 bg-mist/80 border border-ink/10 px-2 py-1">
                <span class="seal w-7 h-7 text-[9px] shrink-0">{{ CATEGORY_LABEL[p.category] }}</span>
                <div class="min-w-0">
                  <p class="font-cn text-[11px] text-ink truncate max-w-[150px]">{{ p.name }}</p>
                  <p class="font-num text-[9px] text-inkLight">{{ dateLabel(p.visitedAt) }}</p>
                </div>
              </div>
            </div>
            <p v-else class="font-cn text-[10px] text-inkLight">此日未落印</p>
          </div>
          <div v-if="!visited.length" class="py-8 text-center">
            <Compass :size="20" class="mx-auto text-celadon mb-2" />
            <p class="font-cn text-[11px] text-inkLight">尚无足迹，行到之处自会留章</p>
          </div>
        </div>
      </div>

      <!-- 题跋集 -->
      <div class="paper-card p-4">
        <div class="flex items-center gap-2 mb-3">
          <BookOpen :size="14" class="text-ochreDeep" />
          <span class="font-cn text-xs text-ink tracking-wider">题跋集</span>
          <span class="ml-auto font-num text-xs text-inkLight">{{ annotations.length }} 则</span>
        </div>
        <div v-if="annotations.length" class="space-y-2.5">
          <blockquote v-for="p in annotations" :key="p.id" class="border-l-2 border-cinnabar/50 pl-3">
            <p class="font-brush text-sm text-ink leading-relaxed">「{{ p.note }}」</p>
            <footer class="font-cn text-[10px] text-inkLight mt-1 flex items-center gap-1">
              <MapPin :size="10" /> {{ p.name }}
            </footer>
          </blockquote>
        </div>
        <p v-else class="font-cn text-[11px] text-inkLight text-center py-4">行旅无题，亦是留白。</p>
      </div>

      <p class="flex items-start gap-1.5 font-cn text-[10px] text-inkLight/80 leading-relaxed pb-2">
        <LockKeyhole :size="11" class="shrink-0 mt-0.5 text-ochre" />
        忆游为只读回顾，印章与账目皆自昔日留痕；此处不作改动。<Sparkles :size="11" class="inline align-text-bottom ml-1" />
      </p>
    </div>

    <div class="scroll-axis h-1.5 w-full shrink-0"></div>
  </aside>
</template>
