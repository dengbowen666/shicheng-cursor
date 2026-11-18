<script setup lang="ts">
/**
 * 印记态·该城攻略：一城可有多段进行中的行旅，列出供选择/删除/再起一程。
 */
import { computed, ref } from 'vue'
import { Archive, Eye, Stamp, PenLine, Plus, Trash2, X } from 'lucide-vue-next'
import type { Trip } from '../../types'

const props = defineProps<{
  city: string
  trips: Trip[]
}>()

const emit = defineEmits<{
  close: []
  open: [tripId: string]
  create: []
  delete: [tripId: string]
}>()

const sorted = computed(() =>
  [...props.trips].sort((a, b) => b.updatedAt - a.updatedAt),
)
const confirming = ref<string | null>(null)

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
function askDelete(t: Trip) {
  if (confirming.value !== t.id) {
    confirming.value = t.id
    return
  }
  confirming.value = null
  emit('delete', t.id)
}
</script>

<template>
  <div class="fixed inset-0 z-[180] flex items-center justify-center bg-ink/35 p-4" @click.self="emit('close')">
    <div class="paper-card w-full max-w-[440px] max-h-[82vh] flex flex-col overflow-hidden">
      <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-ink/15">
        <div>
          <p class="font-cn text-[10px] tracking-[0.28em] text-inkLight">此城行旅</p>
          <h3 class="font-brush text-xl text-ink mt-0.5">{{ city }}</h3>
          <p class="font-cn text-[11px] text-inkLight mt-1">
            {{ sorted.length > 1 ? `在此 ${sorted.length} 段行旅` : '一段行旅' }}
          </p>
        </div>
        <button class="w-8 h-8 border border-ink/20 text-inkLight hover:text-cinnabar" @click="emit('close')" title="关闭">
          <X :size="16" class="mx-auto" />
        </button>
      </header>

      <div class="flex-1 overflow-y-auto drawer-scroll px-4 py-3 space-y-2">
        <div
          v-for="t in sorted" :key="t.id"
          class="paper-card p-3 flex gap-3"
        >
          <button class="seal w-10 h-10 text-[11px] shrink-0 flex-col leading-none" @click="emit('open', t.id)" title="进入此卷">
            <span>{{ t.sealText.slice(0, 1) }}</span>
            <span>{{ t.sealText.slice(1, 2) || '程' }}</span>
          </button>
          <div class="min-w-0 flex-1">
            <button class="w-full text-left group" @click="emit('open', t.id)">
              <span class="flex items-center gap-2">
                <span class="font-brush text-base text-ink truncate group-hover:text-cinnabar">{{ t.title }}</span>
                <Archive v-if="t.archived" :size="12" class="text-inkLight shrink-0" />
                <Eye :size="12" class="text-cinnabar shrink-0 ml-auto" />
              </span>
              <span class="mt-1 block font-cn text-[10px] text-inkLight">{{ dateText(t) }}</span>
              <span class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-cn text-[10px] text-inkLight">
                <span class="inline-flex items-center gap-1"><Stamp :size="10" />盖章 {{ stamps(t) }}</span>
                <span class="inline-flex items-center gap-1"><PenLine :size="10" />题跋 {{ notes(t) }}</span>
              </span>
            </button>
          </div>
          <button
            class="w-8 h-8 shrink-0 border flex items-center justify-center transition-colors"
            :class="confirming === t.id ? 'border-cinnabar bg-cinnabar/10 text-cinnabar' : 'border-ink/20 text-inkLight hover:text-cinnabar'"
            :title="confirming === t.id ? '再按一次确认删除' : '删除此卷'"
            @click="askDelete(t)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
        <p v-if="!sorted.length" class="text-center font-cn text-xs text-inkLight py-6">此城尚无进行中的行旅</p>
      </div>

      <footer class="px-4 py-3 border-t border-ink/15 bg-mist/40">
        <button class="w-full h-10 flex items-center justify-center gap-2 border border-cinnabar/50 text-cinnabar font-cn text-xs hover:bg-cinnabar/10" @click="emit('create')">
          <Plus :size="14" /> 在此城另起一程
        </button>
      </footer>
    </div>
  </div>
</template>
