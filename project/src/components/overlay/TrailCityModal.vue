<script setup lang="ts">
/**
 * 该城行迹小卷（D57）：列出该城已结束攻略，点进忆游回顾。
 */
import { computed } from 'vue'
import { Archive, Eye, Stamp, PenLine, X } from 'lucide-vue-next'
import type { Trip } from '../../types'

const props = defineProps<{
  city: string
  trips: Trip[]
}>()

const emit = defineEmits<{
  close: []
  open: [tripId: string]
}>()

const sorted = computed(() =>
  [...props.trips].sort((a, b) => (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt)),
)

function stamps(t: Trip) {
  return Object.values(t.pois).filter(p => p.visitedAt).length
}
function notes(t: Trip) {
  return Object.values(t.pois).filter(p => p.note?.trim()).length
}
function dateText(t: Trip) {
  if (t.startDate) return `${t.startDate} 起 · ${t.days.length} 日`
  return `${t.days.length} 日 · 未定日期`
}
</script>

<template>
  <div class="fixed inset-0 z-[180] flex items-center justify-center bg-ink/35 p-4" @click.self="emit('close')">
    <div class="paper-card w-full max-w-[420px] max-h-[80vh] flex flex-col overflow-hidden">
      <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-ink/15">
        <div>
          <p class="font-cn text-[10px] tracking-[0.28em] text-inkLight">该城行迹</p>
          <h3 class="font-brush text-xl text-ink mt-0.5">{{ city }}</h3>
          <p class="font-cn text-[11px] text-inkLight mt-1">
            {{ sorted.length > 1 ? `再游 ${sorted.length} 次` : '一至此地' }}
          </p>
        </div>
        <button class="w-8 h-8 border border-ink/20 text-inkLight hover:text-cinnabar" @click="emit('close')">
          <X :size="16" class="mx-auto" />
        </button>
      </header>

      <div class="flex-1 overflow-y-auto drawer-scroll px-4 py-3 space-y-2">
        <button
          v-for="t in sorted" :key="t.id"
          type="button"
          class="w-full paper-card p-3 text-left flex gap-3 hover:border-cinnabar/40"
          @click="emit('open', t.id)"
        >
          <span class="seal w-10 h-10 text-[11px] shrink-0 flex-col leading-none">
            <span>{{ t.sealText.slice(0, 1) }}</span>
            <span>{{ t.sealText.slice(1, 2) || '程' }}</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="font-brush text-base text-ink truncate">{{ t.title }}</span>
              <Archive v-if="t.archived" :size="12" class="text-inkLight shrink-0" />
            </span>
            <span class="mt-1 block font-cn text-[10px] text-inkLight">{{ dateText(t) }}</span>
            <span class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-cn text-[10px] text-inkLight">
              <span class="inline-flex items-center gap-1"><Stamp :size="10" />盖章 {{ stamps(t) }}</span>
              <span class="inline-flex items-center gap-1"><PenLine :size="10" />题跋 {{ notes(t) }}</span>
              <span class="inline-flex items-center gap-1 text-cinnabar"><Eye :size="10" />忆游</span>
            </span>
          </span>
        </button>
        <p v-if="!sorted.length" class="text-center font-cn text-xs text-inkLight py-8">此城尚无已结束的旧游</p>
      </div>
    </div>
  </div>
</template>
