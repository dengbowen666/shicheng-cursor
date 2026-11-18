<script setup lang="ts">
import { computed } from 'vue'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { estimate, haversineFlat, recommendMode } from '../../lib/estimate'
import { MODE_LABEL } from '../../types'
import type { TransportMode, TransportSegment } from '../../types'
import { X, Car, Footprints, Bus, Bike, Sparkles, AlertTriangle, Coins } from 'lucide-vue-next'

const props = defineProps<{ segment: TransportSegment }>()
const emit = defineEmits<{
  choose: [mode: TransportMode]
  close: []
}>()

const trip = useTripStore()
const ui = useUiStore()

const from = computed(() => trip.activeTrip?.pois[props.segment.fromPoiId] || null)
const to = computed(() => trip.activeTrip?.pois[props.segment.toPoiId] || null)
const km = computed(() => {
  if (props.segment.distanceKm) return props.segment.distanceKm
  return from.value && to.value ? haversineFlat(from.value.location, to.value.location) : 0
})

const recommendation = computed(() => recommendMode(km.value))

const MODES: TransportMode[] = ['taxi', 'walk', 'transit', 'bike']
const MODE_ICON = { taxi: Car, walk: Footprints, transit: Bus, bike: Bike }
const MODE_CLASS: Record<TransportMode, string> = {
  taxi: 'text-ochre border-ochre/50',
  walk: 'text-cyanq border-cyanq/50',
  transit: 'text-inkLight border-hill',
  bike: 'text-celadonDeep border-celadonDeep/50',
}

function estimateOf(mode: TransportMode) {
  if (!from.value || !to.value) return null
  return estimate(from.value.location, to.value.location, mode)
}
function needKey(mode: TransportMode) {
  return mode === 'transit' && !ui.mapKey
}
function choose(mode: TransportMode) {
  if (needKey(mode)) {
    ui.toast('公交方式需要腾讯位置 Key 才能估算线路')
    return
  }
  emit('choose', mode)
}
</script>

<template>
  <div class="paper-card double-border w-full max-w-[360px] bg-mist shadow-paper overflow-hidden">
    <header class="flex items-start justify-between gap-2 px-3.5 py-3 border-b border-ink/15">
      <div class="min-w-0">
        <h3 class="font-brush text-base text-ink">换一种走法</h3>
        <p class="font-cn text-[10px] text-inkLight truncate mt-0.5">
          {{ from?.name || '?' }} <span class="text-ink/40">→</span> {{ to?.name || '?' }}
          <span v-if="km" class="font-num">· {{ km.toFixed(1) }}km</span>
        </p>
      </div>
      <button class="w-7 h-7 shrink-0 flex items-center justify-center text-inkLight hover:text-cinnabar border border-ink/20" @click="emit('close')" title="关闭">
        <X :size="14" />
      </button>
    </header>

    <div class="px-3.5 py-2.5 space-y-1.5">
      <!-- 推荐与预警 -->
      <div class="flex items-center gap-1.5 font-cn text-[11px] text-cyanqDeep">
        <Sparkles :size="12" class="shrink-0" />
        <span>推荐：{{ MODE_LABEL[recommendation.mode] }}</span>
        <span v-if="recommendation.warning" class="inline-flex items-center gap-0.5 text-ochre">
          <AlertTriangle :size="10" />{{ recommendation.warning }}
        </span>
      </div>

      <button
        v-for="mode in MODES" :key="mode"
        class="w-full flex items-center gap-2.5 px-2.5 py-2 border text-left hover:bg-paper/70 transition-colors"
        :class="[
          MODE_CLASS[mode],
          recommendation.mode === mode ? 'border-current' : 'border-ink/15',
          segment.mode === mode ? 'bg-paper' : '',
        ]"
        @click="choose(mode)"
      >
        <component :is="MODE_ICON[mode]" :size="16" class="shrink-0" />
        <span class="font-cn text-xs text-ink flex-1 flex items-center gap-1.5">
          {{ MODE_LABEL[mode] }}
          <span v-if="recommendation.mode === mode" class="font-cn text-[9px] px-1 border border-cyanq/50 text-cyanqDeep">宜</span>
          <span v-if="segment.mode === mode" class="font-cn text-[9px] text-inkLight">当前</span>
        </span>
        <template v-if="estimateOf(mode)">
          <span class="font-num text-[11px] text-inkLight">
            <template v-if="!needKey(mode) && estimateOf(mode)!.durationMin">{{ estimateOf(mode)!.durationMin }}分</template>
            <template v-else-if="needKey(mode)">需 Key</template>
            <template v-else>—</template>
          </span>
          <span v-if="estimateOf(mode)!.cost" class="font-num text-[10px] text-ochre inline-flex items-center gap-0.5">
            <Coins :size="9" />¥{{ estimateOf(mode)!.cost }}
          </span>
          <span class="text-cinnabar text-[10px]">估</span>
        </template>
      </button>

      <p class="font-cn text-[10px] text-inkLight/80 pt-1 leading-relaxed">
        无线路 Key 时按直线 × 经验速度推算，标「估」；公交需 Key 才能给出线路与用时。
      </p>
    </div>
  </div>
</template>
