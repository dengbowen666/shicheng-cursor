<script setup lang="ts">
/**
 * 首页「我的攻略」：一图一轴（D60–D62）+ 印记/行迹双态（D55–D58）+ 气韵入口（D63–D68）。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, Search, X, MapPin, ArrowRight, Archive, RotateCcw,
  CalendarDays, Wallet, Settings2,
} from 'lucide-vue-next'
import ChinaInkMap from '../components/map/ChinaInkMap.vue'
import ScrollSidebar from '../components/layout/ScrollSidebar.vue'
import MapModeToggle from '../components/layout/MapModeToggle.vue'
import TripWizard from '../components/editor/TripWizard.vue'
import TrailCityModal from '../components/overlay/TrailCityModal.vue'
import SettingsModal from '../components/overlay/SettingsModal.vue'
import KeyGuideModal from '../components/overlay/KeyGuideModal.vue'
import { useTripStore } from '../stores/trip'
import { useCityStore } from '../stores/city'
import { useWeatherStore } from '../stores/weather'
import { useUiStore } from '../stores/ui'
import type { City, Trip } from '../types'

const router = useRouter()
const trip = useTripStore()
const cityStore = useCityStore()
const weather = useWeatherStore()
const ui = useUiStore()

const keyword = ref('')
const results = ref<City[]>([])
const searching = ref(false)
const hotCities = ['大理', '丽江', '香格里拉', '西双版纳', '北京', '杭州', '成都', '西安', '厦门', '桂林']
const wizardOpen = ref(false)
const initialCity = ref<City | null>(null)
const focusProvince = ref<string | null>(null)
const selectedCity = ref<string | null>(null)
const archiveOpen = ref(false)
const axisOpen = ref(false)
const mapMode = ref<'mark' | 'trail'>('mark')
const trailCity = ref<string | null>(null)

let timer: ReturnType<typeof setTimeout> | null = null
watch(keyword, kw => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    results.value = cityStore.searchCities(kw).slice(0, 8)
    searching.value = !!kw.trim()
  }, 300)
})

function openWizard(city?: City | null) {
  initialCity.value = city || null
  wizardOpen.value = true
  axisOpen.value = false
}
function enterCity(city: City) {
  const hit = [...trip.trips].filter(t => t.cities.some(c => c.name === city.name)).sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (hit) {
    trip.openTrip(hit.id)
    router.push(`/trip/${hit.id}`)
    return
  }
  const t = trip.createTrip({ city, days: 3, title: `${city.name} · 3日` })
  router.push(`/trip/${t.id}`)
}
function openTrip(t: Trip) {
  trip.openTrip(t.id)
  router.push(`/trip/${t.id}`)
}
function onProvince(name: string) {
  focusProvince.value = name || null
  selectedCity.value = null
}
function onMapBack() {
  focusProvince.value = null
  selectedCity.value = null
}
function onCityMarker(name: string) {
  if (mapMode.value === 'trail') {
    trailCity.value = name
    return
  }
  const city = cityStore.findCity(name)
  if (!city) {
    ui.toast(`未找到「${name}」，请从挂轴搜索入城`)
    return
  }
  selectedCity.value = city.name
  enterCity(city)
}
function onCreated(id: string) {
  wizardOpen.value = false
  router.push(`/trip/${id}`)
}
function openTrailReview(id: string) {
  trailCity.value = null
  trip.openTrip(id)
  router.push({ path: `/trip/${id}`, query: { review: '1' } })
}

function isEnded(t: Trip) {
  return !!(t.archived || t.completedAt)
}

/** 印记态：进行中优先；行迹态：仅已结束，零盖章为虚边 */
const markers = computed(() => {
  type Marker = {
    name: string
    center: { lng: number; lat: number }
    state: 'todo' | 'active' | 'done' | 'ghost'
    count: number
    stamps: number
  }
  const map = new Map<string, Marker>()
  const source = mapMode.value === 'trail' ? trip.trips.filter(isEnded) : trip.trips

  for (const t of source) {
    const stamps = Object.values(t.pois).filter(p => p.visitedAt).length
    for (const c of t.cities) {
      const prev = map.get(c.name)
      const state: Marker['state'] = mapMode.value === 'trail'
        ? (stamps > 0 ? 'done' : 'ghost')
        : (isEnded(t) ? 'done' : 'active')

      if (!prev) {
        map.set(c.name, { name: c.name, center: c.center, state, count: 1, stamps })
        continue
      }

      const nextCount = prev.count + 1
      const nextStamps = prev.stamps + stamps
      if (mapMode.value === 'trail') {
        map.set(c.name, {
          name: c.name,
          center: c.center,
          state: nextStamps > 0 ? 'done' : 'ghost',
          count: nextCount,
          stamps: nextStamps,
        })
      } else {
        const nextState = (state === 'active' || prev.state === 'active') ? 'active' : state
        map.set(c.name, {
          name: c.name,
          center: c.center,
          state: nextState,
          count: nextCount,
          stamps: nextStamps,
        })
      }
    }
  }
  return [...map.values()]
})

