<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCityStore } from '../../stores/city'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import type { City } from '../../types'
import { X, Search, Minus, Plus, MapPin, Sparkles, PenLine, ArrowRight } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ open: boolean; initialCity?: City | null }>(), { initialCity: null })
const emit = defineEmits<{
  close: []
  created: [tripId: string]
}>()

const router = useRouter()
const cityStore = useCityStore()
const trip = useTripStore()
const ui = useUiStore()

const SEALS = ['远游', '拾光', '行脚', '且停']
const HOT_NAMES = ['大理', '丽江', '北京', '成都', '杭州', '西安', '桂林', '厦门']

const keyword = ref('')
const selectedCity = ref<City | null>(null)
const days = ref(3)
const budget = ref<number | undefined>(undefined)
const sealText = ref(SEALS[Math.floor(Math.random() * SEALS.length)])
const title = ref('')
const titleTouched = ref(false)

const hotCities = computed(() => cityStore.cities.filter(c => HOT_NAMES.includes(c.name)))
const cityResults = computed(() => cityStore.searchCities(keyword.value).slice(0, 12))

function autoTitle() {
  if (titleTouched.value) return
  title.value = selectedCity.value ? `${selectedCity.value.name} · ${days.value}日` : ''
}
watch([selectedCity, days], autoTitle, { immediate: true })
watch(() => props.initialCity, city => { if (city) selectedCity.value = city }, { immediate: true })

function pickCity(city: City) {
  selectedCity.value = city
  keyword.value = ''
}
function stepDay(delta: number) {
  days.value = Math.min(15, Math.max(1, days.value + delta))
}
function onTitleInput(e: Event) {
  titleTouched.value = true
  title.value = (e.target as HTMLInputElement).value
}
function rerollSeal() {
  const pool = SEALS.filter(s => s !== sealText.value)
  sealText.value = pool[Math.floor(Math.random() * pool.length)]
}
function close() { emit('close') }

