<script setup lang="ts">
/**
 * 首页「我的攻略」：一图一轴（D60–D62）+ 印记/行迹双态（D55–D58）+ 气韵入口（D63–D68）。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, Search, X, MapPin, ArrowRight, RotateCcw,
  CalendarDays, Wallet, Settings2,
} from 'lucide-vue-next'
import ChinaInkMap from '../components/map/ChinaInkMap.vue'
import ScrollSidebar from '../components/layout/ScrollSidebar.vue'
import MapModeToggle from '../components/layout/MapModeToggle.vue'
import TripWizard from '../components/editor/TripWizard.vue'
import TrailCityModal from '../components/overlay/TrailCityModal.vue'
import CityTripsModal from '../components/overlay/CityTripsModal.vue'
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
const cityTripsCity = ref<string | null>(null)
const focusProvince = ref<string | null>(null)
const selectedCity = ref<string | null>(null)
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
  const hits = trip.trips.filter(t => t.cities.some(c => c.name === city.name))
  if (hits.length > 1) {
    // 一城多段行旅：列出让用户自己选，不再静默取最近一份
    cityTripsCity.value = city.name
    return
  }
  if (hits.length === 1) {
    trip.openTrip(hits[0].id)
    router.push(`/trip/${hits[0].id}`)
    return
  }
  // D92：无攻略时不静默建攻略，预选城市打开向导，由用户确认天数/预算/闲章
  openWizard(city)
}

/** 印记浮层：该城进行中的攻略（多份才弹此层） */
const cityTripsList = computed(() =>
  cityTripsCity.value
    ? trip.trips.filter(t => t.cities.some(c => c.name === cityTripsCity.value) && !isEnded(t))
    : [],
)
function openCityTrip(id: string) {
  cityTripsCity.value = null
  trip.openTrip(id)
  router.push(`/trip/${id}`)
}
function createCityTrip() {
  const city = cityStore.findCity(cityTripsCity.value || '')
  cityTripsCity.value = null
  openWizard(city)
}
function deleteCityTrip(id: string) {
  trip.deleteTrip(id)
  ui.toast('已删除此卷', '撤销', () => trip.undo())
  if (cityTripsList.value.length === 0) cityTripsCity.value = null
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
  // 印记态只留未行之地：已结束（行了）的攻略不在此标记，只在行迹态出现
  const source = mapMode.value === 'trail'
    ? trip.trips.filter(isEnded)
    : trip.trips.filter(t => !isEnded(t))

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

/** 卷的排序时间：出发日优先，缺则完成日/更新日 */
function tripDate(t: Trip) { return t.startDate || t.completedAt || t.updatedAt }
/** 归年份：YYYY-MM-DD 或毫秒时间戳都取前四位；无日期归「未定年」 */
function tripYear(t: Trip): string {
  // 只认出发日/完成日；不能用 updatedAt（编辑时间）冒充旅行年份
  const d = t.startDate || t.completedAt
  if (!d) return '未定年'
  const s = typeof d === 'number' ? new Date(d).toISOString().slice(0, 10) : String(d)
  return s.slice(0, 4) || '未定年'
}

/** 侧栏清单与地图态严格对应：印记→未行攻略，行迹→已行卷 */
const sideTrips = computed(() =>
  trip.trips.filter(t => mapMode.value === 'trail' ? isEnded(t) : !isEnded(t)),
)
const sideCount = computed(() => sideTrips.value.length)
/** 按日期分组到年，组内按日期近者先；年份由近及远 */
const yearGroups = computed(() => {
  const groups = new Map<string, Trip[]>()
  for (const t of sideTrips.value) {
    const y = tripYear(t)
    if (!groups.has(y)) groups.set(y, [])
    groups.get(y)!.push(t)
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const da = tripDate(a)
      const db = tripDate(b)
      const va = typeof da === 'number' ? da : da ? new Date(da).getTime() : 0
      const vb = typeof db === 'number' ? db : db ? new Date(db).getTime() : 0
      return vb - va
    })
  }
  const yearOrder = (y: string) => y === '未定年' ? -1 : Number(y) || 0
  return [...groups.entries()].sort((a, b) => yearOrder(b[0]) - yearOrder(a[0]))
})