/** 行迹：仅同一攻略内跨城淡墨虚线 */
const trailLinks = computed(() => {
  if (mapMode.value !== 'trail') return []
  const links: { from: { lng: number; lat: number }; to: { lng: number; lat: number }; key: string }[] = []
  for (const t of trip.trips.filter(isEnded)) {
    for (let i = 0; i < t.cities.length - 1; i++) {
      const a = t.cities[i]
      const b = t.cities[i + 1]
      links.push({
        from: a.center,
        to: b.center,
        key: `${t.id}-${a.name}-${b.name}`,
      })
    }
  }
  return links
})

/** 画眼：未归档中 updatedAt 最大者的首城 */
const focusCity = computed(() => {
  const live = trip.trips.filter(t => !isEnded(t)).sort((a, b) => b.updatedAt - a.updatedAt)[0]
  return live?.cities[0]?.name || null
})

/** 行迹统计（D58）：省缺失则不显示省数 */
const trailStats = computed(() => {
  const ended = trip.trips.filter(isEnded)
  const citySet = new Set<string>()
  const provinceSet = new Set<string>()
  let roadDays = 0
  let stamps = 0
  let hasProvince = true
  for (const t of ended) {
    roadDays += Math.max(1, t.days.length)
    stamps += Object.values(t.pois).filter(p => p.visitedAt).length
    for (const c of t.cities) {
      citySet.add(c.name)
      const province = c.province || cityStore.findCity(c.name)?.province
      if (!province) hasProvince = false
      else provinceSet.add(province)
    }
  }
  return {
    cities: citySet.size,
    provinces: hasProvince ? provinceSet.size : null,
    roadDays,
    stamps,
    years: [...new Set(ended.map(t => {
      const y = (t.startDate || new Date(t.completedAt || t.updatedAt).toISOString().slice(0, 10)).slice(0, 4)
      return y
    }).filter(Boolean))].sort(),
  }
})

const trailCityTrips = computed(() => {
  if (!trailCity.value) return []
  return trip.trips.filter(t => isEnded(t) && t.cities.some(c => c.name === trailCity.value))
})

function tripState(t: Trip): '已完成' | '行中' | '待启程' {
  if (isEnded(t)) return '已完成'
  if (!t.startDate) return '待启程'
  const n = Math.floor((Date.now() - new Date(t.startDate).getTime()) / 86400000) + 1
  return n >= 1 && n <= t.days.length ? '行中' : '待启程'
}
function spent(t: Trip) { return t.expenses.reduce((s, e) => s + e.amount, 0) }
function spots(t: Trip) { return t.days.reduce((s, d) => s + d.poiIds.filter(id => t.pois[id]?.role !== 'base').length, 0) }
function dateText(t: Trip) { return t.startDate ? `${t.startDate} 起` : '未定日期' }

const statsLine = computed(() => {
  if (mapMode.value === 'trail') {
    const s = trailStats.value
    const prov = s.provinces != null ? `历 ${s.provinces} 省 · ` : ''
    return `${prov}${s.cities} 城 · 在路 ${s.roadDays} 日 · 盖章 ${s.stamps} 枚`
  }
  const n = trip.activeTrips.length
  return n ? `进行中 ${n} 卷 · 点印入城` : '展卷，自一城始'
})

onMounted(async () => {
  // 移动端默认展开挂轴，避免找不到列表
  if (typeof window !== 'undefined' && window.innerWidth < 768) axisOpen.value = true
  const cities = [...new Set(trip.trips.flatMap(t => t.cities.map(c => c.name)))]
  await Promise.all(cities.map(name => {
    const c = cityStore.findCity(name)
    return c ? weather.loadCity(name, c.center) : Promise.resolve([])
  }))
})
</script>

