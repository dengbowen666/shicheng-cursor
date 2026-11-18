<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCityStore } from '../../stores/city'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { CATEGORY_LABEL } from '../../types'
import type { LngLat, POI, POICategory } from '../../types'
import { Search, Plus, MapPin, Sparkles, AlertTriangle, Loader2, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ city: string; autoFocus?: boolean }>(), { autoFocus: false })
const emit = defineEmits<{
  select: [poi: POI]
  'custom-request': [location: LngLat]
}>()

const cityStore = useCityStore()
const trip = useTripStore()
const ui = useUiStore()

const keyword = ref('')
const results = ref<POI[]>([])
const loading = ref(false)
const live = ref(false)
const cat = ref<POICategory>('sight')
const expanded = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

const inDayText = (poi: POI) => {
  const days = trip.inDays(poi.id)
  return days.length ? `已在第 ${days.join('、')} 日` : ''
}

async function runSearch(kw: string) {
  if (!kw) {
    const r = await cityStore.hotPois(props.city, cat.value, ui.mapKey)
    results.value = r.list.slice(0, 12)
    live.value = r.live
    loading.value = false
    return
  }
  loading.value = true
  const r = await cityStore.searchPoi(kw, props.city, ui.mapKey)
  results.value = r.list
  live.value = r.live
  loading.value = false
}

// 300ms 防抖；城市切换时立即重取
watch(keyword, kw => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void runSearch(kw.trim()), 300)
})
watch(() => props.city, () => void runSearch(keyword.value.trim()))
watch(cat, () => { if (!keyword.value.trim()) void runSearch('') })

function onDocumentPointerDown(e: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) expanded.value = false
}

onMounted(() => {
  void runSearch('')
  if (props.autoFocus) {
    expanded.value = true
    inputEl.value?.focus()
  }
  document.addEventListener('pointerdown', onDocumentPointerDown)
})
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

function clear() {
  keyword.value = ''
  expanded.value = true
  inputEl.value?.focus()
}

function choose(poi: POI) {
  expanded.value = false
  keyword.value = ''
  emit('select', poi)
}

/** 自定义地点：以城市中心附近随机点触发，由父级接管命名与入库 */
function customRequest() {
  const center = cityStore.findCity(props.city)?.center
  if (!center) {
    ui.toast('未找到该城市中心，无法落点')
    return
  }
  const jitter = () => (Math.random() - 0.5) * 0.02
  expanded.value = false
  emit('custom-request', { lng: center.lng + jitter(), lat: center.lat + jitter() })
}
</script>

<template>
  <section ref="rootEl" class="relative w-full text-ink">
    <!-- 收起态：仅一枚悬浮搜索条，不遮挡地图 -->
    <div class="paper-card h-11 flex items-center gap-2 px-3 shadow-paper cursor-text" @click="expanded = true">
      <span class="seal w-6 h-6 text-[11px] shrink-0">{{ city.slice(0, 1) }}</span>
      <Search :size="15" class="text-inkLight shrink-0" />
      <input
        ref="inputEl" v-model="keyword" type="search"
        :placeholder="`搜 ${city} 的景点、美食、住宿…`"
        class="flex-1 min-w-0 bg-transparent outline-none font-cn text-xs text-ink placeholder:text-inkLight/60"
        @focus="expanded = true"
      />
      <button v-if="keyword" class="text-inkLight hover:text-cinnabar shrink-0" title="清空" @click.stop="clear"><X :size="14" /></button>
      <Loader2 v-if="loading" :size="14" class="text-cyanq animate-spin shrink-0" />
    </div>

    <!-- 展开态：地点候选浮层 -->
    <Transition name="fade">
      <div v-if="expanded" class="absolute top-12 inset-x-0 z-40 paper-card shadow-paper max-h-[320px] overflow-y-auto drawer-scroll">
        <div class="px-3 pt-2.5 pb-2 border-b border-ink/10">
          <p class="font-cn text-[10px] text-inkLight tracking-wider">点一条即加入本日，路线自动相连</p>
          <div class="mt-2 flex gap-1">
            <button
              v-for="c in [{ k: 'sight', l: '景点' }, { k: 'food', l: '美食' }, { k: 'hotel', l: '住宿' }]" :key="c.k"
              type="button"
              class="h-7 px-2.5 border font-cn text-[11px]"
              :class="cat === c.k ? 'bg-cinnabar text-mist border-cinnabar' : 'border-ink/15 text-inkLight hover:border-celadon'"
              @click="cat = c.k as POICategory"
            >{{ c.l }}</button>
          </div>
          <div v-if="!ui.mapKey" class="mt-1.5 flex items-start gap-1.5 font-cn text-[10px] text-ochre leading-relaxed">
            <AlertTriangle :size="11" class="shrink-0 mt-0.5" />
            <span>暂无 Key，显示本地种子数据。到设置里填入腾讯位置 Key 即可搜索全国实时地点。</span>
          </div>
          <p v-else-if="live" class="mt-1.5 font-cn text-[10px] text-celadonDeep">实时地点 · 腾讯位置服务</p>
        </div>
        <div class="p-2 space-y-1.5">
          <button
            v-for="(poi, i) in results" :key="`${poi.id}-${i}`"
            class="group w-full paper-card px-2.5 py-2 flex items-center gap-2.5 text-left hover:border-cyanq/60 transition-colors"
            @click="choose(poi)"
          >
            <span class="seal-outline seal w-6 h-6 text-[11px] shrink-0">{{ CATEGORY_LABEL[poi.category] }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-cn text-xs text-ink truncate">{{ poi.name }}</span>
                <span v-if="poi.source === 'seed'" class="shrink-0 font-cn text-[9px] px-1 border border-ochre/50 text-ochre">演示数据</span>
              </div>
              <div class="font-cn text-[10px] text-inkLight truncate mt-0.5 flex items-center gap-1">
                <MapPin :size="9" class="shrink-0" />
                {{ poi.address || poi.city }}
                <span v-if="poi.rating" class="text-cinnabar shrink-0">· {{ poi.rating }}</span>
              </div>
            </div>
            <div class="shrink-0 flex flex-col items-end gap-1">
              <span v-if="inDayText(poi)" class="font-cn text-[9px] text-cinnabar whitespace-nowrap">{{ inDayText(poi) }}</span>
              <Plus :size="15" class="text-inkLight group-hover:text-cinnabar" />
            </div>
          </button>

          <div v-if="!loading && !results.length" class="text-center py-6 font-cn text-[11px] text-inkLight leading-relaxed">
            {{ keyword ? '未搜到相关地点，可自定义一个' : '该城市暂无预置地点' }}
          </div>

          <button class="w-full py-2 border border-dashed border-cyanq text-cyanqDeep font-cn text-[11px] hover:bg-cyanq/10 flex items-center justify-center gap-1.5" @click="customRequest">
            <Sparkles :size="13" /> 自定义地点（城市附近落点）
          </button>
        </div>
      </div>
    </Transition>
  </section>
</template>
