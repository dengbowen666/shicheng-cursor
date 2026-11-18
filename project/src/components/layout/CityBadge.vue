<script setup lang="ts">
import type { LngLat } from '../../types'

defineProps<{
  name: string
  center: LngLat
  state: 'todo' | 'active' | 'done'
  count?: number
}>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button class="relative group flex flex-col items-center gap-1" @click="emit('click')">
    <span
      class="w-6 h-6 flex items-center justify-center font-cn text-[10px] border transition-all"
      :class="state === 'active' ? 'bg-cinnabar text-mist border-cinnabar shadow-seal' : state === 'done' ? 'bg-ink/75 text-mist border-ink' : 'bg-mist/85 text-inkLight border-ink/40'"
    >
      {{ state === 'done' ? '行' : name.slice(0, 1) }}
    </span>
    <span class="font-cn text-[10px] text-inkLight bg-mist/70 px-1 group-hover:text-cinnabar whitespace-nowrap">{{ name }}</span>
    <span v-if="count && count > 1" class="absolute -top-1.5 -right-2 seal w-4 h-4 text-[8px]">{{ count }}</span>
  </button>
</template>
