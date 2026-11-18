<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, Wallet, CalendarDays, SunMedium, PenLine } from 'lucide-vue-next'
import type { Trip } from '../../types'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'

const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ edit: [] }>()
const router = useRouter()
const tripStore = useTripStore()
const ui = useUiStore()

const dateEditing = ref(false)
function saveDate(e: Event) {
  const v = (e.target as HTMLInputElement).value
  dateEditing.value = false
  if (v === (props.trip.startDate || '')) return
  const before = props.trip.startDate
  tripStore.updateTrip(props.trip.id, { startDate: v || undefined })
  ui.toast(v ? `启程日期已设为 ${v}` : '已清除启程日期', '撤销', () => tripStore.updateTrip(props.trip.id, { startDate: before }))
}

const spent = computed(() => props.trip.expenses.reduce((s, e) => s + e.amount, 0))
const ratio = computed(() => props.trip.totalBudget ? Math.min(1, spent.value / props.trip.totalBudget) : 0)
const over = computed(() => !!props.trip.totalBudget && spent.value > props.trip.totalBudget)
const todayIndex = computed(() => {
  if (!props.trip.startDate) return 0
  const start = new Date(props.trip.startDate).getTime()
  const n = Math.floor((Date.now() - start) / 86400000) + 1
  return n >= 1 && n <= props.trip.days.length ? n : 0
})

function goToday() { router.push({ path: `/trip/${props.trip.id}`, query: { view: 'today' } }) }
</script>

<template>
  <header class="relative z-30 shrink-0 paper-texture double-border border-b border-ink/20">
    <div class="h-16 md:h-[72px] px-3 md:px-6 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 md:gap-3 min-w-0">
        <button class="w-9 h-9 shrink-0 paper-card flex items-center justify-center text-inkLight hover:text-cinnabar" title="返回我的攻略" @click="router.push('/')">
          <ChevronLeft :size="19" />
        </button>
        <span class="seal w-9 h-9 text-[11px] shrink-0 flex-col leading-none"><span>{{ trip.sealText.slice(0,1) }}</span><span>{{ trip.sealText.slice(1,2) || '程' }}</span></span>
        <div class="min-w-0">
          <button class="group flex items-center gap-1.5 min-w-0" @click="emit('edit')">
            <h1 class="font-brush text-lg md:text-2xl text-ink truncate">{{ trip.title }}</h1>
            <PenLine :size="12" class="text-inkLight/0 group-hover:text-cinnabar shrink-0 transition-colors" />
          </button>
          <div class="font-cn text-[10px] md:text-xs text-inkLight tracking-widest truncate">
            {{ trip.cities.map(c => c.name).join(' · ') }} · {{ trip.days.length }} 日
            <input
              v-if="dateEditing"
              type="date"
              :value="trip.startDate || ''"
              autofocus
              class="ml-2 align-middle bg-mist border border-cyanq outline-none font-num text-xs text-ink px-1"
              @change="saveDate" @blur="dateEditing = false"
            />
            <button v-else class="ml-2 align-middle inline-flex items-center gap-1 hover:text-cinnabar" :title="trip.startDate ? '点击改启程日期' : '点击补填启程日期'" @click.stop="dateEditing = true">
              <CalendarDays :size="10" class="inline" /> {{ trip.startDate || '未定日期' }}
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button v-if="todayIndex" class="h-9 px-3 paper-card flex items-center gap-1.5 text-cinnabar font-cn text-xs border-cinnabar/40" @click="goToday">
          <SunMedium :size="15" /> 今天 · Day {{ todayIndex }}
        </button>
        <button class="hidden sm:flex h-9 px-3 paper-card items-center gap-1.5 font-cn text-xs text-inkLight" title="预算执行">
          <Wallet :size="14" :class="over ? 'text-cinnabar' : 'text-ochreDeep'" />
          <span class="font-num text-ink">¥{{ (spent / 100).toFixed(0) }}</span>
          <span v-if="trip.totalBudget" class="font-num text-[10px] text-inkLight">/ {{ (trip.totalBudget / 100).toFixed(0) }}</span>
          <span v-if="over" class="font-cn text-[9px] text-cinnabar">已逾制</span>
        </button>
      </div>
    </div>
    <div v-if="trip.totalBudget" class="absolute bottom-0 left-0 h-[2px] bg-cinnabar/80 transition-all" :style="{ width: `${ratio * 100}%` }"></div>
  </header>
</template>