function create() {
  if (!selectedCity.value) {
    ui.toast('请先选一座城市')
    return
  }
  const t = trip.createTrip({
    city: selectedCity.value,
    days: days.value,
    title: title.value || undefined,
    budget: budget.value,
    sealText: sealText.value.slice(0, 2),
  })
  emit('created', t.id)
  emit('close')
  void router.push(`/trip/${t.id}`)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="props.open" class="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 px-3 py-6" @click.self="close">
      <div class="paper-texture double-border w-full max-w-[520px] max-h-[92vh] overflow-y-auto bg-paper shadow-paper">
        <!-- 卷首 -->
        <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-ink/15">
          <div>
            <div class="flex items-center gap-2">
              <span class="seal w-8 h-8 text-sm seal-stamp">拾程</span>
              <h2 class="font-brush text-xl text-ink">另起一段行旅</h2>
            </div>
            <p class="font-cn text-[10px] text-inkLight tracking-widest mt-1">择城 · 定日 · 刻章</p>
          </div>
          <button class="w-8 h-8 flex items-center justify-center text-inkLight hover:text-cinnabar border border-ink/20" @click="close" title="关闭">
            <X :size="16" />
          </button>
        </header>

        <div class="px-5 py-4 space-y-5">
          <!-- 选城市 -->
          <div>
            <label class="font-cn text-xs text-cinnabar tracking-widest">一 · 去哪儿</label>
            <div class="mt-2 flex items-center gap-2 h-10 px-3 bg-mist border border-ink/25 focus-within:border-cyanq">
              <Search :size="14" class="text-inkLight shrink-0" />
              <input v-model="keyword" type="search" placeholder="搜索城市（可搜全国）" class="flex-1 min-w-0 bg-transparent outline-none font-cn text-xs text-ink" />
            </div>

            <div v-if="keyword.trim()" class="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              <button v-for="c in cityResults" :key="c.id" class="px-2 py-1.5 border font-cn text-[11px] text-left truncate transition-colors"
                :class="selectedCity?.id === c.id ? 'bg-cinnabar text-mist border-cinnabar' : 'bg-mist/70 text-ink border-ink/15 hover:border-cyanq'"
                @click="pickCity(c)">
                <MapPin :size="9" class="inline mr-0.5" />{{ c.name }}
              </button>
              <p v-if="!cityResults.length" class="col-span-full font-cn text-[11px] text-inkLight py-2">未找到该城市</p>
            </div>

            <div v-else class="mt-3">
              <p class="font-cn text-[10px] text-inkLight mb-2">热门印章 · 轻点即选</p>
              <div class="flex flex-wrap gap-2">
                <button v-for="c in hotCities" :key="c.id"
                  class="seal w-10 h-10 text-[13px] transition-transform hover:-rotate-3"
                  :class="selectedCity?.id === c.id ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'opacity-85 hover:opacity-100'"
                  :title="c.province" @click="pickCity(c)">
                  {{ c.name.slice(0, 1) }}
                </button>
              </div>
            </div>

            <p v-if="selectedCity" class="mt-2 font-cn text-[11px] text-cyanqDeep flex items-center gap-1">
              <MapPin :size="11" />已选 {{ selectedCity.name }} · {{ selectedCity.province }}
            </p>
          </div>

          <!-- 天数 -->
          <div>
            <label class="font-cn text-xs text-cinnabar tracking-widest">二 · 行几日</label>
            <div class="mt-2 inline-flex items-center border border-ink/25 bg-mist">
              <button class="w-9 h-9 flex items-center justify-center text-ink hover:text-cinnabar disabled:opacity-30" :disabled="days <= 1" @click="stepDay(-1)" title="减一天"><Minus :size="15" /></button>
              <span class="w-24 text-center font-num text-2xl text-ink">{{ days }}</span>
              <button class="w-9 h-9 flex items-center justify-center text-ink hover:text-cinnabar disabled:opacity-30" :disabled="days >= 15" @click="stepDay(1)" title="加一天"><Plus :size="15" /></button>
              <span class="px-3 font-cn text-[10px] text-inkLight border-l border-ink/15">1 – 15 天</span>
            </div>
          </div>

          <!-- 预算 + 闲章 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="font-cn text-xs text-cinnabar tracking-widest">三 · 预算（选填）</label>
              <div class="mt-2 flex items-center gap-2 h-9 px-2.5 bg-mist border border-ink/25 focus-within:border-cyanq">
                <span class="font-num text-inkLight">¥</span>
                <input v-model.number="budget" type="number" min="0" placeholder="如 3000" class="flex-1 min-w-0 bg-transparent outline-none font-num text-sm text-ink" />
              </div>
            </div>
            <div>
              <label class="font-cn text-xs text-cinnabar tracking-widest">四 · 自刻闲章（两字）</label>
              <div class="mt-2 flex items-center gap-2">
                <input v-model="sealText" maxlength="2"
                  class="w-16 h-10 text-center bg-cinnabar text-mist font-brush text-lg border-0 outline-none seal" />
                <button class="h-9 px-2 flex items-center gap-1 border border-ink/25 text-inkLight hover:text-cinnabar font-cn text-[11px]" @click="rerollSeal">
                  <Sparkles :size="12" />换一枚
                </button>
              </div>
            </div>
          </div>

          <!-- 标题 -->
          <div>
            <label class="font-cn text-xs text-cinnabar tracking-widest flex items-center gap-1"><PenLine :size="12" />题名（可改）</label>
            <input :value="title" @input="onTitleInput" placeholder="选城市后自动生成"
              class="mt-2 w-full h-10 px-3 bg-mist border border-ink/25 focus:border-cyanq outline-none font-brush text-base text-ink" />
          </div>
        </div>

        <!-- 卷尾 -->
        <footer class="flex items-center justify-between gap-3 px-5 py-4 border-t border-ink/15 bg-mist/50">
          <p class="font-cn text-[10px] text-inkLight">创建后进入行程编辑，可随时增删地点</p>
          <button class="h-10 px-5 flex items-center gap-2 bg-cinnabar text-mist font-cn text-sm hover:bg-cinnabarDeep shadow-seal" @click="create">
            启程 <ArrowRight :size="15" />
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>
