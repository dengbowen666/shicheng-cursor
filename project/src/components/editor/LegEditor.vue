<script setup lang="ts">
/**
 * L02/L04：城际段编辑器（Leg）——用户心智「从哪座城出发、以哪种方式去哪座城」。
 * 新建与编辑复用本组件；保存后由父层调用 store，删除同样回传父层。
 */
import { computed, ref } from 'vue'
import { useCityStore } from '../../stores/city'
import { LEG_MODE_LABEL, LEG_MODE_COLOR } from '../../types'
import type { City, Leg, LegMode } from '../../types'
import {
  X, Search, TrainFront, Train, Plane, Car, Bus, Footprints, Trash2, Check, ArrowRight,
} from 'lucide-vue-next'

const props = defineProps<{
  leg: Leg | null          // null = 新建
  dayIndex: number
  defaultFrom?: string     // 新建时默认出发城（上一段的到达城 / 当日主城）
}>()
const emit = defineEmits<{
  save: [data: Omit<Leg, 'id'>]
  delete: [id: string]
  close: []
}>()

const cityStore = useCityStore()

const fromCity = ref(props.leg?.fromCity || props.defaultFrom || '')
const toCity = ref(props.leg?.toCity || '')
const mode = ref<LegMode>(props.leg?.mode || 'highspeed')
const departTime = ref(props.leg?.departTime || '')
const arriveTime = ref(props.leg?.arriveTime || '')
const note = ref(props.leg?.note || '')
const costYuan = ref(props.leg?.cost ? (props.leg.cost / 100).toFixed(0) : '')
const estimated = ref(props.leg?.estimated ?? true)

const MODES: LegMode[] = ['highspeed', 'train', 'flight', 'car', 'coach', 'walk']
const MODE_ICON: Record<LegMode, typeof TrainFront> = {
  highspeed: TrainFront, train: Train, flight: Plane, car: Car, coach: Bus, walk: Footprints,
}

// 城市搜索浮层
const editing = ref<'from' | 'to' | null>(null)
const keyword = ref('')
const results = computed(() => cityStore.searchCities(keyword.value).slice(0, 8))
function openCities(which: 'from' | 'to') {
  editing.value = which
  keyword.value = which === 'from' ? fromCity.value : toCity.value
}
function pickCity(c: City) {
  if (editing.value === 'from') fromCity.value = c.name
  else toCity.value = c.name
  editing.value = null
}

function canSave() {
  return !!fromCity.value.trim() && !!toCity.value.trim() && fromCity.value !== toCity.value
}
function save() {
  if (!canSave()) return
  emit('save', {
    fromCity: fromCity.value.trim(),
    toCity: toCity.value.trim(),
    mode: mode.value,
    departTime: departTime.value || undefined,
    arriveTime: arriveTime.value || undefined,
    note: note.value.trim() || undefined,
    cost: costYuan.value ? Math.round(Number(costYuan.value) * 100) : undefined,
    durationMin: undefined,
    estimated: estimated.value,
  })
}
</script>

