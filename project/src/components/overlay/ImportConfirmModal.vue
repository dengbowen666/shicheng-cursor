<script setup lang="ts">
/** O09 + 跨设备同步：导入方式选择——整体替换（推荐）/ 覆盖 / 跳过 / 另存 */
import { AlertTriangle, X, RefreshCw } from 'lucide-vue-next'
import type { ImportPolicy } from '../../stores/trip'

defineProps<{ conflicts: string[]; total: number; localCount: number }>()
const emit = defineEmits<{ choose: [policy: ImportPolicy]; cancel: [] }>()
</script>

<template>
  <div class="absolute inset-0 z-[60] flex items-center justify-center bg-ink/45 p-4" @click.self="emit('cancel')">
    <div class="paper-card double-border w-full max-w-[440px] bg-mist rounded-sm p-5 animate-fade-up">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-2">
          <span class="seal w-8 h-8 text-sm shrink-0">入</span>
          <div>
            <h3 class="font-brush text-lg text-ink leading-tight">导入攻略备份</h3>
            <p class="font-cn text-[10px] text-inkLight tracking-wider mt-0.5">备份 {{ total }} 份 · 本机现有 {{ localCount }} 份</p>
          </div>
        </div>
        <button class="text-inkLight hover:text-cinnabar shrink-0" title="取消" @click="emit('cancel')"><X :size="18" /></button>
      </div>

      <!-- 换设备同步：整体替换作为推荐首选 -->
      <button
        class="w-full text-left border border-celadon/60 bg-celadon/8 px-3 py-2.5 mb-3 hover:bg-celadon/15 transition-colors"
        @click="emit('choose', 'replace')"
      >
        <span class="flex items-center gap-2">
          <RefreshCw :size="14" class="text-celadonDeep shrink-0" />
          <span class="font-cn text-[12px] text-ink">同步本机（推荐）：用备份完全替换</span>
        </span>
        <span class="block font-cn text-[10px] text-inkLight mt-1 pl-[22px] leading-relaxed">
          换手机 / 换电脑时选这项，本机将变得和备份一模一样，不残留示例或其他旧攻略。可一次撤销。
        </span>
      </button>

      <div v-if="conflicts.length" class="bg-cinnabar/8 border border-cinnabar/30 px-3 py-2.5 max-h-[120px] overflow-y-auto drawer-scroll mb-3">
        <p class="font-cn text-[10px] text-cinnabarDeep mb-1">以下 {{ conflicts.length }} 份与本机同名：</p>
        <p v-for="(name, i) in conflicts" :key="i" class="font-cn text-[11px] text-ink flex items-center gap-1.5 py-0.5">
          <AlertTriangle :size="11" class="text-cinnabar shrink-0" />{{ name }}
        </p>
      </div>

      <p class="font-cn text-[10px] text-inkLight leading-relaxed mb-3">
        只想合并而非替换？下面按同名冲突处理：覆盖会替换本机现有内容；跳过保留现状；另存会生成为新攻略（题名加「副本」）。
      </p>

      <div class="grid grid-cols-3 gap-2">
        <button class="h-9 border border-ink/25 font-cn text-[11px] text-ink hover:border-celadon hover:text-celadonDeep" @click="emit('choose', 'skip')">跳过冲突</button>
        <button class="h-9 border border-ink/25 font-cn text-[11px] text-ink hover:border-celadon hover:text-celadonDeep" @click="emit('choose', 'clone')">另存副本</button>
        <button class="h-9 border border-cinnabar/60 font-cn text-[11px] text-cinnabar hover:bg-cinnabar/8" @click="emit('choose', 'overwrite')">仅覆盖同名</button>
      </div>
    </div>
  </div>
</template>
