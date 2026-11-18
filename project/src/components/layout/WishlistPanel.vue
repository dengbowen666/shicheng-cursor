<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { CATEGORY_LABEL } from '../../types'
import type { POI, POICategory } from '../../types'
import { X, Trash2, CalendarPlus, Umbrella, MapPin, Plus } from 'lucide-vue-next'

const emit = defineEmits<{ close: [] }>()

const trip = useTripStore()
const ui = useUiStore()

const poiMap = computed(() => trip.activeTrip?.pois || {})
const days = computed(() => trip.activeTrip?.days || [])
const wishlistPois = computed<POI[]>(() => (trip.activeTrip?.wishlist || [])
  .map(id => poiMap.value[id])
  .filter((p): p is POI => !!p))

const GROUPS: { cat: POICategory; label: string }[] = [
  { cat: 'sight', label: '山水胜迹' },
  { cat: 'food', label: '风味人间' },
  { cat: 'hotel', label: '落脚之处' },
  { cat: 'shop', label: '市集购趣' },
  { cat: 'custom', label: '自定地点' },
]
const grouped = computed(() => GROUPS
  .map(g => ({ ...g, items: wishlistPois.value.filter(p => p.category === g.cat) }))
  .filter(g => g.items.length))

// 雨备候选：博物馆 / 展馆 / 美食
const rainCandidates = computed(() => wishlistPois.value.filter(p =>
  p.category === 'food' ||
  /博物馆|展馆|美术馆|艺术馆|科技馆|纪念馆|美食|小吃|餐厅/.test(p.name) ||
  (p.tags || []).some(t => /博物馆|展馆|美食/.test(t)),
).slice(0, 4))

// 每日已入日程数量（驻地不占白天）
function dayCount(dayIndex: number) {
  const d = days.value.find(x => x.dayIndex === dayIndex)
  return d ? d.poiIds.filter(id => poiMap.value[id]?.role !== 'base').length : 0
}

// 移出：二次确认 + toast 撤销
const confirming = ref<string | null>(null)
function removeFromWishlist(poi: POI) {
  if (confirming.value !== poi.id) {
    confirming.value = poi.id
    return
  }
  confirming.value = null
  trip.removeFromWishlist(poi.id)
  ui.toast(`已移出收藏「${poi.name}」`, '撤销', () => trip.addToWishlist(poi))
}

// 加入日程：弹 Day 按钮菜单，重复允许但提示
const addingId = ref<string | null>(null)
function toggleDayMenu(id: string) {
  addingId.value = addingId.value === id ? null : id
}
function addToDay(poi: POI, dayIndex: number) {
  const r = trip.addToDay(poi, dayIndex)
  if (!r.ok) return
  addingId.value = null
  if (r.existedIn?.length) {
    ui.toast(`已在第 ${r.existedIn.join('、')} 日，仍可重复加入`)
  } else {
    ui.toast(`已加入第 ${dayIndex} 日`, '撤销', () => trip.removeFromDay(poi.id, dayIndex))
  }
}
</script>

<template>
  <section class="flex flex-col h-full bg-paper text-ink overflow-hidden">
    <header class="shrink-0 paper-texture border-b border-ink/20 px-4 py-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="font-brush text-base text-ink">收藏池 · 待用</h2>
          <p class="font-cn text-[10px] text-inkLight mt-0.5">{{ wishlistPois.length }} 处候选 · 点选加入日程</p>
        </div>
        <button class="w-8 h-8 shrink-0 flex items-center justify-center text-inkLight hover:text-cinnabar border border-ink/20 hover:border-cinnabar/50" title="收起" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <!-- 雨备候选 -->
      <div v-if="rainCandidates.length" class="mt-2.5 p-2 border border-cyanq/45 bg-cyanq/5">
        <p class="font-cn text-[10px] text-cyanqDeep flex items-center gap-1"><Umbrella :size="11" /> 雨天备选 · 室内可去</p>
        <p class="font-cn text-[10px] text-inkLight mt-1 truncate">{{ rainCandidates.map(p => p.name).join('、') }}</p>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      <div v-if="!wishlistPois.length" class="text-center py-12">
        <p class="font-brush text-lg text-ink/60">收藏池空空</p>
        <p class="font-cn text-[11px] text-inkLight mt-1">搜索地点后可收藏备用</p>
      </div>

      <div v-for="g in grouped" :key="g.cat">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="seal w-5 h-5 text-[10px] shrink-0">{{ CATEGORY_LABEL[g.cat] }}</span>
          <span class="font-cn text-xs text-ink tracking-widest">{{ g.label }}</span>
          <span class="font-num text-[10px] text-inkLight">{{ g.items.length }}</span>
          <span class="flex-1 ink-divider"></span>
        </div>

        <div class="space-y-1.5">
          <div v-for="poi in g.items" :key="poi.id" class="paper-card px-2.5 py-2"
            :class="confirming === poi.id ? 'border-cinnabar' : ''">
            <div class="flex items-center gap-2">
              <div class="flex-1 min-w-0">
                <p class="font-cn text-xs text-ink truncate">{{ poi.name }}</p>
                <p class="font-cn text-[10px] text-inkLight truncate mt-0.5 flex items-center gap-0.5">
                  <MapPin :size="9" class="shrink-0" />{{ poi.address || poi.city }}
                  <span v-if="trip.inDays(poi.id).length" class="text-cinnabar shrink-0">· 已在第 {{ trip.inDays(poi.id).join('、') }} 日</span>
                </p>
              </div>
              <button class="shrink-0 h-7 px-2 inline-flex items-center gap-1 border border-cinnabar/50 text-cinnabar font-cn text-[10px] hover:bg-cinnabar/10"
                @click="toggleDayMenu(poi.id)">
                <CalendarPlus :size="11" /> 入日程
              </button>
              <button class="shrink-0 p-1 hover:text-cinnabar"
                :class="confirming === poi.id ? 'text-cinnabar' : 'text-inkLight/70'"
                :title="confirming === poi.id ? '再点一次确认移出' : '移出收藏'"
                @click="removeFromWishlist(poi)">
                <Trash2 :size="13" />
              </button>
            </div>
            <p v-if="confirming === poi.id" class="font-cn text-[10px] text-cinnabar mt-1">确认移出收藏？</p>

            <!-- Day 按钮菜单：带每日数量，移动端不用拖拽 -->
            <Transition name="fade">
              <div v-if="addingId === poi.id" class="mt-2 pt-2 border-t border-dashed border-ink/20">
                <p class="font-cn text-[10px] text-inkLight mb-1.5">选一天加入（数字为当日已排处数）</p>
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="d in days" :key="d.dayIndex"
                    class="h-7 px-2 inline-flex items-center gap-1 border font-cn text-[10px] transition-colors"
                    :class="d.city === (poi.city || d.city) ? 'border-cyanq/60 text-cyanqDeep hover:bg-cyanq/10' : 'border-ink/20 text-inkLight hover:border-cinnabar/60'"
                    @click="addToDay(poi, d.dayIndex)">
                    <Plus :size="9" /> 第{{ d.dayIndex }}日 · {{ dayCount(d.dayIndex) }}处
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
