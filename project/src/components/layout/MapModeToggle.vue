<script setup lang="ts">
/** 首页「印记 · 行迹」双态开关（D56） */
defineProps<{ mode: 'mark' | 'trail' }>()
const emit = defineEmits<{ 'update:mode': [mode: 'mark' | 'trail'] }>()
</script>

<template>
  <div class="flex items-center gap-1 p-0.5 border border-ink/15 bg-mist/70" role="tablist" aria-label="印记与行迹">
    <button
      type="button"
      role="tab"
      class="flex-1 h-8 font-cn text-[11px] tracking-wider transition-colors"
      :class="mode === 'mark' ? 'bg-cinnabar text-mist' : 'text-inkLight hover:text-ink'"
      :aria-selected="mode === 'mark'"
      @click="emit('update:mode', 'mark')"
    >印记</button>
    <button
      type="button"
      role="tab"
      class="flex-1 h-8 font-cn text-[11px] tracking-wider transition-colors"
      :class="mode === 'trail' ? 'bg-cinnabar text-mist' : 'text-inkLight hover:text-ink'"
      :aria-selected="mode === 'trail'"
      @click="emit('update:mode', 'trail')"
    >行迹</button>
  </div>
</template>
