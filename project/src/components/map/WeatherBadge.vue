<script setup lang="ts">
/** 右上角淡青天气小牌（图标 + 当前温度），点击 emit open。 */
import { computed } from 'vue'
import {
  Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun,
} from 'lucide-vue-next'
import type { DailyWeather } from '../../types'

const props = defineProps<{ weather: DailyWeather }>()
const emit = defineEmits<{ (e: 'open'): void }>()

const icon = computed(() => {
  const t = props.weather.text || ''
  const c = props.weather.code
  if (/雷/.test(t) || c >= 95) return CloudLightning
  if (/雪/.test(t) || (c >= 71 && c <= 77)) return CloudSnow
  if (/雾|霾/.test(t) || c === 45 || c === 48) return CloudFog
  if (/雨/.test(t) || (c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return CloudRain
  if (/晴/.test(t) && /云/.test(t)) return CloudSun
  if (/晴/.test(t) || c === 0) return Sun
  if (/云|阴/.test(t) || (c >= 1 && c <= 3)) return Cloud
  return CloudSun
})

const current = computed(() => Math.round((props.weather.tempMax + props.weather.tempMin) / 2))
</script>

<template>
  <button
    type="button"
    data-map-interactive
    :title="`${weather.text} · ${weather.tempMin}° ~ ${weather.tempMax}°`"
    class="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-[1px] border border-cyanq/45 bg-mist/92 px-2.5 py-1 text-ink shadow-paper backdrop-blur-sm transition-colors hover:bg-cyanq/15 outline outline-1 outline-offset-[-3px] outline-ink/10"
    @click.stop="emit('open')"
  >
    <component :is="icon" :size="15" :stroke-width="1.8" class="text-cyanq" />
    <span class="font-num text-sm font-semibold leading-none">{{ current }}°</span>
    <span class="font-cn text-[10px] leading-none text-inkLight">{{ weather.text }}</span>
  </button>
</template>
