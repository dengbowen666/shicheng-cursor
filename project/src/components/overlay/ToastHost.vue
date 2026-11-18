<script setup lang="ts">
import { useUiStore } from '../../stores/ui'
const ui = useUiStore()
</script>

<template>
  <TransitionGroup name="toast" tag="div" class="fixed top-3 left-1/2 -translate-x-1/2 z-[999] w-[92%] max-w-[420px] space-y-2 pointer-events-none">
    <div
      v-for="t in ui.toasts" :key="t.id"
      class="paper-card pointer-events-auto px-4 py-2.5 flex items-center gap-3 text-xs font-cn"
    >
      <span class="w-1.5 h-5 bg-cinnabar shrink-0"></span>
      <span class="flex-1 text-ink">{{ t.text }}</span>
      <button v-if="t.action" class="text-cinnabar border border-cinnabar/40 px-2 py-0.5" @click="ui.runToastAction(t.id)">{{ t.action }}</button>
      <button class="text-inkLight/60" @click="ui.dismiss(t.id)">×</button>
    </div>
  </TransitionGroup>
</template>