/** 年份折叠：两态各自记住，键带模式前缀避免互相干扰 */
const collapsedKeys = ref<Set<string>>(new Set())
function groupKey(year: string) { return `${mapMode.value}:${year}` }
function isCollapsed(year: string) { return collapsedKeys.value.has(groupKey(year)) }
function toggleYear(year: string) {
  const next = new Set(collapsedKeys.value)
  const k = groupKey(year)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  collapsedKeys.value = next
}
const allFolded = computed(() => yearGroups.value.length > 0 && yearGroups.value.every(g => isCollapsed(g[0])))
function toggleAllYears() {
  const next = new Set<string>()
  if (!allFolded.value) for (const [year] of yearGroups.value) next.add(groupKey(year))
  // 保留另一态的折叠状态
  for (const k of collapsedKeys.value) if (!k.startsWith(`${mapMode.value}:`)) next.add(k)
  collapsedKeys.value = next
}

const statsLine = computed(() => {
  if (mapMode.value === 'trail') {
    const s = trailStats.value
    const prov = s.provinces != null ? `历 ${s.provinces} 省 · ` : ''
    return `${prov}${s.cities} 城 · 在路 ${s.roadDays} 日 · 盖章 ${s.stamps} 枚`
  }
  const n = trip.activeTrips.length
  return n ? `进行中 ${n} 卷 · 点印入城` : '展卷，自一城始'
})

/** 卷首左轴的气韵数字：两态各给三个最相关的量，随态切换 */
const axisStats = computed(() => {
  if (mapMode.value === 'trail') {
    const s = trailStats.value
    return [
      { v: s.cities, label: '城' },
      { v: s.roadDays, label: '日' },
      { v: s.stamps, label: '章' },
    ]
  }
  const stamps = trip.activeTrips.reduce((n, t) => n + Object.values(t.pois).filter(p => p.visitedAt).length, 0)
  return [
    { v: trip.activeTrips.length, label: '卷' },
    { v: markers.value.length, label: '城' },
    { v: stamps, label: '章' },
  ]
})

