<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUIStore } from '../stores/ui'
import { useGuideStore } from '../stores/guides'
import ChinaMap from '../components/map/ChinaMap.vue'
import CityCover from '../components/overlay/CityCover.vue'
import { PRESET_CITIES, citiesByProvince, PROVINCE_SHORT } from '../mock/cities'
import { cityCover, hasCityData } from '../mock/city-pois'
import { Search, ChevronLeft, MapPin, Compass, ArrowRight, X } from 'lucide-vue-next'
import type { CityEntry } from '../types'

const uiStore = useUIStore()
const guideStore = useGuideStore()

const provinceSelected = ref<string | null>(null)
const keyword = ref('')

const provinceShort = computed(() => provinceSelected.value ? (PROVINCE_SHORT[provinceSelected.value] || provinceSelected.value) : '')
const provinceCities = computed<CityEntry[]>(() => provinceSelected.value ? citiesByProvince(provinceSelected.value) : [])

const searchResults = computed<CityEntry[]>(() => {
  const kw = keyword.value.trim()
  if (!kw) return []
  return PRESET_CITIES.filter(c => c.name.includes(kw) || c.province.includes(kw))
})

function onSelectProvince(name: string) {
  provinceSelected.value = name
  keyword.value = ''
}
function backToChina() {
  provinceSelected.value = null
}
function enterCity(city: CityEntry) {
  const existing = guideStore.findByCity(city.name)
  if (existing) guideStore.openGuide(existing.id)
  else guideStore.createGuide({ cityName: city.name, province: city.province, center: city.center, coverImage: cityCover(city.name) })
  provinceSelected.value = null
  keyword.value = ''
  uiStore.gotoGuide()
}

const hotCities = PRESET_CITIES.slice(0, 10)
</script>