<template>
  <div class="relative w-full h-full overflow-hidden paper-texture">
    <!-- 满幅地图舞台：无顶栏、无悬浮搜索 -->
    <div class="absolute inset-0">
      <ChinaInkMap
        :focus-province="focusProvince"
        :markers="markers"
        :selected-city="selectedCity"
        :focus-city="mapMode === 'mark' ? focusCity : null"
        :map-mode="mapMode"
        :trail-links="trailLinks"
        @select-province="onProvince"
        @select-city="onCityMarker"
        @back="onMapBack"
      />
    </div>

    <!-- D68：竖排压边题签 + 题跋式统计行 -->
    <div class="pointer-events-none absolute z-20 left-0 top-8 -translate-x-[10px] md:-translate-x-[12px] flex flex-col items-center gap-3">
      <div class="flex flex-col items-center gap-2">
        <span class="vertical-text font-brush text-[28px] md:text-[34px] leading-none text-ink/85 tracking-[0.22em]">拾程</span>
        <span class="seal w-9 h-9 text-[11px] flex-col leading-none seal-stamp"><span>拾</span><span>程</span></span>
      </div>
      <p class="pointer-events-none max-w-[11em] pl-3 font-cn text-[10px] md:text-[11px] leading-relaxed text-inkLight/90 tracking-wider">
        {{ statsLine }}
      </p>
      <div v-if="mapMode === 'trail' && trailStats.years.length > 1" class="flex flex-col gap-1 pl-3">
        <span
          v-for="y in trailStats.years" :key="y"
          class="font-num text-[10px] text-inkLight border border-ink/20 px-1.5 py-0.5 bg-mist/70"
        >{{ y }}</span>
      </div>
    </div>

    <!-- 空态：地图中央未钤虚边空印 -->
    <button
      v-if="!trip.trips.length && !focusProvince"
      type="button"
      class="absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 group"
      @click="openWizard()"
    >
      <span class="vertical-text font-brush text-xl text-ink/55 tracking-[0.35em]">展卷，自一城始</span>
      <span
        class="w-16 h-16 border-2 border-dashed border-cinnabar/45 text-cinnabar/70 font-brush text-lg flex items-center justify-center bg-mist/30 group-hover:border-cinnabar group-hover:text-cinnabar transition-colors"
        title="新建攻略"
      >印</span>
    </button>

    <!-- 右缘竖挂轴 -->
    <ScrollSidebar v-model:open="axisOpen">
      <div class="flex-1 min-h-0 flex flex-col">
        <!-- 城市搜索 -->
        <div class="px-3 pt-3 pb-2 shrink-0 space-y-2">
          <div class="relative">
            <div class="h-10 flex items-center gap-2 px-3 border border-ochre/35 bg-mist/80">
              <Search :size="15" class="text-inkLight shrink-0" />
              <input
                v-model="keyword"
                class="flex-1 bg-transparent outline-none font-cn text-sm text-ink placeholder:text-inkLight/60 min-w-0"
                placeholder="搜全国任一城市…"
              />
              <button v-if="keyword" type="button" class="text-inkLight hover:text-cinnabar" @click="keyword = ''"><X :size="14" /></button>
            </div>
            <div v-if="searching && results.length" class="absolute top-11 inset-x-0 z-20 border border-ink/15 bg-paper shadow-paper max-h-[240px] overflow-y-auto">
              <button
                v-for="c in results" :key="c.id"
                type="button"
                class="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-ink/10 last:border-0 hover:bg-celadon/10"
                @click="enterCity(c); keyword = ''; searching = false"
              >
                <MapPin :size="14" class="text-cinnabar shrink-0" />
                <span class="flex-1 min-w-0">
                  <span class="block font-cn text-sm text-ink truncate">{{ c.name }}</span>
                  <span class="block font-cn text-[10px] text-inkLight">{{ c.province }}</span>
                </span>
                <ArrowRight :size="13" class="text-inkLight" />
              </button>
            </div>
            <p v-else-if="searching" class="absolute top-11 inset-x-0 z-20 border border-ink/15 bg-paper px-3 py-3 text-center font-cn text-[11px] text-inkLight">
              暂未找到，试试省会或热门旅游城市
            </p>
          </div>

          <MapModeToggle v-model:mode="mapMode" />

          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="name in hotCities" :key="name"
              type="button"
              class="h-7 px-2 border border-ink/15 font-cn text-[10px] text-inkLight hover:border-cinnabar/40 hover:text-cinnabar"
              @click="cityStore.findCity(name) && enterCity(cityStore.findCity(name)!)"
            >{{ name }}</button>
          </div>

          <button
            type="button"
            class="w-full h-10 bg-cinnabar text-mist font-cn text-sm flex items-center justify-center gap-1.5 btn-seal"
            @click="openWizard()"
          >
            <Plus :size="15" /> 新建攻略
          </button>
        </div>

        <!-- 攻略列表 -->
        <div class="flex-1 min-h-0 overflow-y-auto drawer-scroll px-3 pb-3 space-y-2.5">
          <div class="flex items-center justify-between px-0.5 pt-1">
            <div class="flex items-center gap-2">
              <span class="w-1 h-3.5 bg-cinnabar" />
              <h2 class="font-brush text-base text-ink">我的攻略</h2>
              <span class="seal w-5 h-5 text-[9px]">{{ trip.trips.length }}</span>
            </div>
            <span class="font-cn text-[9px] text-inkLight tracking-widest">按更新</span>
          </div>

          <div v-if="!trip.activeTrips.length && !trip.archivedTrips.length" class="text-center py-10">
            <p class="font-brush text-lg text-ink/70">卷首空白页</p>
            <p class="font-cn text-xs text-inkLight mt-1">自挂轴或空印启程</p>
          </div>

          <button
            v-for="t in trip.activeTrips" :key="t.id"
            type="button"
            class="w-full paper-card text-left p-3 flex gap-3 group relative overflow-hidden"
            @click="openTrip(t)"
          >
            <span v-if="tripState(t) === '行中'" class="absolute left-0 top-0 bottom-0 w-1 bg-cinnabar" />
            <span class="seal w-10 h-10 text-[11px] shrink-0 flex-col leading-tight">
              <span>{{ t.sealText.slice(0, 1) }}</span>
              <span>{{ t.sealText.slice(1, 2) || '程' }}</span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="font-brush text-base text-ink truncate">{{ t.title }}</span>
                <span v-if="tripState(t) === '行中'" class="font-cn text-[9px] text-cinnabar border border-cinnabar/40 px-1">进行中</span>
              </span>
              <span class="mt-1 block font-cn text-[10px] text-inkLight flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span class="inline-flex items-center gap-1"><CalendarDays :size="10" />{{ dateText(t) }}</span>
                <span>{{ t.days.length }} 天 · {{ spots(t) }} 处</span>
                <span class="inline-flex items-center gap-1">
                  <Wallet :size="10" />¥{{ (spent(t) / 100).toFixed(0) }}
                  <template v-if="t.totalBudget"> / {{ (t.totalBudget / 100).toFixed(0) }}</template>
                </span>
              </span>
            </span>
            <ArrowRight :size="15" class="text-inkLight/50 group-hover:text-cinnabar shrink-0 self-center" />
          </button>

          <div class="pt-1">
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-ink/20 text-inkLight font-cn text-[11px] hover:border-celadon"
              @click="archiveOpen = !archiveOpen"
            >
              <Archive :size="12" /> 已行卷 · {{ trip.archivedTrips.length }}
              <RotateCcw v-if="archiveOpen" :size="11" />
            </button>
            <div v-if="archiveOpen" class="mt-2 space-y-2">
              <div v-for="t in trip.archivedTrips" :key="t.id" class="paper-card p-3 flex items-center gap-3">
                <span class="seal seal-muted w-9 h-9 text-[10px]">{{ t.sealText.slice(0, 1) }}</span>
                <button type="button" class="flex-1 min-w-0 text-left" @click="openTrip(t)">
                  <span class="block font-cn text-xs text-ink truncate">{{ t.title }}</span>
                  <span class="block font-cn text-[10px] text-inkLight">{{ dateText(t) }} · {{ spots(t) }} 处</span>
                </button>
                <button
                  type="button"
                  class="font-cn text-[10px] text-celadonDeep border border-celadon px-1.5 py-0.5"
                  @click.stop="trip.archiveTrip(t.id, false)"
                >恢复</button>
              </div>
              <p v-if="!trip.archivedTrips.length" class="text-center font-cn text-[10px] text-inkLight py-2">还没有归入已行卷的攻略</p>
            </div>
          </div>
        </div>

        <!-- 卷尾设置 -->
        <div class="shrink-0 border-t border-ink/12 px-3 py-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            class="h-8 px-2.5 font-cn text-[11px] text-inkLight hover:text-cinnabar inline-flex items-center gap-1.5"
            @click="ui.openModal('settings')"
          >
            <Settings2 :size="13" /> 设置 · Key / 备份
          </button>
          <span
            class="font-cn text-[9px] border px-1.5 py-0.5"
            :class="ui.mapKey ? 'text-celadonDeep border-celadon/60' : 'text-cinnabar border-cinnabar/50'"
          >{{ ui.mapKey ? '实时服务' : '演示数据' }}</span>
        </div>
      </div>
    </ScrollSidebar>

    <TripWizard :open="wizardOpen" :initial-city="initialCity" @close="wizardOpen = false" @created="onCreated" />
    <TrailCityModal
      v-if="trailCity"
      :city="trailCity"
      :trips="trailCityTrips"
      @close="trailCity = null"
      @open="openTrailReview"
    />
    <SettingsModal v-if="ui.modal === 'settings'" @close="ui.closeModal()" />
    <KeyGuideModal v-if="ui.modal === 'keyGuide'" @close="ui.closeModal()" />
  </div>
</template>
