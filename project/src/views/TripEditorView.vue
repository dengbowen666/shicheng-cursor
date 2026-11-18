<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Archive, ChevronDown, ChevronUp, Download, Eye, Heart, ListChecks,
  Map as MapIcon, PenLine, Play, ReceiptText, Route as RouteIcon, Settings2,
  Sparkles, SunMedium, Trash2, Undo2, Utensils, BedDouble, Landmark, X,
} from 'lucide-vue-next'
import AppHeader from '../components/layout/AppHeader.vue'
import DayRail from '../components/layout/DayRail.vue'
import FabGroup from '../components/layout/FabGroup.vue'
import LayerSeals from '../components/layout/LayerSeals.vue'
import MapCanvas from '../components/map/MapCanvas.vue'
import PoiSearch from '../components/editor/PoiSearch.vue'
import DayPanel from '../components/editor/DayPanel.vue'
import SmartAssist from '../components/editor/SmartAssist.vue'
import SegmentPicker from '../components/editor/SegmentPicker.vue'
import WishlistPanel from '../components/layout/WishlistPanel.vue'
import PlaceCard from '../components/panels/PlaceCard.vue'
import ItineraryDrawer from '../components/panels/ItineraryDrawer.vue'
import TodayView from '../components/panels/TodayView.vue'
import RolloutReplay from '../components/panels/RolloutReplay.vue'
import ExportModal from '../components/overlay/ExportModal.vue'
import SettingsModal from '../components/overlay/SettingsModal.vue'
import KeyGuideModal from '../components/overlay/KeyGuideModal.vue'
import { useTripStore } from '../stores/trip'
import { useUiStore } from '../stores/ui'
import { useWeatherStore } from '../stores/weather'
import { useCityStore } from '../stores/city'
import type { LngLat, POI, POICategory } from '../types'

// 图表类面板按需加载，避免编辑器首屏携带完整 ECharts
const ExpenseDrawer = defineAsyncComponent(() => import('../components/panels/ExpenseDrawer.vue'))
const ReviewView = defineAsyncComponent(() => import('../components/panels/ReviewView.vue'))

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()
const trip = useTripStore()
const ui = useUiStore()
const weatherStore = useWeatherStore()
const cityStore = useCityStore()

const mapRef = ref<InstanceType<typeof MapCanvas> | null>(null)
const showReview = ref(false)
const customLocation = ref<LngLat | null>(null)
const customForm = ref({ name: '', category: 'custom' as POICategory, address: '', note: '' })

const activeTrip = computed(() => trip.activeTrip || trip.findTrip(props.id))
const dayIndex = computed(() => {
  const max = activeTrip.value?.days.length || 1
  return Math.min(Math.max(1, ui.activeDayIndex), max)
})
const day = computed(() => activeTrip.value?.days.find(d => d.dayIndex === dayIndex.value) || activeTrip.value?.days[0])
const currentCity = computed(() => day.value?.city || activeTrip.value?.cities[0]?.name || '')
const currentWeather = computed(() => {
  if (!currentCity.value) return undefined
  return weatherStore.forDate(currentCity.value, day.value?.date)
})
const selectedPoi = computed(() => {
  const id = ui.selectedPoiId
  return id && activeTrip.value ? activeTrip.value.pois[id] || null : null
})
const selectedSegment = computed(() => {
  const id = ui.selectedSegmentId
  return id && activeTrip.value ? activeTrip.value.segments[id] || null : null
})
const isFinished = computed(() => !!activeTrip.value && (activeTrip.value.archived || !!activeTrip.value.completedAt))
const sheetHeight = computed(() => ui.sheet === 'peek' ? 'h-[76px]' : ui.sheet === 'half' ? 'h-[45vh]' : 'h-[92vh]')

async function syncWeather() {
  if (!activeTrip.value) return
  await Promise.all(activeTrip.value.cities.map(c => weatherStore.loadCity(c.name, c.center)))
}

function onKeyEsc(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (ui.annotateMode) { ui.annotateMode = false; return }
  if (ui.modal) { ui.closeModal(); return }
  if (ui.selectedPoiId) { ui.selectedPoiId = null; return }
  if (showReview.value) { showReview.value = false; return }
  if (ui.replaying) { ui.replaying = false; return }
  if (ui.drawer) ui.closeDrawer()
}