<template>
  <div class="relative w-full h-full overflow-hidden flex flex-col md:block" style="background: radial-gradient(circle at 50% 42%, #F8F2E4 0%, #EADFC8 100%)">
    <!-- 中国地图：桌面铺满全屏，移动端让出顶部标题栏的高度 -->
    <div class="relative shrink-0 h-[40vh] md:absolute md:inset-0 md:h-full order-2 md:order-none">
      <ChinaMap :focus-province="provinceSelected" @select-province="onSelectProvince" />
    </div>

    <!-- 顶部标题 + 搜索（移动端在文档流内，桌面端浮在地图上） -->
    <div class="relative md:absolute md:top-0 md:left-0 md:right-0 z-20 pointer-events-none order-1 md:order-none">
      <div class="flex items-start justify-between px-5 md:px-8 pt-5">
        <div class="pointer-events-auto">
          <div class="flex items-center gap-3">
            <div class="seal w-11 h-11 text-base flex-col animate-seal-in"><span>行</span><span>旅</span></div>
            <div>
              <h1 class="font-brush text-2xl md:text-3xl text-ink tracking-song">九州行旅图</h1>
              <p class="font-cn text-[11px] text-inkLight tracking-[0.3em] mt-0.5">一图在手 · 山河任行</p>
            </div>
          </div>
        </div>
        <div class="pointer-events-auto">
          <button class="h-10 px-4 paper-card flex items-center gap-2 text-inkLight hover:text-cinnabar font-cn text-sm" aria-label="我的攻略" @click="uiStore.gotoLibrary()">
            <Compass :size="16" :stroke-width="1.8" /> <span class="hidden sm:inline">我的攻略</span>
            <span v-if="guideStore.guides.length" class="seal text-[10px] px-1 py-0.5">{{ guideStore.guides.length }}</span>
          </button>
        </div>
      </div>

      <!-- 搜索 -->
      <div class="flex justify-center mt-4 px-5">
        <div class="pointer-events-auto w-full max-w-[460px] relative">
          <div class="flex items-center gap-2 h-11 px-4 bg-mist/90 border border-ink/25 shadow-paper backdrop-blur-sm">
            <Search :size="17" class="text-inkLight" />
            <input v-model="keyword" placeholder="搜索城市，如 成都、杭州、大理…" class="flex-1 bg-transparent outline-none font-cn text-sm text-ink placeholder:text-inkLight/60" />
            <button v-if="keyword" class="text-inkLight hover:text-cinnabar" @click="keyword = ''"><X :size="15" /></button>
          </div>
          <div v-if="keyword && searchResults.length" class="absolute top-12 left-0 right-0 paper-card shadow-paper max-h-[300px] overflow-y-auto z-30">
            <button v-for="c in searchResults" :key="c.name" class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-celadon/10 text-left border-b border-ink/5 last:border-0" @click="enterCity(c)">
              <MapPin :size="15" class="text-cinnabar shrink-0" />
              <div class="flex-1">
                <div class="font-cn text-sm text-ink">{{ c.name }}</div>
                <div class="font-cn text-[10px] text-inkLight">{{ c.province }}</div>
              </div>
              <span v-if="guideStore.findByCity(c.name)" class="font-cn text-[10px] text-celadonDeep border border-celadon px-1.5 py-0.5">已攻</span>
              <ArrowRight :size="14" class="text-inkLight" />
            </button>
          </div>
          <div v-else-if="keyword" class="absolute top-12 left-0 right-0 paper-card px-4 py-4 text-center font-cn text-xs text-inkLight z-30">
            暂未收录「{{ keyword }}」，可试试 成都 / 杭州 / 西安 / 大理
          </div>
        </div>
      </div>

      <!-- 热门城市（桌面置于顶部；移动端移入下方抽屉） -->
      <div v-if="!keyword && !provinceSelected" class="hidden md:flex justify-center mt-3 px-5">
        <div class="flex flex-wrap justify-center gap-2 max-w-[640px]">
          <button v-for="c in hotCities" :key="c.name" class="pointer-events-auto font-cn text-[11px] text-inkLight hover:text-cinnabar border border-ink/15 hover:border-cinnabar/50 px-2.5 py-1 bg-mist/70 transition-colors" @click="enterCity(c)">
            {{ c.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- 底部提示（仅桌面） -->
    <div v-if="!provinceSelected && !keyword" class="hidden md:block absolute bottom-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div class="font-cn text-[11px] text-inkLight/80 tracking-widest bg-mist/70 px-4 py-1.5 border border-ink/10">
        点击省份展开下钻 · 或直接搜索城市
      </div>
    </div>

    <!-- 移动端下半屏：近期攻略 + 热门去处，把留白变成可点内容 -->
    <section v-if="!provinceSelected" class="md:hidden flex-1 min-h-0 overflow-y-auto drawer-scroll paper-texture border-t border-ink/20 px-4 pt-3 pb-6 z-10 order-3">
      <div v-if="guideStore.guides.length" class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="w-1 h-3 bg-cinnabar"></span>
          <span class="font-cn text-[11px] tracking-[0.2em] text-inkLight">近来在手</span>
        </div>
        <button
          v-for="g in guideStore.guides.slice(0, 3)" :key="g.id"
          class="w-full paper-card flex items-center gap-3 p-2 mb-2 text-left"
          @click="guideStore.openGuide(g.id); uiStore.gotoGuide()"
        >
          <div class="relative w-12 h-12 shrink-0 overflow-hidden"><CityCover :city="g.cityName" /></div>
          <div class="flex-1 min-w-0">
            <div class="font-brush text-base text-ink truncate">{{ g.cityName }}</div>
            <div class="font-cn text-[10px] text-inkLight">{{ g.days.length }} 天 · {{ g.days.reduce((s, d) => s + d.nodes.length, 0) }} 处</div>
          </div>
          <ArrowRight :size="14" class="text-cinnabar shrink-0" />
        </button>
      </div>

      <div class="flex items-center gap-2 mb-2">
        <span class="w-1 h-3 bg-cinnabar"></span>
        <span class="font-cn text-[11px] tracking-[0.2em] text-inkLight">热门去处</span>
      </div>
      <div class="grid grid-cols-4 gap-2">
        <button v-for="c in hotCities" :key="c.name" class="py-2 font-cn text-[11px] text-inkLight border border-ink/15 bg-mist/70 active:bg-celadon/15" @click="enterCity(c)">
          {{ c.name }}
        </button>
      </div>
      <p class="font-cn text-[10px] text-inkLight/70 text-center mt-4">点地图省份可下钻择城</p>
      <p class="font-brush text-center text-inkLight/40 text-sm mt-7 tracking-[0.3em]">山河远阔 · 人间烟火</p>
    </section>

    <!-- 省份城市面板（右侧滑出） -->
    <Transition name="slide">
      <aside v-if="provinceSelected" class="absolute right-0 top-0 bottom-0 z-40 w-full sm:w-[420px] paper-texture border-l border-ink/25 shadow-drawer flex flex-col">
        <div class="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-ink/15">
          <button class="w-9 h-9 flex items-center justify-center paper-card text-inkLight hover:text-ink shrink-0" @click="backToChina">
            <ChevronLeft :size="18" />
          </button>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="seal w-6 h-6 text-[11px]">{{ provinceShort.slice(0,1) }}</span>
              <h2 class="font-brush text-xl text-ink truncate">{{ provinceShort }} · 择一城而游</h2>
            </div>
            <p class="font-cn text-[10px] text-inkLight mt-0.5 tracking-widest">{{ provinceSelected }}</p>
          </div>
          <button class="w-8 h-8 flex items-center justify-center text-inkLight hover:text-cinnabar shrink-0" @click="backToChina"><X :size="17" /></button>
        </div>

        <div class="flex-1 overflow-y-auto drawer-scroll p-4">
          <div v-if="provinceCities.length" class="space-y-3">
            <button v-for="c in provinceCities" :key="c.name" class="paper-card overflow-hidden text-left w-full group btn-seal" @click="enterCity(c)">
              <div class="relative h-32 overflow-hidden">
                <CityCover :city="c.name" class="group-hover:scale-105 transition-transform duration-500" />
                <div class="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent"></div>
                <div class="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink/85 via-ink/45 to-transparent"></div>
                <div class="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
                  <div>
                    <h3 class="font-brush text-2xl text-mist drop-shadow">{{ c.name }}</h3>
                    <p class="font-cn text-[10px] text-mist/80">{{ hasCityData(c.name) ? '含重点景区' : '可自定义地点' }}</p>
                  </div>
                  <span v-if="guideStore.findByCity(c.name)" class="seal text-[10px] px-1.5 py-0.5 mb-1">已攻</span>
                </div>
              </div>
              <div class="px-3 py-2 flex items-center justify-between">
                <span class="font-cn text-[11px] text-inkLight">{{ guideStore.findByCity(c.name) ? '继续编辑' : '开始做攻略' }}</span>
                <ArrowRight :size="14" class="text-cinnabar group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>
          <div v-else class="text-center py-14">
            <p class="font-brush text-base text-inkLight">此省暂未收录城市</p>
            <p class="font-cn text-[11px] text-inkLight mt-2">可用顶部搜索框直接搜索城市</p>
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>