/** 点年份：展开挂轴并把对应年份卷滚到视野；若该年已折叠则先展开 */
async function jumpToYear(year: string) {
  axisOpen.value = true
  const key = groupKey(year)
  if (collapsedKeys.value.has(key)) {
    const next = new Set(collapsedKeys.value)
    next.delete(key)
    collapsedKeys.value = next
  }
  await nextTick()
  document.getElementById(`year-${mapMode.value}-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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

    <!-- 卷首左轴：题签 + 态铭 + 气韵 + 印谱 + 年次。与地图以竖墨线分界，填掉留白而非浮在纸上 -->
    <div class="pointer-events-none absolute z-20 left-0 top-0 bottom-0 w-[130px] hidden md:flex flex-col items-stretch">
      <!-- 与地图的分界线 -->
      <span class="absolute right-0 top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-ink/18 to-transparent" />
      <span class="absolute right-[3px] top-10 bottom-10 w-px bg-gradient-to-b from-transparent via-ink/8 to-transparent" />

      <!-- 题签 -->
      <div class="flex flex-col items-center gap-3 pt-9 pb-5">
        <span class="vertical-text font-brush text-[30px] leading-none text-ink/88 tracking-[0.22em]">拾程</span>
        <span class="seal w-9 h-9 text-[11px] flex-col leading-none seal-stamp"><span>拾</span><span>程</span></span>
      </div>

      <!-- 当前态铭牌 -->
      <div class="mx-3 mb-4 py-2 border-y border-ink/12 flex flex-col items-center gap-1">
        <span class="font-cn text-[9px] tracking-[0.3em] text-inkLight">当前卷帙</span>
        <span
          class="font-brush text-xl tracking-[0.16em] leading-none"
          :class="mapMode === 'trail' ? 'text-celadonDeep' : 'text-cinnabar'"
        >{{ mapMode === 'trail' ? '行迹' : '印记' }}</span>
      </div>

      <!-- 气韵数字 -->
      <div class="px-4 mb-5 grid grid-cols-3 gap-1">
        <div v-for="s in axisStats" :key="s.label" class="flex flex-col items-center gap-0.5">
          <span class="font-num text-[22px] leading-none text-ink/85 tabular-nums">{{ s.v }}</span>
          <span class="font-cn text-[9px] text-inkLight tracking-wider">{{ s.label }}</span>
        </div>
      </div>

      <!-- 印谱图例：说明朱印/行印/虚边/墨线各是什么 -->
      <div class="px-4 mb-5">
        <p class="font-cn text-[9px] tracking-[0.25em] text-inkLight/80 mb-2">印谱</p>
        <ul class="space-y-2">
          <li class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 shrink-0 bg-cinnabar border border-cinnabarDeep flex items-center justify-center text-mist text-[9px] leading-none">城</span>
            <span class="font-cn text-[10px] text-inkLight">朱印 · 将行</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 shrink-0 bg-cinnabar border border-cinnabarDeep flex items-center justify-center text-mist text-[9px] leading-none">行</span>
            <span class="font-cn text-[10px] text-inkLight">行印 · 已钤</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 shrink-0 border border-dashed border-ink/45" />
            <span class="font-cn text-[10px] text-inkLight">虚边 · 未至</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="w-3.5 h-0 shrink-0 border-t border-dashed border-cinnabar/70" />
            <span class="font-cn text-[10px] text-inkLight">墨线 · 城际</span>
          </li>
        </ul>
      </div>

      <!-- 年次索引：点一下展开挂轴并滚到该年 -->
      <div v-if="yearGroups.length" class="px-4 mt-auto pb-8">
        <p class="font-cn text-[9px] tracking-[0.25em] text-inkLight/80 mb-2">年次</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="[year] in yearGroups" :key="year"
            type="button"
            class="pointer-events-auto font-num text-[10px] text-inkLight border border-ink/18 px-1.5 py-0.5 bg-mist/55 hover:border-cinnabar/50 hover:text-cinnabar transition-colors"
            :title="`展开挂轴，查看 ${year} 年攻略`"
            @click="jumpToYear(year)"
          >{{ year }}</button>
        </div>
        <p class="mt-3 font-cn text-[9px] leading-relaxed text-inkLight/75 tracking-wide">{{ statsLine }}</p>
      </div>
      <p v-else class="px-4 mt-auto pb-8 font-cn text-[10px] leading-relaxed text-inkLight/90 tracking-wide">{{ statsLine }}</p>
    </div>

    <!-- 小屏：压边题签仍保留，避免完全空白 -->
    <div class="pointer-events-none absolute z-20 left-0 top-6 flex md:hidden flex-col items-center gap-2 -translate-x-[6px]">
      <span class="vertical-text font-brush text-[22px] leading-none text-ink/85 tracking-[0.22em]">拾程</span>
      <span class="seal w-8 h-8 text-[10px] flex-col leading-none seal-stamp"><span>拾</span><span>程</span></span>
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

        <!-- 攻略列表：与地图态严格对应。印记→我的攻略（未行），行迹→已行卷（已行） -->
        <div class="flex-1 min-h-0 overflow-y-auto drawer-scroll px-3 pb-3 space-y-2">
          <div class="flex items-center justify-between px-0.5 pt-1 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-1 h-3.5" :class="mapMode === 'trail' ? 'bg-celadonDeep' : 'bg-cinnabar'" />
              <h2 class="font-brush text-base text-ink whitespace-nowrap">
                {{ mapMode === 'trail' ? '已行卷' : '我的攻略' }}
              </h2>
              <span class="seal w-5 h-5 text-[9px] shrink-0">{{ sideCount }}</span>
            </div>
            <button
              v-if="yearGroups.length"
              type="button"
              class="font-cn text-[9px] text-inkLight tracking-widest hover:text-cinnabar whitespace-nowrap"
              :title="allFolded ? '展开所有年份' : '收拢所有年份'"
              @click="toggleAllYears"
            >{{ allFolded ? '全展' : '全收' }}</button>
          </div>

          <div v-if="!sideCount" class="text-center py-10">
            <p class="font-brush text-lg text-ink/70">{{ mapMode === 'trail' ? '行卷尚空' : '卷首空白页' }}</p>
            <p class="font-cn text-xs text-inkLight mt-1">
              {{ mapMode === 'trail' ? '走完的路会归入此卷' : '自挂轴或空印启程' }}
            </p>
          </div>

          <!-- 按年份分卷：组头可点展开/收拢 -->
          <section v-for="[year, trips] in yearGroups" :key="year" :id="`year-${mapMode}-${year}`" class="pt-0.5 scroll-mt-2">
            <button
              type="button"
              class="w-full flex items-center gap-2 py-1.5 border-b border-ink/12 hover:border-cinnabar/40 group"
              :aria-expanded="!isCollapsed(year)"
              @click="toggleYear(year)"
            >
              <RotateCcw
                :size="11"
                class="text-inkLight shrink-0 transition-transform duration-200"
                :class="isCollapsed(year) ? '-rotate-90' : ''"
              />
              <span class="font-num text-[11px] tracking-wider text-ink">{{ year }}</span>
              <span v-if="year !== '未定年'" class="font-cn text-[9px] text-inkLight">年</span>
              <span class="font-cn text-[9px] text-inkLight">· {{ trips.length }} 卷</span>
              <span class="flex-1" />
              <span class="w-6 h-px bg-ink/15" />
            </button>

            <div v-show="!isCollapsed(year)" class="mt-2 space-y-2">
              <!-- 印记态：未行攻略大卡片 -->
              <template v-if="mapMode === 'mark'">
                <button
                  v-for="t in trips" :key="t.id"
                  type="button"
                  class="w-full paper-card text-left p-3 flex gap-3 group relative overflow-hidden"
                  data-side-trip
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
              </template>

              <!-- 行迹态：已行卷紧凑卡 + 恢复 -->
              <template v-else>
                <div v-for="t in trips" :key="t.id" class="paper-card p-3 flex items-center gap-3" data-side-trip>
                  <span class="seal seal-muted w-9 h-9 text-[10px] shrink-0">{{ t.sealText.slice(0, 1) }}</span>
                  <button type="button" class="flex-1 min-w-0 text-left" @click="openTrip(t)">
                    <span class="block font-cn text-xs text-ink truncate">{{ t.title }}</span>
                    <span class="block font-cn text-[10px] text-inkLight">{{ dateText(t) }} · {{ spots(t) }} 处</span>
                  </button>
                  <button
                    type="button"
                    class="font-cn text-[10px] text-celadonDeep border border-celadon px-1.5 py-0.5 shrink-0 hover:bg-celadon/10"
                    @click="trip.archiveTrip(t.id, false); ui.toast('已恢复为攻略', '撤销', () => trip.archiveTrip(t.id, true))"
                  >恢复</button>
                </div>
              </template>
            </div>
          </section>
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
      @delete="(id) => { trip.deleteTrip(id); ui.toast('已删除此卷', '撤销', () => trip.undo()); if (!trailCityTrips.length) trailCity = null }"
    />
    <CityTripsModal
      v-if="cityTripsCity"
      :city="cityTripsCity"
      :trips="cityTripsList"
      @close="cityTripsCity = null"
      @open="openCityTrip"
      @create="createCityTrip"
      @delete="deleteCityTrip"
    />
    <SettingsModal v-if="ui.modal === 'settings'" @close="ui.closeModal()" />
    <KeyGuideModal v-if="ui.modal === 'keyGuide'" @close="ui.closeModal()" />
  </div>
</template>
