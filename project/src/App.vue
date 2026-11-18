<script setup lang="ts">
/** 宣纸呼吸（D46）+ 路由晕染（D81） */
import { onBeforeUnmount, onMounted, watch } from 'vue'
import ToastHost from './components/overlay/ToastHost.vue'
import InkWashOverlay from './components/overlay/InkWashOverlay.vue'
import { useTripStore } from './stores/trip'
import { useUiStore } from './stores/ui'
import { useWeatherStore } from './stores/weather'

const trip = useTripStore()
const ui = useUiStore()
const weather = useWeatherStore()

function syncPaperBreath() {
  const hour = new Date().getHours()
  const night = hour < 6 || hour >= 19
  document.body.classList.toggle('paper-night', night)

  const t = trip.activeTrip
  const day = t?.days.find(d => d.dayIndex === ui.activeDayIndex) || t?.days[0]
  const city = day?.city || t?.cities[0]?.name
  const wx = city ? weather.forDate(city, day?.date) : undefined
  const rainy = !!wx?.text && /雨|雪|雷/.test(wx.text)
  document.body.classList.toggle('paper-rain', rainy)
}

let timer: number | undefined
onMounted(() => {
  syncPaperBreath()
  timer = window.setInterval(syncPaperBreath, 60_000)
})
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  document.body.classList.remove('paper-night', 'paper-rain')
})
watch([() => trip.activeTripId, () => ui.activeDayIndex, () => weather.cache], syncPaperBreath, { deep: true })
</script>

<template>
  <div class="relative w-full h-full overflow-hidden bg-paper">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <InkWashOverlay />
    <ToastHost />
  </div>
</template>
