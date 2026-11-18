<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGuideStore } from '../stores/guides'
import { useUIStore } from '../stores/ui'
import { getCityPOIs } from '../mock/city-pois'
import { MODE_LIST, MODE_COLOR } from '../lib/transport'
import { launchNavigation } from '../lib/navigation'
import CityMap from '../components/map/CityMap.vue'
import WeatherStrip from '../components/overlay/WeatherStrip.vue'
import type { TravelMode } from '../types'
import {
  ChevronLeft, Plus, Trash2, ArrowUp, ArrowDown, X,
  Landmark, Wallet, Search, Clock, Settings2, ListOrdered, Navigation, ChevronUp,
} from 'lucide-vue-next'

const guideStore = useGuideStore()
const uiStore = useUIStore()
const guide = computed(() => guideStore.activeGuide)

const activeDay = ref(1)
const selectedNodeId = ref<string | null>(null)
const poiSearch = ref('')
const editingLegId = ref<string | null>(null)
// 移动端面板
const mobilePanel = ref<null | 'poi' | 'itinerary' | 'expense'>(null)

const cityPOIs = computed(() => guide.value ? getCityPOIs(guide.value.cityName) : [])
const filteredPOIs = computed(() => {
  const kw = poiSearch.value.trim()
  return kw ? cityPOIs.value.filter(p => p.name.includes(kw)) : cityPOIs.value
})
const currentDay = computed(() => guide.value?.days.find(d => d.dayIndex === activeDay.value) || guide.value?.days[0])
const totalSpent = computed(() => guide.value?.expenses.reduce((s, e) => s + e.amount, 0) || 0)
const selectedNode = computed(() => currentDay.value?.nodes.find(n => n.id === selectedNodeId.value) || null)

const addedPOIIds = computed(() => new Set((currentDay.value?.nodes || []).map(n => n.poiId).filter(Boolean)))

function addPOI(poi: any) {
  if (!guide.value) return
  guideStore.addNode(activeDay.value, {
    name: poi.name, shortName: poi.shortName, category: poi.category,
    lat: poi.lat, lng: poi.lng, address: poi.address, city: poi.city,
    coverImage: poi.coverImage, rating: poi.rating, pricePerPerson: poi.pricePerPerson,
    poiId: poi.poiId, stayMinutes: 120,
  })
}

// 自定义地点
const customForm = ref({ name: '', address: '', category: 'sight' as 'sight' | 'food' | 'hotel' | 'transport', show: false })
function addCustom() {
  if (!customForm.value.name.trim() || !guide.value) return
  const c = guide.value.center
  const jitter = (Math.random() - 0.5) * 0.02
  guideStore.addNode(activeDay.value, {
    name: customForm.value.name.trim(),
    shortName: customForm.value.name.trim().slice(0, 6),
    category: customForm.value.category,
    lat: c.lat + jitter,
    lng: c.lng + jitter,
    address: customForm.value.address.trim() || '自定义地点',
    stayMinutes: 90,
  })
  customForm.value = { name: '', address: '', category: 'sight', show: false }
}

function setMode(legId: string, mode: TravelMode) {
  guideStore.setLegMode(activeDay.value, legId, mode)
  editingLegId.value = null
}
function addDay() {
  guideStore.addDay()
  activeDay.value = guide.value!.days.length
}
function dayCost(d: any) { return (d.legs as any[]).reduce((s, l) => s + (l.cost || 0), 0) }

// 记账
const expForm = ref({ title: '', amount: '' })
function addExp() {
  const amt = parseFloat(expForm.value.amount)
  if (!expForm.value.title.trim() || isNaN(amt)) return
  guideStore.addExpense({ dayIndex: activeDay.value, date: '', amount: amt, category: 'food', title: expForm.value.title.trim() })
  expForm.value = { title: '', amount: '' }
}

// 一键导航：从当前位置出发
const NAV_MODE: Record<TravelMode, 'drive' | 'transit' | 'walk' | 'bike'> = {
  drive: 'drive', walk: 'walk', bike: 'bike', transit: 'transit', train: 'drive',
}
const weatherOpen = ref(false)

/** 到达该节点所采用的方式（首个节点默认打车），让导航方式与行程设定一致 */
function navModeOf(nodeId: string): 'drive' | 'transit' | 'walk' | 'bike' {
  const legs = currentDay.value?.legs || []
  const leg = legs.find(l => l.toId === nodeId)
  return leg ? NAV_MODE[leg.mode] : 'drive'
}
function navigate(node: any) {
  if (!node) return
  launchNavigation(node.name, { lat: node.lat, lng: node.lng }, uiStore.tmapKey, navModeOf(node.id))
}
</script>

