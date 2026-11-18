<script setup lang="ts">
import { X, KeyRound, ShieldAlert, ListChecks, ArrowRight, Info, Settings2 } from 'lucide-vue-next'
import { useUiStore } from '../../stores/ui'

const emit = defineEmits<{ close: [] }>()
const ui = useUiStore()

const steps = [
  { title: '确认 Key 已填入', detail: '设置 → 腾讯位置服务 Key，须为 WebService 类型可用的 Key。' },
  { title: '核对域名白名单', detail: '控制台中为该 Key 配置 WebService API 域名白名单，本机开发可填 localhost。' },
  { title: '检查配额与服务', detail: '确认账号未欠费、未超额，且已开通「WebService API」而非仅 JavaScript GL。' },
  { title: '保存并重试', detail: '回到设置保存 Key；仍报 199 时，稍候再试，避免短时频繁请求。' },
]

function goSettings() {
  emit('close')
  ui.openModal('settings')
}
</script>

<template>
  <div class="absolute inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px] p-4" @click.self="emit('close')">
    <div class="paper-card double-border w-full max-w-[480px] bg-mist rounded-sm p-5 animate-fade-up">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <span class="seal w-9 h-9 text-base">钥</span>
          <div>
            <h2 class="font-brush text-xl text-ink">Key 配置指引</h2>
            <p class="font-cn text-[10px] text-inkLight tracking-widest">服务端返回 status:199</p>
          </div>
        </div>
        <button class="text-inkLight hover:text-cinnabar" title="关闭" @click="emit('close')"><X :size="19" /></button>
      </div>

      <div class="flex items-start gap-2 bg-cinnabar/10 border border-cinnabar/30 px-3 py-2.5 mb-4">
        <ShieldAlert :size="16" class="text-cinnabar shrink-0 mt-0.5" />
        <p class="font-cn text-[11px] text-ink/80 leading-relaxed">
          199 多为 Key 未生效或校验未通过：未填写、域名白名单未配、服务类型不符或配额用尽。缺 Key 时拾程仍可用内置种子数据完成行程，不影响离线使用。
        </p>
      </div>

      <div class="space-y-3">
        <div v-for="(s, i) in steps" :key="s.title" class="flex gap-3">
          <span class="seal-outline seal w-7 h-7 text-[11px] shrink-0">{{ i + 1 }}</span>
          <div class="pt-0.5">
            <p class="font-cn text-xs text-ink flex items-center gap-1.5"><ListChecks :size="12" class="text-celadonDeep" />{{ s.title }}</p>
            <p class="font-cn text-[11px] text-inkLight mt-1 leading-relaxed">{{ s.detail }}</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 mt-5 pt-4 border-t border-ink/10">
        <button class="flex-1 h-9 inline-flex items-center justify-center gap-1.5 bg-cinnabar text-mist font-cn text-xs hover:bg-cinnabarDeep" @click="goSettings">
          <KeyRound :size="14" /> 去设置 Key <ArrowRight :size="13" />
        </button>
        <button class="h-9 px-3 inline-flex items-center justify-center gap-1.5 border border-ink/25 text-inkLight font-cn text-xs hover:border-celadon hover:text-celadonDeep" @click="emit('close')">
          <Settings2 :size="14" /> 稍后
        </button>
      </div>

      <p class="flex items-start gap-1.5 font-cn text-[10px] text-inkLight/80 mt-3 leading-relaxed">
        <Info :size="11" class="shrink-0 mt-0.5 text-ochre" /> Key 仅存本机浏览器，不上传；旧的 Key 可在设置中随时清除。
      </p>
    </div>
  </div>
</template>
