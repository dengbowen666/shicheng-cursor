<script setup lang="ts">
import { computed } from 'vue'
import { Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudFog, Wind } from 'lucide-vue-next'
import { getWeather, weatherKind, weatherTip, shortDate } from '../../mock/weather'

const props = defineProps<{
  city: string
  /** 紧凑模式：只显示今天一行（用于顶栏） */
  compact?: boolean
}>()

const days = computed(() => getWeather(props.city))

const ICONS = { sun: Sun, cloudsun: CloudSun, cloud: Cloud, rain: CloudRain, snow: CloudSnow, fog: CloudFog } as const

function iconOf(text: string) { return ICONS[weatherKind(text)] }
</script>

<template>
  <div v-if="days" class="font-cn">
    <!-- 紧凑：顶栏一行 -->
    <div v-if="compact" class="flex items-center gap-2 h-9 px-3 paper-card">
      <component :is="iconOf(days[0].day)" :size="15" class="text-ochreDeep" />
      <span class="font-num text-sm text-ink">{{ days[0].tempMax }}°</span>
      <span class="font-cn text-[11px] text-inkLight">{{ days[0].day }}</span>
      <span v-if="weatherTip(days[0])" class="font-cn text-[10px] text-celadonDeep border-l border-ink/15 pl-2">
        {{ weatherTip(days[0]) }}
      </span>
    </div>

    <!-- 完整：四日 -->
    <div v-else class="paper-card p-3">
      <div class="flex items-center gap-1.5 mb-2">
        <Wind :size="12" class="text-celadonDeep" />
        <span class="font-cn text-[10px] tracking-[0.2em] text-inkLight">{{ city }}天气 · 四日</span>
      </div>
      <div class="grid grid-cols-4 gap-1">
        <div
          v-for="(d, i) in days" :key="d.date"
          class="flex flex-col items-center gap-1 py-1.5 border-t-2"
          :class="i === 0 ? 'border-cinnabar bg-cinnabar/5' : 'border-ink/15'"
        >
          <span class="font-num text-[10px] text-inkLight">{{ shortDate(d.date) }}</span>
          <component :is="iconOf(d.day)" :size="18" class="text-ochreDeep" />
          <span class="font-num text-xs text-ink">{{ d.tempMax }}°</span>
          <span class="font-num text-[10px] text-inkLight">{{ d.tempMin }}°</span>
          <span class="font-cn text-[9px] text-inkLight">{{ d.day }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
