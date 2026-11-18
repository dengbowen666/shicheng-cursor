<script setup lang="ts">
/** O09：导入冲突确认层——预检发现同 ID 攻略时，由用户选覆盖/跳过/另存 */
import { AlertTriangle, X } from 'lucide-vue-next'
import type { ImportPolicy } from '../../stores/trip'

defineProps<{ conflicts: string[]; total: number }>()
const emit = defineEmits<{ choose: [policy: ImportPolicy]; cancel: [] }>()
</script>

<template>
  <div class="absolute inset-0 z-[60] flex items-center justify-center bg-ink/45 p-4" @click.self="emit('cancel')">
    <div class="paper-card double-border w-full max-w-[420px] bg-mist rounded-sm p-5 animate-fade-up">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-2">
          <span class="seal w-8 h-8 text-sm shrink-0">覆</span>
          <div>
            <h3 class="font-brush text-lg text-ink leading-tight">备份中有同名攻略</h3>
            <p class="font-cn text-[10px] text-inkLight tracking-wider mt-0.5">共 {{ total }} 份 · {{ conflicts.length }} 份会覆盖当前进度</p>
          </div>
        </div>
        <button class="text-inkLight hover:text-cinnabar shrink-0" title="取消" @click="emit('cancel')"><X :size="18" /></button>
      </div>

      <div class="bg-cinnabar/8 border border-cinnabar/30 px-3 py-2.5 max-h-[150px] overflow-y-auto drawer-scroll">
        <p v-for="(name, i) in conflicts" :key="i" class="font-cn text-[11px] text-ink flex items-center gap-1.5 py-0.5">
          <AlertTriangle :size="11" class="text-cinnabar shrink-0" />{{ name }}
        </p>
      </div>

      <p class="font-cn text-[10px] text-inkLight leading-relaxed mt-3 mb-4">
        覆盖会替换本机现有内容；跳过保留现状；另存会生成为新攻略（题名加「副本」）。
      </p>

      <div class="grid grid-cols-3 gap-2">
        <button class="h-9 border border-ink/25 font-cn text-[11px] text-ink hover:border-celadon hover:text-celadonDeep" @click="emit('choose', 'skip')">跳过冲突</button>
        <button class="h-9 border border-celadon/60 font-cn text-[11px] text-celadonDeep hover:bg-celadon/10" @click="emit('choose', 'clone')">另存副本</button>
        <button class="h-9 bg-cinnabar text-mist font-cn text-[11px] hover:bg-cinnabarDeep" @click="emit('choose', 'overwrite')">覆盖导入</button>
      </div>
    </div>
  </div>
</template>
