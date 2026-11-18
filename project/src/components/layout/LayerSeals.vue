<script setup lang="ts">
/** 图层篆书小印：景 / 食 / 宿（D45 / 4.5） */
import { useUiStore } from '../../stores/ui'

const ui = useUiStore()
const items = [
  { key: 'sight' as const, label: '景' },
  { key: 'food' as const, label: '食' },
  { key: 'hotel' as const, label: '宿' },
]
</script>

<template>
  <div class="flex flex-col gap-1.5" role="group" aria-label="图层开关">
    <button
      v-for="it in items" :key="it.key"
      type="button"
      class="w-8 h-8 font-brush text-sm border transition-colors"
      :class="ui.layers[it.key]
        ? 'bg-cinnabar text-mist border-cinnabarDeep shadow-seal'
        : 'bg-mist/80 text-inkLight border-ink/25 hover:border-cinnabar/40'"
      :title="ui.layers[it.key] ? `隐藏${it.label}` : `显示${it.label}`"
      :aria-pressed="ui.layers[it.key]"
      @click="ui.toggleLayer(it.key)"
    >{{ it.label }}</button>
  </div>
</template>