onMounted(async () => {
  if (trip.activeTripId !== props.id && trip.findTrip(props.id)) trip.openTrip(props.id)
  await syncWeather()
  void trip.refineTrip()
  if (route.query.view === 'today') { ui.openDrawer('today'); ui.sheet = 'half' }
  if (route.query.review === '1') showReview.value = true
  // 朱笔批注随攻略持久化：挂载后尝试还原
  requestAnimationFrame(() => restoreAnnotations())
  window.addEventListener('keydown', onKeyEsc)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyEsc))

watch(() => props.id, async id => {
  if (trip.activeTripId !== id && trip.findTrip(id)) trip.openTrip(id)
  await syncWeather()
})
watch(() => activeTrip.value?.cities.map(c => c.name).join('|'), syncWeather)
// 切换日期或有新段落地时，补取真实路线（已取到的段会标记 estimated=false 自动跳过）
watch(dayIndex, d => { void trip.refineDay(d) })

function editTitle() {
  if (!activeTrip.value) return
  const next = window.prompt('攻略题名', activeTrip.value.title)
  if (next?.trim()) trip.updateTrip(activeTrip.value.id, { title: next.trim() })
}
function onSelectPoi(id: string) { ui.selectedPoiId = id; ui.selectedSegmentId = null }
function onPickPoi(poi: POI) {
  trip.addPoi(poi)
  onSelectPoi(poi.id)
}
function onSearchPoi(poi: POI) {
  if (!activeTrip.value) return
  const existed = trip.inDays(poi.id)
  if (existed.includes(dayIndex.value)) {
    trip.addPoi(poi)
    onSelectPoi(poi.id)
    ui.toast(`已在第 ${dayIndex.value} 日`)
    return
  }
  const res = trip.addToDay(poi, dayIndex.value)
  onSelectPoi(poi.id)
  if (res.ok) ui.toast(`已加入第 ${dayIndex.value} 日 · ${poi.name}`)
}
function onSelectSegment(id: string) {
  ui.selectedSegmentId = id
  ui.selectedPoiId = null
  ui.openModal('route')
}
async function onMapClick(location: LngLat) {
  customLocation.value = location
  customForm.value = { name: '', category: 'custom', address: '', note: '' }
  if (ui.mapKey) customForm.value.address = await cityStore.addressOf(location, ui.mapKey)
  ui.openModal('customPoi')
}
function saveCustomPoi() {
  if (!customLocation.value || !customForm.value.name.trim() || !activeTrip.value) return
  const poi = trip.addCustomPoi({
    name: customForm.value.name.trim(),
    category: customForm.value.category,
    city: currentCity.value,
    location: customLocation.value,
    address: customForm.value.address,
    note: customForm.value.note,
  })
  ui.toast('已落入心愿池，可分日加入行程')
  ui.closeModal()
  ui.selectedPoiId = poi.id
}
function onStroke(points: LngLat[]) {
  if (!activeTrip.value) return
  trip.addAnnotation({
    points,
    screenPoints: points.map(p => ({ x: p.lng, y: p.lat })),
    viewCenter: activeTrip.value.cities.find(c => c.name === currentCity.value)?.center,
  })
  ui.toast('朱笔已留痕')
}
function undoStroke() {
  trip.undoAnnotation()
  mapRef.value?.undoAnnotation?.()
}
function clearStrokes() {
  trip.clearAnnotations()
  mapRef.value?.clearAnnotations?.()
}
function restoreAnnotations() {
  const strokes = activeTrip.value?.annotations || []
  if (!strokes.length) return
  // screenPoints 在落笔时被写成 lng/lat 占位；优先还原地理点经 MapCanvas 再投影不稳，先用已存 screenPoints 形状
  const pts = strokes.map(s => (s.screenPoints || []).map(p => ({ x: p.x, y: p.y })))
  if (pts.some(p => p.length > 1)) mapRef.value?.redrawAnnotations?.(pts)
}
function archiveCurrent() {
  if (!activeTrip.value) return
  trip.archiveTrip(activeTrip.value.id, true)
  ui.toast('已归入已行卷', '撤销', () => trip.undo())
  router.push('/')
}
function cycleSheet() {
  ui.sheet = ui.sheet === 'peek' ? 'half' : ui.sheet === 'half' ? 'full' : 'peek'
}