<template>
  <div v-if="guide" class="relative w-full h-full flex flex-col bg-paper overflow-hidden">
    <!-- 顶栏 -->
    <header class="shrink-0 h-16 paper-texture border-b border-ink/25 flex items-center justify-between px-3 md:px-5 z-50">
      <div class="flex items-center gap-2 md:gap-3 min-w-0">
        <button class="w-9 h-9 flex items-center justify-center paper-card text-inkLight hover:text-ink shrink-0" @click="uiStore.gotoExplore()">
          <ChevronLeft :size="18" />
        </button>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="seal w-7 h-7 text-xs shrink-0">{{ guide.cityName.slice(0,1) }}</span>
            <h1 class="font-brush text-lg md:text-xl text-ink truncate">{{ guide.cityName }} · 行旅攻略</h1>
          </div>
          <p class="font-cn text-[10px] text-inkLight tracking-widest truncate">{{ guide.province }} · {{ guide.days.length }} 天</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- 天气：点开展开四日预报 -->
        <div class="relative hidden md:block">
          <button class="flex items-center gap-1" @click="weatherOpen = !weatherOpen" title="天气">
            <WeatherStrip :city="guide.cityName" compact />
            <ChevronUp :size="12" class="text-inkLight transition-transform" :class="weatherOpen ? '' : 'rotate-180'" />
          </button>
          <Transition name="fade">
            <div v-if="weatherOpen" class="absolute right-0 top-11 w-[300px] z-50 shadow-xl"><WeatherStrip :city="guide.cityName" /></div>
          </Transition>
        </div>
        <div class="hidden sm:flex items-center gap-1.5 paper-card h-9 px-3">
          <Wallet :size="14" class="text-cinnabar" />
          <span class="font-num text-sm text-ink">¥{{ totalSpent }}</span>
        </div>
        <button class="w-9 h-9 flex items-center justify-center paper-card text-inkLight hover:text-ink" @click="uiStore.gotoLibrary()" title="攻略库">
          <ListOrdered :size="16" />
        </button>
        <button class="w-9 h-9 flex items-center justify-center paper-card text-inkLight hover:text-ink" @click="uiStore.settingsOpen = true" title="设置">
          <Settings2 :size="16" />
        </button>
      </div>
    </header>

    <div class="flex-1 flex min-h-0">
      <!-- 左：景点库 / 记账 -->
      <aside
        class="flex-col paper-texture border-r border-ink/20 md:z-40 lg:static lg:flex lg:w-[290px] lg:shrink-0"
        :class="mobilePanel === 'poi' || mobilePanel === 'expense' ? 'flex fixed inset-y-0 left-0 w-[86%] max-w-[330px] shadow-drawer z-[60]' : 'hidden'"
      >
        <div class="flex border-b border-ink/15 shrink-0">
          <button class="flex-1 py-2.5 font-cn text-xs tracking-widest transition-colors" :class="mobilePanel === 'expense' ? 'text-inkLight' : 'text-cinnabar border-b-2 border-cinnabar bg-cinnabar/5'" @click="mobilePanel = 'poi'">
            <Landmark :size="13" class="inline mr-1" />景点库
          </button>
          <button class="flex-1 py-2.5 font-cn text-xs tracking-widest transition-colors" :class="mobilePanel === 'expense' ? 'text-cinnabar border-b-2 border-cinnabar bg-cinnabar/5' : 'text-inkLight'" @click="mobilePanel = 'expense'">
            <Wallet :size="13" class="inline mr-1" />记账
          </button>
          <button class="lg:hidden w-10 flex items-center justify-center text-inkLight" @click="mobilePanel = null"><X :size="16" /></button>
        </div>

        <!-- 景点库 -->
        <div v-if="mobilePanel !== 'expense'" class="flex-1 flex flex-col min-h-0">
          <div class="p-3">
            <div class="flex items-center gap-2 h-8 px-2.5 bg-mist/70 border border-ink/20">
              <Search :size="13" class="text-inkLight" />
              <input v-model="poiSearch" placeholder="搜索景点" class="flex-1 bg-transparent outline-none font-cn text-xs text-ink" />
            </div>
          </div>
          <div class="flex-1 overflow-y-auto drawer-scroll px-3 pb-3 space-y-1.5">
            <button
              v-for="poi in filteredPOIs" :key="poi.id"
              class="w-full flex items-center gap-2.5 p-2 hover:bg-celadon/10 border border-transparent hover:border-celadon/30 text-left group"
              :class="addedPOIIds.has(poi.poiId) ? 'opacity-50' : ''"
              @click="poi.poiId && addedPOIIds.has(poi.poiId) ? null : addPOI(poi)"
            >
              <div class="w-11 h-11 shrink-0 overflow-hidden img-fallback">
                <img :src="poi.coverImage" class="w-full h-full object-cover" @error="(e:any)=>e.target.style.display='none'" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-cn text-xs text-ink truncate">{{ poi.shortName }}</div>
                <div class="font-cn text-[10px] text-inkLight flex items-center gap-1.5">
                  <span class="text-cinnabar">★{{ poi.rating }}</span>
                  <span class="truncate">{{ poi.address.slice(0, 12) }}</span>
                </div>
              </div>
              <Plus v-if="!addedPOIIds.has(poi.poiId)" :size="15" class="text-inkLight group-hover:text-cinnabar shrink-0" />
              <span v-else class="font-cn text-[9px] text-inkLight shrink-0">已加</span>
            </button>

            <!-- 自定义地点 -->
            <div v-if="!customForm.show" class="pt-1">
              <button class="w-full py-2 border border-dashed border-celadon text-celadonDeep font-cn text-[11px] hover:bg-celadon/10 flex items-center justify-center gap-1" @click="customForm.show = true">
                <Plus :size="13" /> 自定义地点
              </button>
            </div>
            <div v-else class="paper-card p-2 space-y-1.5">
              <input v-model="customForm.name" placeholder="地点名称" class="w-full h-8 px-2 bg-mist border border-ochre/40 font-cn text-xs outline-none focus:border-celadon" />
              <input v-model="customForm.address" placeholder="地址（选填）" class="w-full h-8 px-2 bg-mist border border-ochre/40 font-cn text-xs outline-none focus:border-celadon" />
              <div class="flex gap-1">
                <button v-for="c in [{k:'sight',l:'景'},{k:'food',l:'食'},{k:'hotel',l:'宿'},{k:'transport',l:'行'}]" :key="c.k"
                  class="flex-1 h-7 font-cn text-[11px] border transition-colors"
                  :class="customForm.category === c.k ? 'bg-cinnabar text-mist border-cinnabar' : 'border-ink/25 text-inkLight'"
                  @click="customForm.category = c.k as any">{{ c.l }}</button>
              </div>
              <div class="flex gap-1.5">
                <button class="flex-1 h-7 bg-cinnabar text-mist font-cn text-[11px]" @click="addCustom">加入</button>
                <button class="flex-1 h-7 border border-ink/25 text-inkLight font-cn text-[11px]" @click="customForm.show = false">取消</button>
              </div>
            </div>

            <div v-if="!filteredPOIs.length && !customForm.show" class="text-center py-6 font-cn text-[11px] text-inkLight leading-relaxed">
              该城市暂无预置景点<br/>可用上方「自定义地点」添加
            </div>
          </div>

          <!-- 图例 -->
          <div class="shrink-0 border-t border-ink/15 p-3">
            <div class="font-cn text-[10px] text-inkLight tracking-widest mb-2">交通方式 · 点线路可改</div>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="m in MODE_LIST" :key="m.key" class="inline-flex items-center gap-1 font-cn text-[10px] px-1.5 py-0.5 border" :style="{ color: MODE_COLOR[m.key], borderColor: MODE_COLOR[m.key] + '99' }">
                <span class="w-3 border-t-2" :style="{ borderColor: MODE_COLOR[m.key], borderStyle: (m.key === 'walk' || m.key === 'bike' || m.key === 'transit') ? 'dashed' : 'solid' }"></span>
                {{ m.label }}
              </span>
            </div>
          </div>
        </div>

        <!-- 记账 -->
        <div v-else class="flex-1 flex flex-col min-h-0">
          <div class="p-3 space-y-2 border-b border-ink/10">
            <div class="flex gap-2">
              <input v-model="expForm.title" placeholder="开销名称" class="flex-1 h-8 px-2 bg-mist/70 border border-ink/20 font-cn text-xs outline-none focus:border-celadon" />
              <input v-model="expForm.amount" type="number" placeholder="¥" class="w-16 h-8 px-2 bg-mist/70 border border-ink/20 font-num text-xs outline-none focus:border-celadon" />
            </div>
            <button class="w-full h-8 bg-cinnabar text-mist font-cn text-xs hover:bg-cinnabarDeep" @click="addExp">记一笔 · 第{{ activeDay }}天</button>
          </div>
          <div class="flex-1 overflow-y-auto drawer-scroll p-3 space-y-1">
            <div v-for="e in guide.expenses" :key="e.id" class="flex items-center gap-2 py-1.5 border-b border-ink/10">
              <div class="flex-1 min-w-0">
                <div class="font-cn text-xs text-ink truncate">{{ e.title }}</div>
                <div class="font-cn text-[10px] text-inkLight">第{{ e.dayIndex }}天</div>
              </div>
              <span class="font-num text-xs text-cinnabar">¥{{ e.amount }}</span>
              <button class="text-inkLight/50 hover:text-cinnabar" @click="guideStore.removeExpense(e.id)"><Trash2 :size="12" /></button>
            </div>
            <div v-if="!guide.expenses.length" class="text-center py-8 font-cn text-[11px] text-inkLight">还没有记账</div>
          </div>
        </div>
      </aside>

      <!-- 中：城市地图 -->
      <main class="flex-1 relative min-w-0">
        <CityMap :guide="guide" :active-day="activeDay" :selected-node-id="selectedNodeId" @select-node="(id: string)=> selectedNodeId = selectedNodeId === id ? null : id" />

        <!-- 移动端浮动按钮 -->
        <div class="lg:hidden absolute left-3 bottom-4 flex flex-col gap-2 z-20">
          <button class="w-11 h-11 seal rounded-full shadow-seal flex items-center justify-center" @click="mobilePanel = 'poi'" title="景点库">
            <Landmark :size="18" />
          </button>
          <button class="w-11 h-11 bg-mist border border-cinnabar text-cinnabar rounded-full shadow-paper flex items-center justify-center" @click="mobilePanel = 'itinerary'" title="行程">
            <ListOrdered :size="18" />
          </button>
        </div>

        <!-- 选中节点浮层 -->
        <Transition name="fade">
          <div v-if="selectedNode" class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 paper-card px-3.5 py-2 flex items-center gap-3 max-w-[92%]">
            <span class="seal w-6 h-6 text-[11px] shrink-0">{{ selectedNode.category === 'food' ? '食' : selectedNode.category === 'hotel' ? '宿' : '景' }}</span>
            <div class="min-w-0">
              <div class="font-cn text-sm text-ink truncate">{{ selectedNode.name }}</div>
              <div class="font-cn text-[10px] text-inkLight truncate">{{ selectedNode.address }}</div>
            </div>
            <button
              class="btn-seal shrink-0 flex items-center gap-1 h-8 px-2.5 bg-cinnabar text-mist font-cn text-[11px] hover:bg-cinnabarDeep"
              @click="navigate(selectedNode)"
            >
              <Navigation :size="12" /> 导航
            </button>
            <button class="text-inkLight hover:text-cinnabar shrink-0" @click="selectedNodeId = null"><X :size="14" /></button>
          </div>
        </Transition>
      </main>

      <!-- 右：行程编辑 -->
      <aside
        class="flex-col paper-texture border-l border-ink/20 md:z-40 md:static md:flex md:w-[360px] md:shrink-0"
        :class="mobilePanel === 'itinerary' ? 'flex fixed inset-y-0 right-0 w-[90%] max-w-[380px] shadow-drawer z-[60]' : 'hidden'"
      >
        <div class="shrink-0 p-3 border-b border-ink/15">
          <div class="flex items-center gap-1.5">
            <div class="flex-1 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
              <button v-for="d in guide.days" :key="d.dayIndex"
                class="shrink-0 px-3 h-8 font-cn text-xs border transition-all"
                :class="activeDay === d.dayIndex ? 'bg-cinnabar text-mist border-cinnabar' : 'bg-mist/60 text-inkLight border-ink/20 hover:border-celadon'"
                @click="activeDay = d.dayIndex">第{{ d.dayIndex }}天</button>
              <button class="shrink-0 w-8 h-8 flex items-center justify-center border border-dashed border-celadon text-celadonDeep hover:bg-celadon/10" @click="addDay" title="增加一天"><Plus :size="14" /></button>
            </div>
            <button class="md:hidden w-8 h-8 flex items-center justify-center text-inkLight" @click="mobilePanel = null"><X :size="16" /></button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto drawer-scroll p-3">
          <div v-if="currentDay && currentDay.nodes.length === 0" class="text-center py-10">
            <p class="font-brush text-base text-ink/60">第{{ activeDay }}天还是空白</p>
            <p class="font-cn text-[11px] text-inkLight mt-1">从景点库点选加入</p>
          </div>

          <div v-else-if="currentDay">
            <template v-for="(node, i) in currentDay.nodes" :key="node.id">
              <div class="paper-card p-2.5">
                <div class="flex items-start gap-2">
                  <span class="shrink-0 w-6 h-6 rounded-full bg-cinnabar/90 text-mist font-num text-[11px] flex items-center justify-center mt-0.5">{{ i + 1 }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-cn text-xs text-ink truncate">{{ node.shortName }}</div>
                    <div class="font-cn text-[10px] text-inkLight truncate mt-0.5">{{ node.address }}</div>
                    <button
                      class="mt-1 inline-flex items-center gap-0.5 font-cn text-[10px] text-cinnabar border border-cinnabar/40 px-1.5 py-0.5 hover:bg-cinnabar/10 transition-colors"
                      @click.stop="navigate(node)"
                    >
                      <Navigation :size="9" /> 导航前往
                    </button>
                  </div>
                  <div class="flex flex-col shrink-0">
                    <button class="text-inkLight/60 hover:text-ink p-0.5" :class="i===0?'opacity-30':''" :disabled="i===0" @click="guideStore.moveNode(activeDay, node.id, -1)"><ArrowUp :size="12" /></button>
                    <button class="text-inkLight/60 hover:text-cinnabar p-0.5" @click="guideStore.removeNode(activeDay, node.id)"><Trash2 :size="12" /></button>
                    <button class="text-inkLight/60 hover:text-ink p-0.5" :class="i===currentDay.nodes.length-1?'opacity-30':''" :disabled="i===currentDay.nodes.length-1" @click="guideStore.moveNode(activeDay, node.id, 1)"><ArrowDown :size="12" /></button>
                  </div>
                </div>
              </div>

              <!-- 交通段 -->
              <div v-if="i < currentDay.nodes.length - 1" class="relative py-1.5 pl-3">
                <div class="absolute left-[15px] top-0 bottom-0 w-px opacity-50" :style="{ background: MODE_COLOR[currentDay.legs[i]?.mode || 'drive'] }"></div>
                <button class="relative flex items-center gap-1.5 px-2 py-1 border bg-mist/90 hover:bg-mist transition-colors"
                  :style="{ borderColor: MODE_COLOR[currentDay.legs[i]?.mode || 'drive'] }"
                  @click="editingLegId = editingLegId === currentDay.legs[i]?.id ? null : currentDay.legs[i]?.id">
                  <span class="font-cn text-[11px]" :style="{ color: MODE_COLOR[currentDay.legs[i]?.mode || 'drive'] }">
                    {{ MODE_LIST.find(m => m.key === currentDay?.legs[i]?.mode)?.label || '打车' }}
                  </span>
                  <span class="font-num text-[10px] text-inkLight flex items-center gap-0.5"><Clock :size="9" />{{ currentDay.legs[i]?.durationMin }}分</span>
                  <span v-if="currentDay.legs[i]?.cost" class="font-num text-[9px] text-ochreDeep">¥{{ currentDay.legs[i]?.cost }}</span>
                  <span class="font-num text-[9px] text-inkLight">{{ currentDay.legs[i]?.distanceKm }}km</span>
                </button>
                <Transition name="fade">
                  <div v-if="currentDay.legs[i] && editingLegId === currentDay.legs[i].id" class="mt-1.5 flex flex-wrap gap-1 p-1.5 paper-card">
                    <button v-for="m in MODE_LIST" :key="m.key" class="px-2 py-1 font-cn text-[11px] border transition-colors"
                      :style="currentDay.legs[i].mode === m.key ? { background: MODE_COLOR[m.key], color: '#FAF6ED', borderColor: MODE_COLOR[m.key] } : { color: MODE_COLOR[m.key], borderColor: MODE_COLOR[m.key] + '66' }"
                      @click="setMode(currentDay.legs[i].id, m.key)">{{ m.label }}</button>
                  </div>
                </Transition>
              </div>
            </template>
          </div>
        </div>

        <div v-if="currentDay" class="shrink-0 border-t border-ink/15 p-3">
          <div class="flex items-center justify-between font-cn text-[11px] text-inkLight">
            <span>第{{ activeDay }}天 · {{ currentDay.nodes.length }} 处</span>
            <span class="font-num">交通 {{ currentDay.legs.reduce((s, l) => s + l.durationMin, 0) }} 分 · ¥{{ dayCost(currentDay) }}</span>
          </div>
        </div>
      </aside>
    </div>

    <!-- 移动端遮罩 -->
    <div v-if="mobilePanel" class="lg:hidden md:hidden fixed inset-0 bg-ink/25 z-[55]" @click="mobilePanel = null"></div>
  </div>

  <div v-else class="w-full h-full flex items-center justify-center">
    <p class="font-brush text-xl text-inkLight">请先选择一座城市</p>
  </div>
</template>
