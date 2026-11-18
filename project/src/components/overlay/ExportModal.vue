<script setup lang="ts">
import { ref } from 'vue'
import { X, Image, Printer, FileJson, Download, Upload, Check, Loader2 } from 'lucide-vue-next'
import type { Trip } from '../../types'
import { exportScrollPng, exportPrintHtml, exportJson } from '../../lib/export'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'

const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ close: [] }>()

const tripStore = useTripStore()
const ui = useUiStore()
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function png() {
  if (busy.value) return
  busy.value = true
  try {
    await exportScrollPng(props.trip)
    ui.toast('国风长卷 PNG 已导出')
  } catch {
    ui.toast('长卷生成失败，请重试')
  } finally {
    busy.value = false
  }
}

function printHtml() {
  exportPrintHtml(props.trip)
  ui.toast('打印版 HTML 已导出')
}

function backup() {
  exportJson(tripStore.exportData())
  ui.toast('JSON 备份已下载')
}

async function restore(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const res = tripStore.importData(await file.text())
    ui.toast(res.message)
    if (res.ok) emit('close')
  } catch {
    ui.toast('文件读取失败')
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div class="absolute inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px] p-4" @click.self="emit('close')">
    <div class="paper-card double-border w-full max-w-[440px] bg-mist rounded-sm p-5 animate-fade-up">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <span class="seal w-9 h-9 text-base">传</span>
          <div>
            <h2 class="font-brush text-xl text-ink">出行卷帙</h2>
            <p class="font-cn text-[10px] text-inkLight tracking-widest">长卷 · 打印 · 备份，三件套</p>
          </div>
        </div>
        <button class="text-inkLight hover:text-cinnabar" title="关闭" @click="emit('close')"><X :size="19" /></button>
      </div>

      <p class="font-cn text-[11px] text-inkLight border-l-2 border-celadon/50 pl-3 mb-4 leading-relaxed">
        「{{ trip.title }}」 · {{ trip.days.length }} 日 · {{ trip.cities.map(c => c.name).join(' · ') }}
      </p>

      <div class="space-y-2">
        <button class="export-item group" :disabled="busy" @click="png">
          <span class="seal-outline seal w-9 h-9 shrink-0"><Image :size="16" /></span>
          <span class="flex-1 text-left">
            <span class="block font-cn text-sm text-ink">国风长卷 PNG</span>
            <span class="block font-cn text-[10px] text-inkLight mt-0.5">竖版宣纸长卷，含行程与诗句，不含账目明细</span>
          </span>
          <Loader2 v-if="busy" :size="16" class="text-celadonDeep animate-spin shrink-0" />
          <Download v-else :size="16" class="text-inkLight group-hover:text-cinnabar shrink-0" />
        </button>

        <button class="export-item group" @click="printHtml">
          <span class="seal-outline seal w-9 h-9 shrink-0"><Printer :size="16" /></span>
          <span class="flex-1 text-left">
            <span class="block font-cn text-sm text-ink">打印版 HTML</span>
            <span class="block font-cn text-[10px] text-inkLight mt-0.5">离线自包含，含账目明细与预算执行</span>
          </span>
          <Download :size="16" class="text-inkLight group-hover:text-cinnabar shrink-0" />
        </button>

        <button class="export-item group" @click="backup">
          <span class="seal-outline seal w-9 h-9 shrink-0"><FileJson :size="16" /></span>
          <span class="flex-1 text-left">
            <span class="block font-cn text-sm text-ink">JSON 备份</span>
            <span class="block font-cn text-[10px] text-inkLight mt-0.5">全部行程原样存盘，可随时还原</span>
          </span>
          <Download :size="16" class="text-inkLight group-hover:text-cinnabar shrink-0" />
        </button>

        <button class="export-item group" @click="fileInput?.click()">
          <span class="seal-outline seal w-9 h-9 shrink-0"><Upload :size="16" /></span>
          <span class="flex-1 text-left">
            <span class="block font-cn text-sm text-ink">JSON 恢复</span>
            <span class="block font-cn text-[10px] text-inkLight mt-0.5">从备份文件导入，同 ID 覆盖、异 ID 并存</span>
          </span>
          <Upload :size="16" class="text-inkLight group-hover:text-cinnabar shrink-0" />
        </button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="restore" />
      </div>

      <p class="flex items-center gap-1.5 font-cn text-[10px] text-inkLight mt-4 pt-3 border-t border-ink/10">
        <Check :size="12" class="text-celadonDeep shrink-0" /> 本机生成，不上传云端；恢复前建议先做一份备份。
      </p>
    </div>
  </div>
</template>

<style scoped>
.export-item {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 10px 12px; border: 1px solid rgba(44,42,38,.16);
  background: rgba(250,246,237,.7); transition: border-color .18s, background .18s;
}
.export-item:hover { border-color: rgba(166,72,52,.45); background: rgba(166,72,52,.04); }
.export-item:disabled { opacity: .6; cursor: not-allowed; }
</style>
