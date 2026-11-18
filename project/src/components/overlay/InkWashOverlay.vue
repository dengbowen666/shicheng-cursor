<script setup lang="ts">
/** 路由转场水墨晕染遮罩（D47 / D81） */
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { canAnimate } from '../../lib/motion'
import InkBloom from './InkBloom.vue'

const router = useRouter()
const busy = ref(false)
const wash = ref({ on: false, key: 0, x: 0.48, y: 0.42 })

watch(() => router.currentRoute.value.fullPath, async (_to, from) => {
  if (!from || busy.value || !canAnimate()) return
  busy.value = true
  wash.value = { on: true, key: Date.now(), x: 0.48 + (Math.random() * 0.08 - 0.04), y: 0.4 + (Math.random() * 0.1 - 0.05) }
})

function onDone() {
  wash.value = { ...wash.value, on: false }
  busy.value = false
}
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-[400]" aria-hidden="true">
    <InkBloom
      :key="wash.key"
      :active="wash.on"
      :x="wash.x"
      :y="wash.y"
      :duration="980"
      @done="onDone"
    />
  </div>
</template>