/** 移动端 bottom sheet 拖拽切换三档 */
const sheetDrag = ref<{ y: number; start: SheetSize } | null>(null)
type SheetSize = 'peek' | 'half' | 'full'
function onSheetPointerDown(e: PointerEvent) {
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture?.(e.pointerId)
  sheetDrag.value = { y: e.clientY, start: ui.sheet }
}
function onSheetPointerMove(e: PointerEvent) {
  if (!sheetDrag.value) return
  const dy = sheetDrag.value.y - e.clientY
  if (dy > 48) ui.sheet = sheetDrag.value.start === 'peek' ? 'half' : 'full'
  else if (dy < -48) ui.sheet = sheetDrag.value.start === 'full' ? 'half' : 'peek'
}
function onSheetPointerUp() { sheetDrag.value = null }

function openMapDrawer(kind: 'itinerary' | 'expense' | 'today' | 'wishlist') {
  ui.openDrawer(kind)
}
</script>

<template>
  <div v-if="activeTrip" class="editor-shell relative w-full h-full flex flex-col overflow-hidden paper-texture">
    <AppHeader :trip="activeTrip" @edit="editTitle" />

    <div class="flex-1 min-h-0 flex">
      <!-- 桌面左工作台：搜索、日签、当日行程、智能建议，全部在布局内 -->
      <aside class="hidden lg:flex w-[388px] shrink-0 flex-col studio-panel">
        <div class="px-3 pt-3 pb-2.5 border-b border-ink/15 shrink-0">
          <PoiSearch :city="currentCity" @select="onSearchPoi" @custom-request="onMapClick" />
        </div>
        <div class="flex-1 min-h-0 flex flex-col">
          <DayRail />
          <DayPanel class="flex-1 min-h-0" :day-index="dayIndex" @select-poi="onSelectPoi" @select-segment="onSelectSegment" />
          <SmartAssist class="max-h-[188px] overflow-y-auto border-t border-ink/15 shrink-0" :day-index="dayIndex" />
        </div>
      </aside>

      <!-- 中央地图舞台 -->
      <main class="flex-1 min-w-0 flex flex-col relative">
        <!-- 桌面地图工具条：不压地图 -->
        <div class="hidden lg:flex h-11 shrink-0 items-center gap-2 px-3 map-toolbar">
          <span class="font-cn text-[9px] tracking-[0.32em] text-inkLight">第 {{ dayIndex }} 日</span>
          <span class="w-px h-3.5 bg-ink/20"></span>
          <span class="font-brush text-[15px] text-ink/80">{{ day?.city }}</span>
          <span class="font-cn text-[10px] text-inkLight/70">· {{ day?.title }}</span>

          <div class="ml-auto flex items-center gap-0.5 min-w-0 overflow-x-auto hide-scrollbar">
            <button class="map-action" :class="ui.viewMode === 'all' ? 'is-active' : ''" @click="ui.viewMode = ui.viewMode === 'day' ? 'all' : 'day'">
              <MapIcon :size="13" /> {{ ui.viewMode === 'day' ? '全程全览' : '聚焦当日' }}
            </button>
            <button class="map-action" :class="ui.layers.sight ? 'is-active' : ''" title="景点层" @click="ui.toggleLayer('sight')">
              <Landmark :size="13" /> 景
            </button>
            <button class="map-action" :class="ui.layers.food ? 'is-active' : ''" title="美食层" @click="ui.toggleLayer('food')">
              <Utensils :size="13" /> 食
            </button>
            <button class="map-action" :class="ui.layers.hotel ? 'is-active' : ''" title="住宿层" @click="ui.toggleLayer('hotel')">
              <BedDouble :size="13" /> 宿
            </button>
            <button class="map-action" :class="ui.drawer === 'itinerary' ? 'is-active' : ''" @click="openMapDrawer('itinerary')">
              <ListChecks :size="13" /> 时间轴
            </button>
            <button class="map-action" :class="ui.drawer === 'expense' ? 'is-active' : ''" @click="openMapDrawer('expense')">
              <ReceiptText :size="13" /> 记账
            </button>
            <button class="map-action" :class="ui.drawer === 'wishlist' ? 'is-active' : ''" @click="openMapDrawer('wishlist')"><Heart :size="13" /> 心愿池</button>
            <button class="map-action" @click="showReview = true"><Eye :size="13" /> 忆游</button>
            <button class="map-action" @click="ui.replaying = true"><Play :size="13" /> 回放</button>
            <button v-if="!isFinished" class="map-action" @click="archiveCurrent"><Archive :size="13" /> 归档</button>
            <button class="map-action" @click="ui.openModal('export')"><Download :size="13" /> 导出</button>
            <button class="map-action w-9 px-0 justify-center" title="设置" @click="ui.openModal('settings')"><Settings2 :size="14" /></button>
          </div>
        </div>

        <!-- 移动端：换日轨道 + 搜索 -->
        <div class="lg:hidden shrink-0 border-b border-ink/15 bg-paper/95">
          <DayRail />
          <div class="px-3 py-2">
            <PoiSearch :city="currentCity" @select="onSearchPoi" @custom-request="onMapClick" />
          </div>
        </div>

        <!-- 地图本体 -->
        <div class="relative flex-1 min-h-0 map-stage">
          <MapCanvas
            ref="mapRef"
            class="absolute inset-0"
            :trip="activeTrip"
            :day-index="dayIndex"
            :view-mode="ui.viewMode"
            :layers="ui.layers"
            :annotate-mode="ui.annotateMode"
            :selected-poi-id="ui.selectedPoiId"
            :weather="currentWeather"
            :city="currentCity"
            :map-key="ui.mapKey"
            :base-map="ui.settings.baseMap"
            @select-poi="onSelectPoi"
            @pick-poi="onPickPoi"
            @select-segment="onSelectSegment"
            @map-click="onMapClick"
            @add-stroke="onStroke"
          />

          <!-- 地图上的竖排城市题签 -->
          <div class="hidden lg:flex pointer-events-none absolute left-4 top-4 z-10 flex-col items-center gap-2">
            <span class="vertical-text font-brush text-[24px] leading-none text-ink/40 tracking-[0.3em]">{{ currentCity }}</span>
            <span class="w-px h-10 bg-gradient-to-b from-ink/30 to-transparent"></span>
            <span class="vertical-text font-cn text-[8px] tracking-[0.35em] text-inkLight/70">实地舆图</span>
          </div>

          <!-- 图例 + 图层篆印 -->
          <div class="hidden lg:flex pointer-events-none absolute left-4 bottom-10 z-10 items-end gap-4">
            <div class="flex items-center gap-3 font-cn text-[9px] tracking-wider text-inkLight/80">
              <span class="inline-flex items-center gap-1"><i class="w-1.5 h-1.5 bg-cinnabar"></i>景点</span>
              <span class="inline-flex items-center gap-1"><i class="w-1.5 h-1.5 bg-ochreDeep"></i>食宿</span>
              <span class="inline-flex items-center gap-1"><i class="w-1.5 h-1.5 bg-celadonDeep"></i>路线</span>
            </div>
            <div class="pointer-events-auto">
              <LayerSeals />
            </div>
          </div>

          <!-- 桌面朱笔快捷 -->
          <button
            v-if="!ui.annotateMode"
            type="button"
            class="hidden lg:flex absolute right-4 bottom-10 z-10 h-9 px-3 paper-card items-center gap-1.5 font-cn text-[11px] text-inkLight hover:text-cinnabar"
            @click="ui.annotateMode = true"
          >
            <PenLine :size="13" /> 朱笔
          </button>

          <!-- 移动端动作钮，落在地图舞台内，不会压住底部抽屉 -->
          <FabGroup class="lg:hidden" :trip-id="activeTrip.id" />
          <div class="lg:hidden absolute left-3 bottom-4 z-20 pointer-events-auto">
            <LayerSeals />
          </div>
        </div>

        <!-- 移动端底部抽屉：参与 flex 布局，地图自动让位 -->
        <div class="lg:hidden shrink-0 border-t border-ink/20 bg-paper/98 shadow-[0_-10px_30px_-20px_rgba(38,35,31,.55)] transition-[height] duration-300 ease-out" :class="sheetHeight" :data-sheet="ui.sheet">
          <button
            class="w-full h-7 flex items-center justify-center text-inkLight/50 touch-none"
            @click="cycleSheet"
            @pointerdown="onSheetPointerDown"
            @pointermove="onSheetPointerMove"
            @pointerup="onSheetPointerUp"
            @pointercancel="onSheetPointerUp"
          >
            <ChevronUp v-if="ui.sheet !== 'full'" :size="15" />
            <ChevronDown v-else :size="15" />
          </button>
          <div class="flex border-y border-ink/12">
            <button v-for="tab in [
              { key: 'itinerary', label: '日程', icon: ListChecks },
              { key: 'today', label: '今天', icon: SunMedium },
              { key: 'expense', label: '记账', icon: ReceiptText },
              { key: 'wishlist', label: '心愿池', icon: Heart },
              { key: 'assist', label: '智助', icon: Sparkles },
              { key: 'route', label: '交通', icon: RouteIcon },
            ]" :key="tab.key"
              class="flex-1 h-11 flex flex-col items-center justify-center gap-0.5 font-cn text-[10px]"
              :class="ui.drawer === tab.key ? 'text-cinnabar bg-cinnabar/5 border-b-2 border-cinnabar' : 'text-inkLight'"
              @click="ui.openDrawer(tab.key); ui.sheet = 'half'"
            >
              <component :is="tab.icon" :size="15" /> {{ tab.label }}
            </button>
          </div>
          <div v-if="ui.sheet !== 'peek'" class="h-[calc(100%-72px)] overflow-y-auto drawer-scroll p-3">
            <DayPanel v-if="ui.drawer === 'itinerary'" :day-index="dayIndex" @select-poi="onSelectPoi" @select-segment="onSelectSegment" />
            <TodayView v-else-if="ui.drawer === 'today'" :day-index="dayIndex" @close="ui.closeDrawer()" />
            <ExpenseDrawer v-else-if="ui.drawer === 'expense'" :day-index="dayIndex" @close="ui.closeDrawer()" />
            <WishlistPanel v-else-if="ui.drawer === 'wishlist'" @close="ui.closeDrawer()" />
            <SmartAssist v-else-if="ui.drawer === 'assist'" :day-index="dayIndex" />
            <div v-else-if="ui.drawer === 'route'" class="space-y-2">
              <button v-for="sid in (day?.segmentIds || [])" :key="sid" class="w-full paper-card p-3 text-left font-cn text-xs text-ink" @click="onSelectSegment(sid)">
                {{ `${activeTrip.pois[activeTrip.segments[sid]?.fromPoiId]?.name || ''} → ${activeTrip.pois[activeTrip.segments[sid]?.toPoiId]?.name || ''}` }}
              </button>
              <p v-if="!day?.segmentIds?.length" class="text-center font-cn text-[11px] text-inkLight py-6">本日尚无交通段，先加入两处地点</p>
            </div>
            <div v-else class="text-center font-cn text-xs text-inkLight py-8">选择上方页签展开卷轴</div>
          </div>
        </div>
      </main>

      <!-- 桌面右 inspector：参与布局，打开时地图自动变窄，不覆盖 -->
      <Transition name="slide">
        <aside v-if="ui.drawer" class="hidden lg:flex w-[360px] shrink-0 relative flex-col inspector-panel">
          <div class="relative flex-1 min-h-0">
            <ItineraryDrawer v-if="ui.drawer === 'itinerary'" :day-index="dayIndex" @close="ui.closeDrawer()" />
            <ExpenseDrawer v-else-if="ui.drawer === 'expense'" :day-index="dayIndex" @close="ui.closeDrawer()" />
            <TodayView v-else-if="ui.drawer === 'today'" :day-index="dayIndex" @close="ui.closeDrawer()" />
            <WishlistPanel v-else-if="ui.drawer === 'wishlist'" @close="ui.closeDrawer()" />
          </div>
        </aside>
      </Transition>
    </div>

    <!-- 地点卡片 -->
    <Transition name="fade">
      <div
        v-if="selectedPoi"
        class="absolute inset-0 z-50 bg-ink/30 flex items-center justify-center p-4"
        @click.self="ui.selectedPoiId = null"
      >
        <div class="w-[min(94vw,420px)] max-h-[88vh] overflow-y-auto" @click.stop>
          <PlaceCard :poi="selectedPoi" :day-index="dayIndex" @close="ui.selectedPoiId = null" />
        </div>
      </div>
    </Transition>

    <!-- 朱笔工具条 -->
    <div v-if="ui.annotateMode" class="absolute left-1/2 -translate-x-1/2 bottom-4 z-30 paper-card px-3 py-2 flex items-center gap-2">
      <PenLine :size="15" class="text-cinnabar" />
      <span class="font-cn text-xs text-ink">朱笔批注</span>
      <button class="font-cn text-[11px] text-inkLight hover:text-cinnabar flex items-center gap-1" @click="undoStroke"><Undo2 :size="12" /> 撤销</button>
      <button class="font-cn text-[11px] text-inkLight hover:text-cinnabar flex items-center gap-1" @click="clearStrokes"><Trash2 :size="12" /> 清空</button>
      <button class="font-cn text-[11px] text-cinnabar border border-cinnabar/40 px-2 py-0.5" @click="ui.annotateMode = false">完成</button>
    </div>

    <!-- 弹层 -->
    <div v-if="selectedSegment && ui.modal === 'route'" class="fixed inset-0 z-[200] flex items-center justify-center bg-ink/35 p-4" @click.self="ui.closeModal()">
      <SegmentPicker :segment="selectedSegment" @choose="mode => { trip.setSegmentMode(dayIndex, selectedSegment!.id, mode); ui.closeModal(); ui.toast('交通方式已更新，地图与时刻已重算') }" @close="ui.closeModal()" />
    </div>

    <div v-if="ui.modal === 'customPoi'" class="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 p-4" @click.self="ui.closeModal()">
      <div class="paper-card w-full max-w-[420px] p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-brush text-lg text-ink">落一枚新印</h3>
          <button class="text-inkLight" @click="ui.closeModal()"><X :size="17" /></button>
        </div>
        <input v-model="customForm.name" placeholder="地点名称（必填）" class="w-full h-10 px-3 bg-mist border border-ochre/40 font-cn text-sm outline-none focus:border-celadon" />
        <input v-model="customForm.address" placeholder="地址（选填）" class="w-full h-10 px-3 bg-mist border border-ochre/40 font-cn text-sm outline-none focus:border-celadon" />
        <div class="flex gap-1.5">
          <button v-for="c in [{ k: 'custom', l: '自' }, { k: 'sight', l: '景' }, { k: 'food', l: '食' }, { k: 'hotel', l: '宿' }]" :key="c.k"
            class="flex-1 h-8 border font-cn text-xs"
            :class="customForm.category === c.k ? 'bg-cinnabar text-mist border-cinnabar' : 'border-ink/25 text-inkLight'"
            @click="customForm.category = c.k as POICategory">{{ c.l }}</button>
        </div>
        <textarea v-model="customForm.note" placeholder="题跋一句（选填）" rows="2" class="w-full p-2 bg-mist border border-ochre/40 font-cn text-xs outline-none resize-none"></textarea>
        <button class="w-full h-10 bg-cinnabar text-mist font-cn text-sm" @click="saveCustomPoi">落点并收入心愿池</button>
      </div>
    </div>

    <ExportModal v-if="ui.modal === 'export' && activeTrip" :trip="activeTrip" @close="ui.closeModal()" />
    <SettingsModal v-if="ui.modal === 'settings'" @close="ui.closeModal()" />
    <KeyGuideModal v-if="ui.modal === 'keyGuide'" @close="ui.closeModal()" />
    <ReviewView v-if="showReview && activeTrip" :trip="activeTrip" @close="showReview = false" />
    <RolloutReplay v-if="ui.replaying && activeTrip" :trip="activeTrip" @close="ui.replaying = false" />
  </div>

  <div v-else class="w-full h-full flex flex-col items-center justify-center gap-4 paper-texture">
    <div class="seal w-16 h-16 text-lg">拾程</div>
    <p class="font-brush text-xl text-ink/70">这份攻略不在本机</p>
    <button class="h-10 px-6 bg-cinnabar text-mist font-cn text-sm" @click="router.push('/')">回到我的攻略</button>
  </div>
</template>
