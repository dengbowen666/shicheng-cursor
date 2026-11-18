<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, KeyRound, Info, Check, Map, FileJson, Upload, Trash2, Settings2, CircleHelp } from 'lucide-vue-next'
import { useUiStore, type BaseMapKind } from '../../stores/ui'
import { useTripStore } from '../../stores/trip'
import { exportJson } from '../../lib/export'

const emit = defineEmits<{ close: [] }>()

const ui = useUiStore()
const trip = useTripStore()

const draftKey = ref(ui.mapKey)
const fileInput = ref<HTMLInputElement | null>(null)

watch(() => ui.mapKey, v => { draftKey.value = v })

function saveKey() {
  ui.setKey(draftKey.value)
  ui.toast(draftKey.value ? '地图 Key 已保存，实时能力已启用' : '已清除 Key，仍可使用内置数据')
}

const BASE_MAP_OPTIONS: { key: BaseMapKind; label: string; hint: string }[] = [
  { key: 'paper', label: '真实·纸色', hint: '腾讯实时路网与建筑，压成宣纸色调，印章是可点的地点。' },
  { key: 'standard', label: '真实·标准', hint: '标准底图，保留路名与地点标注，找路最直接。' },
]

function pickBaseMap(kind: BaseMapKind) {
  ui.settings.baseMap = kind
  ui.settings.standardMap = kind === 'standard'
  ui.toast(`底图已切换：${BASE_MAP_OPTIONS.find(o => o.key === kind)?.label}`)
}

function backup() {
  exportJson(trip.exportData())
  ui.toast('JSON 备份已下载')
}

async function restore(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const res = trip.importData(await file.text())
    ui.toast(res.message)
  } catch {
    ui.toast('文件读取失败')
  } finally {
    input.value = ''
  }
}

function clearAll() {
  if (!window.confirm('确定清空本机所有行程数据？')) return
  if (!window.confirm('再次确认：清空后仅能通过「撤销」或 JSON 备份找回。仍要继续？')) return
  trip.clearAll()
  ui.toast('数据已清空', '撤销', () => {
    const msg = trip.undo()
    ui.toast(msg ? `${msg}，请重新打开行程` : '无可撤销的操作')
  })
}

function openKeyGuide() {
  emit('close')
  ui.openModal('keyGuide')
}
</script>

<template>
  <div class="absolute inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px] p-4" @click.self="emit('close')">
    <div class="paper-card double-border w-full max-w-[460px] bg-mist rounded-sm p-5 animate-fade-up">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-2.5">
          <span class="seal-outline seal w-8 h-8 text-base"><Settings2 :size="16" /></span>
          <div>
            <h2 class="font-brush text-lg text-ink">偏好设置</h2>
            <p class="font-cn text-[10px] text-inkLight tracking-widest">仅存本机 · 低调不张扬</p>
          </div>
        </div>
        <button class="text-inkLight hover:text-cinnabar" title="关闭" @click="emit('close')"><X :size="19" /></button>
      </div>

      <!-- 地图 -->
      <section class="space-y-3">
        <h3 class="font-cn text-[11px] text-inkLight tracking-widest border-b border-ink/10 pb-1.5">地图与 Key</h3>
        <div>
          <label class="flex items-center gap-2 font-cn text-xs text-ink mb-1.5">
            <KeyRound :size="13" class="text-cinnabar" /> 腾讯位置服务 Key
          </label>
          <div class="flex gap-2">
            <input
              v-model="draftKey"
              type="text"
              placeholder="留空即用内置水墨底图"
              class="flex-1 h-9 px-3 bg-paper/70 border border-ink/20 font-num text-xs text-ink outline-none focus:border-cinnabar"
              @keyup.enter="saveKey"
            />
            <button class="h-9 px-3 bg-cinnabar text-mist font-cn text-xs hover:bg-cinnabarDeep shrink-0" @click="saveKey">保存</button>
          </div>
          <p class="font-cn text-[10px] text-inkLight mt-1.5 leading-relaxed">
            Key 只保存在此浏览器，用于实时地点搜索、路线与导航 referer；不填也不影响离线行程、题跋与记账。
          </p>
        </div>

        <div>
          <label class="flex items-center gap-2 font-cn text-xs text-ink mb-1.5">
            <Map :size="13" class="text-celadonDeep" /> 底图
          </label>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="opt in BASE_MAP_OPTIONS" :key="opt.key"
              class="h-9 border font-cn text-[11px] transition-colors"
              :class="ui.settings.baseMap === opt.key ? 'bg-cinnabar text-mist border-cinnabar' : 'bg-paper/60 text-inkLight border-ink/15 hover:border-celadon'"
              @click="pickBaseMap(opt.key)"
            >{{ opt.label }}</button>
          </div>
          <p class="font-cn text-[10px] text-inkLight mt-1.5 leading-relaxed">
            {{ BASE_MAP_OPTIONS.find(o => o.key === ui.settings.baseMap)?.hint }}
          </p>
        </div>

        <button class="inline-flex items-center gap-1.5 font-cn text-[11px] text-celadonDeep hover:text-cinnabar" @click="openKeyGuide">
          <CircleHelp :size="12" /> 报 status:199？查看 Key 配置指引
        </button>
      </section>

      <!-- 数据 -->
      <section class="space-y-2 mt-4">
        <h3 class="font-cn text-[11px] text-inkLight tracking-widest border-b border-ink/10 pb-1.5">数据</h3>
        <div class="grid grid-cols-2 gap-2">
          <button class="h-9 inline-flex items-center justify-center gap-1.5 border border-ink/20 text-ink font-cn text-xs hover:border-celadon hover:text-celadonDeep" @click="backup">
            <FileJson :size="13" /> 导出备份
          </button>
          <button class="h-9 inline-flex items-center justify-center gap-1.5 border border-ink/20 text-ink font-cn text-xs hover:border-celadon hover:text-celadonDeep" @click="fileInput?.click()">
            <Upload :size="13" /> 导入恢复
          </button>
        </div>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="restore" />

        <button class="w-full h-9 inline-flex items-center justify-center gap-1.5 border border-cinnabar/35 text-cinnabar font-cn text-xs hover:bg-cinnabar/10" @click="clearAll">
          <Trash2 :size="13" /> 清空数据（双确认）
        </button>
      </section>

      <p class="flex items-start gap-1.5 font-cn text-[10px] text-inkLight/80 mt-4 pt-3 border-t border-ink/10 leading-relaxed">
        <Info :size="11" class="shrink-0 mt-0.5 text-ochre" />
        所有偏好与数据仅存本机，拾程不上传、不追踪。清空前记得先导出一份 JSON。
        <Check :size="11" class="inline align-text-bottom ml-1 text-celadonDeep" />
      </p>
    </div>
  </div>
</template>
