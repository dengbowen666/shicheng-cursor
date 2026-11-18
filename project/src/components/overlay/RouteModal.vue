<script setup lang="ts">
import type { TransportMode, TransportSegment } from '../../types'
import SegmentPicker from '../editor/SegmentPicker.vue'

const props = defineProps<{ segment: TransportSegment }>()
const emit = defineEmits<{
  close: []
  choose: [mode: TransportMode]
}>()

function onChoose(mode: TransportMode) { emit('choose', mode) }
</script>

<template>
  <div class="absolute inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px] p-4" @click.self="emit('close')">
    <SegmentPicker
      :segment="props.segment"
      @close="emit('close')"
      @choose="onChoose"
    />
  </div>
</template>
