<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '../../stores/ui'
import { Eye, Download, Play, Settings2, Compass, MoreHorizontal, PenLine } from 'lucide-vue-next'

defineProps<{ tripId: string }>()
const router = useRouter()
const ui = useUiStore()
const open = ref(false)

function act(fn: () => void) { open.value = false; fn() }
</script>

<template>
  <div class="absolute right-3 bottom-4 z-30 flex flex-col items-end gap-2">
    <Transition name="fade">
      <div v-if="open" class="flex flex-col items-end gap-2 mb-1">
        <button class="h-9 px-3 paper-card flex items-center gap-2 text-xs font-cn text-inkLight hover:text-cinnabar" @click="act(() => ui.viewMode = ui.viewMode === 'day' ? 'all' : 'day')">
          <Eye :size="14" /> {{ ui.viewMode === 'day' ? '全程全览' : '聚焦当日' }}
        </button>
        <button class="h-9 px-3 paper-card flex items-center gap-2 text-xs font-cn text-inkLight hover:text-cinnabar" @click="act(() => ui.annotateMode = true)">
          <PenLine :size="14" /> 朱笔批注
        </button>
        <button class="h-9 px-3 paper-card flex items-center gap-2 text-xs font-cn text-inkLight hover:text-cinnabar" @click="act(() => ui.replaying = true)">
          <Play :size="14" /> 全程回放
        </button>
        <button class="h-9 px-3 paper-card flex items-center gap-2 text-xs font-cn text-inkLight hover:text-cinnabar" @click="act(() => ui.openModal('export'))">
          <Download :size="14" /> 导出长卷
        </button>
        <button class="h-9 px-3 paper-card flex items-center gap-2 text-xs font-cn text-inkLight hover:text-cinnabar" @click="act(() => ui.openModal('settings'))">
          <Settings2 :size="14" /> 设置
        </button>
        <button class="h-9 px-3 paper-card flex items-center gap-2 text-xs font-cn text-inkLight hover:text-cinnabar" @click="act(() => router.push('/'))">
          <Compass :size="14" /> 我的攻略
        </button>
      </div>
    </Transition>

    <button
      class="w-10 h-10 flex items-center justify-center border border-ink/20 bg-mist/92 text-inkLight shadow-paper backdrop-blur-sm transition-colors hover:text-cinnabar hover:border-cinnabar/40"
      title="更多"
      :aria-expanded="open"
      @click="open = !open"
    >
      <MoreHorizontal :size="18" />
    </button>
  </div>
</template>