<template>
  <div class="paper-card double-border w-full max-w-[400px] bg-mist shadow-paper overflow-hidden">
    <header class="flex items-start justify-between gap-2 px-4 py-3 border-b border-ink/15">
      <div class="min-w-0">
        <h3 class="font-brush text-lg text-ink">{{ leg ? '改这一程' : `第 ${dayIndex} 日 · 增设城际段` }}</h3>
        <p class="font-cn text-[10px] text-inkLight mt-0.5">从哪座城出发，以何种方式，抵达哪座城</p>
      </div>
      <button class="w-7 h-7 shrink-0 flex items-center justify-center text-inkLight hover:text-cinnabar border border-ink/20" title="关闭" @click="emit('close')">
        <X :size="14" />
      </button>
    </header>

    <div class="px-4 py-3 space-y-3">
      <!-- 出发城 → 到达城 -->
      <div class="flex items-stretch gap-2">
        <div class="flex-1 min-w-0 relative">
          <label class="block font-cn text-[10px] text-cinnabar tracking-widest mb-1">自</label>
          <button data-leg-field="from" class="w-full h-9 px-2 text-left bg-paper border border-ink/25 font-cn text-sm truncate" :class="fromCity ? 'text-ink' : 'text-inkLight/60'" @click="openCities('from')">
            {{ fromCity || '选出发城' }}
          </button>
        </div>
        <div class="flex items-center pt-4"><ArrowRight :size="16" class="text-cinnabar" /></div>
        <div class="flex-1 min-w-0 relative">
          <label class="block font-cn text-[10px] text-cinnabar tracking-widest mb-1">至</label>
          <button data-leg-field="to" class="w-full h-9 px-2 text-left bg-paper border border-ink/25 font-cn text-sm truncate" :class="toCity ? 'text-ink' : 'text-inkLight/60'" @click="openCities('to')">
            {{ toCity || '选到达城' }}
          </button>
        </div>
      </div>

      <!-- 城市搜索浮层 -->
      <div v-if="editing" class="paper-card p-2 shadow-paper border border-ochre/40">
        <div class="flex items-center gap-1.5 h-8 px-2 bg-mist border border-ink/20">
          <Search :size="12" class="text-inkLight shrink-0" />
          <input v-model="keyword" class="flex-1 min-w-0 bg-transparent outline-none font-cn text-[11px] text-ink" :placeholder="editing === 'from' ? '搜出发城' : '搜到达城'" @keydown.esc="editing = null" />
          <button class="text-inkLight hover:text-cinnabar" @click="editing = null"><X :size="12" /></button>
        </div>
        <div class="max-h-[160px] overflow-y-auto mt-1.5 drawer-scroll">
          <button v-for="c in results" :key="c.id" type="button"
            class="w-full text-left px-2 py-1.5 font-cn text-[11px] hover:bg-cinnabar/8 flex items-center justify-between"
            :class="c.name === (editing === 'from' ? fromCity : toCity) ? 'text-cinnabar' : 'text-ink'"
            @click="pickCity(c)">
            <span>{{ c.name }}</span><span class="text-inkLight text-[10px]">{{ c.province }}</span>
          </button>
          <p v-if="!results.length" class="text-center font-cn text-[10px] text-inkLight py-3">未找到该城市</p>
        </div>
      </div>

      <!-- 交通方式 -->
      <div>
        <label class="block font-cn text-[10px] text-cinnabar tracking-widest mb-1.5">以何种方式</label>
        <div class="grid grid-cols-3 gap-1.5">
          <button v-for="m in MODES" :key="m" type="button"
            class="flex flex-col items-center justify-center gap-1 py-2 border transition-colors"
            :class="mode === m ? 'bg-cinnabar/8' : 'border-ink/20 hover:border-cinnabar/50'"
            :style="mode === m ? { borderColor: LEG_MODE_COLOR[m], color: LEG_MODE_COLOR[m] } : {}"
            @click="mode = m">
            <component :is="MODE_ICON[m]" :size="16" />
            <span class="font-cn text-[11px]" :style="mode === m ? { color: LEG_MODE_COLOR[m] } : {}">{{ LEG_MODE_LABEL[m] }}</span>
          </button>
        </div>
      </div>

      <!-- 时刻 / 车次 / 票价 -->
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block font-cn text-[10px] text-inkLight mb-1">发车时刻</label>
          <input v-model="departTime" type="time" class="w-full h-8 px-2 bg-paper border border-ink/25 font-num text-[12px] text-ink outline-none" />
        </div>
        <div>
          <label class="block font-cn text-[10px] text-inkLight mb-1">到达时刻</label>
          <input v-model="arriveTime" type="time" class="w-full h-8 px-2 bg-paper border border-ink/25 font-num text-[12px] text-ink outline-none" />
        </div>
        <div>
          <label class="block font-cn text-[10px] text-inkLight mb-1">车次 / 航班（选填）</label>
          <input v-model="note" class="w-full h-8 px-2 bg-paper border border-ink/25 font-cn text-[12px] text-ink outline-none" placeholder="如 D8662" />
        </div>
        <div>
          <label class="block font-cn text-[10px] text-inkLight mb-1">票价 ¥（选填）</label>
          <input v-model="costYuan" type="number" min="0" class="w-full h-8 px-2 bg-paper border border-ink/25 font-num text-[12px] text-ink outline-none" placeholder="0" />
        </div>
      </div>

      <!-- 估算标记 -->
      <button class="w-full flex items-center gap-2 px-2 py-1.5 border border-ink/15 text-left" @click="estimated = !estimated">
        <span class="w-3.5 h-3.5 border flex items-center justify-center shrink-0" :class="estimated ? 'border-cinnabar bg-cinnabar text-mist' : 'border-ink/30'">
          <Check v-if="estimated" :size="10" />
        </span>
        <span class="font-cn text-[11px] text-ink">时刻票价为估算（标「估」）</span>
      </button>

      <p v-if="!canSave() && (fromCity || toCity)" class="font-cn text-[10px] text-cinnabar">出发与到达需是两座不同的城</p>
    </div>

    <footer class="flex items-center gap-2 px-4 py-3 border-t border-ink/15 bg-paper/50">
      <button v-if="leg" class="h-8 px-2 flex items-center justify-center border border-cinnabar/40 text-cinnabar hover:bg-cinnabar/5" title="删除这一程" @click="emit('delete', leg.id)">
        <Trash2 :size="14" />
      </button>
      <button class="h-8 px-4 border border-ink/25 font-cn text-xs text-inkLight hover:border-ink/50 ml-auto" @click="emit('close')">取消</button>
      <button data-leg-save class="h-8 px-5 bg-cinnabar text-mist font-cn text-xs disabled:opacity-40" :disabled="!canSave()" @click="save">收入行迹</button>
    </footer>
  </div>
</template>
