<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTripStore } from '../../stores/trip'
import { useUiStore } from '../../stores/ui'
import { dayStats } from '../../lib/timeline'
import { haversineFlat, recommendMode, SMART_THRESHOLD } from '../../lib/estimate'
import { MODE_LABEL } from '../../types'
import type { POI, TransportSegment } from '../../types'
import {
  Sparkles, Route, AlertTriangle, Sun, Check, X, ArrowRight, Lightbulb, ListOrdered, LoaderCircle,
} from 'lucide-vue-next'
import {
  AI_ENABLED, advise, aiReady, adviceCacheKey,
  type AdviceRequest, type AdviceAction,
} from '../../lib/ai'

const props = defineProps<{ dayIndex: number }>()
const trip = useTripStore()
const ui = useUiStore()

const day = computed(() => trip.activeTrip?.days.find(d => d.dayIndex === props.dayIndex) || null)
const poiMap = computed(() => trip.activeTrip?.pois || {})
const segmentMap = computed(() => trip.activeTrip?.segments || {})
const stats = computed(() => day.value ? dayStats(day.value, poiMap.value, segmentMap.value) : null)
const stops = computed<POI[]>(() => (day.value?.poiIds || [])
  .map(id => poiMap.value[id])
  .filter((p): p is POI => !!p && p.role !== 'base'))

// O06：忽略状态持久化、按攻略隔离、按天区分；键用 POI id 不用 segment id（后者每次重建都变）
const tripId = computed(() => trip.activeTrip?.id || '')
function key(kind: string) { return `${kind}@${props.dayIndex}` }
function distKey(seg: TransportSegment) { return `dist@${seg.fromPoiId}>${seg.toPoiId}` }
function dismissed(k: string) { return ui.isDismissed(tripId.value, k) }
function dismiss(k: string) { ui.dismissKey(tripId.value, k) }

/* ① 距离推荐：估算段与实际方式不符，或步行过久 */
interface DistanceTip { seg: TransportSegment; mode: ReturnType<typeof recommendMode>['mode']; warning?: string; km: number }
const distanceTips = computed<DistanceTip[]>(() => {
  if (!day.value) return []
  const list: DistanceTip[] = []
  for (const id of day.value.segmentIds) {
    const seg = segmentMap.value[id]
    if (!seg) continue
    const from = poiMap.value[seg.fromPoiId], to = poiMap.value[seg.toPoiId]
    const km = seg.distanceKm ?? (from && to ? haversineFlat(from.location, to.location) : 0)
    const rec = recommendMode(km)
    const mismatch = seg.mode !== rec.mode && km > 0.1
    if (mismatch || rec.warning) list.push({ seg, mode: rec.mode, warning: rec.warning, km })
  }
  return list.filter(t => !dismissed(distKey(t.seg)))
})
function undo() { const msg = trip.undo(); if (msg) ui.toast(msg) }

function adoptMode(tip: DistanceTip) {
  trip.setSegmentMode(props.dayIndex, tip.seg.id, tip.mode)
  ui.toast(`已将这段改为${MODE_LABEL[tip.mode]}`, '撤销', undo)
  dismiss(distKey(tip.seg))
}

/* ② 顺路重排：最近邻预览，先虚框展示再采用/放弃 */
function nearestOrder(list: POI[]): string[] {
  if (list.length < 2) return list.map(p => p.id)
  const remaining = [...list]
  const order: string[] = []
  let cur = remaining.shift()!
  order.push(cur.id)
  while (remaining.length) {
    let best = 0, bestD = Number.POSITIVE_INFINITY
    remaining.forEach((p, i) => {
      const d = haversineFlat(cur.location, p.location)
      if (d < bestD) { bestD = d; best = i }
    })
    cur = remaining.splice(best, 1)[0]
    order.push(cur.id)
  }
  return order
}
const proposedOrder = computed<string[] | null>(() => {
  if (stops.value.length < 2 || dismissed(key('reorder'))) return null
  const current = stops.value.map(p => p.id)
  const optimal = nearestOrder(stops.value)
  return optimal.some((id, i) => id !== current[i]) ? optimal : null
})
const proposedNames = computed(() => (proposedOrder.value || [])
  .map(id => poiMap.value[id]?.name || '?'))
function adoptReorder() {
  if (!proposedOrder.value) return
  trip.reorderByOrder(props.dayIndex, proposedOrder.value)
  ui.toast('已按顺路重排', '撤销', undo)
  dismiss(key('reorder'))
}

/* ③ 过载预警 */
const overload = computed(() => !!stats.value && (
  stats.value.stopCount > SMART_THRESHOLD.overloadPoiCount ||
  stats.value.travelMin > SMART_THRESHOLD.overloadTravelMin
) && !dismissed(key('overload')))
const lastStop = computed(() => stops.value[stops.value.length - 1] || null)
function trimOverload() {
  const poi = lastStop.value
  if (!poi) return
  trip.removeFromDay(poi.id, props.dayIndex)
  ui.toast(`已精简「${poi.name}」`, '撤销', undo)
  dismiss(key('overload'))
}

/* ④ 欠载提醒 */
const underload = computed(() => !!stats.value && stats.value.stopCount > 0 &&
  stats.value.endMin < SMART_THRESHOLD.underloadEndHour * 60 &&
  !dismissed(key('underload')))
const candidate = computed<POI | null>(() => {
  const t = trip.activeTrip
  if (!t) return null
  return (t.wishlist || [])
    .map(id => t.pois[id])
    .find(p => p && p.category !== 'hotel' && !trip.inDays(p.id).includes(props.dayIndex)) || null
})
function fillUnderload() {
  const poi = candidate.value
  if (!poi) return
  const r = trip.addToDay(poi, props.dayIndex)
  if (r.existedIn?.length) ui.toast(`已在第 ${r.existedIn.join('、')} 日`)
  else ui.toast(`已补入「${poi.name}」`, '撤销', undo)
  dismiss(key('underload'))
}

/* ⑤ AI 建议卡：手动触发、受限动作、复用现有 store 方法 */
const aiLoading = ref(false)
const aiAdvice = ref<AdviceAction | null>(null)
const aiFailed = ref(false)
const aiLastAt = ref(0)
const aiSig = computed(() => [
  trip.activeTrip?.id || '',
  props.dayIndex,
  (day.value?.poiIds || []).join(','),
  (day.value?.segmentIds || []).map(id => `${id}:${segmentMap.value[id]?.mode || ''}`).join(','),
].join('|'))
const aiCacheKey = computed(() => adviceCacheKey(tripId.value, props.dayIndex, aiSig.value))

function buildAdviceReq(): AdviceRequest {
  const t = trip.activeTrip
  const weatherText = (day.value?.weather as any)?.text || ''
  return {
    dayIndex: props.dayIndex,
    city: day.value?.city || t?.cities[0]?.name || '',
    date: t?.startDate,
    departTime: day.value?.departTime || '09:00',
    stops: stops.value.map(p => ({
      name: p.name,
      category: p.category,
      stayMin: p.stayMinutes || 60,
      arrive: '—',
    })),
    segments: (day.value?.segmentIds || []).map(id => segmentMap.value[id]).filter(Boolean).map(seg => {
      const a = poiMap.value[seg.fromPoiId]
      const b = poiMap.value[seg.toPoiId]
      return {
        from: a?.name || '?', to: b?.name || '?', mode: seg.mode,
        km: seg.distanceKm, min: seg.durationMin,
      }
    }),
    weather: weatherText || undefined,
    pool: t ? (t.wishlist || []).map(id => t.pois[id]?.name).filter((n): n is string => !!n).slice(0, 8) : [],
  }
}

async function askAi() {
  if (aiLoading.value || !aiReady()) return
  const now = Date.now()
  if (now - aiLastAt.value < 3000) return
  aiLastAt.value = now
  aiLoading.value = true
  aiFailed.value = false
  aiAdvice.value = null
  const result = await advise(buildAdviceReq(), { cacheKey: aiCacheKey.value, signalKey: `day-${tripId.value}-${props.dayIndex}` })
  aiLoading.value = false
  if (!result) { aiFailed.value = true; return }
  // 与 ① 卡去重：同段同方式已由规则卡建议则不重复渲染
  if (result.action === 'mode' && distanceTips.value.some(t =>
    poiMap.value[t.seg.fromPoiId]?.name === result.seg[0] &&
    poiMap.value[t.seg.toPoiId]?.name === result.seg[1] && t.mode === result.mode)) return
  aiAdvice.value = result
}

function adoptAi() {
  const a = aiAdvice.value
  if (!a) return
  const byName = (n: string) => stops.value.find(p => p.name === n)
  const t = trip.activeTrip
  switch (a.action) {
    case 'mode': {
      const from = byName(a.seg[0]), to = byName(a.seg[1])
      if (!from || !to) return
      const seg = (day.value?.segmentIds || []).map(id => segmentMap.value[id])
        .find(s => s && s.fromPoiId === from.id && s.toPoiId === to.id)
      if (!seg) return
      trip.setSegmentMode(props.dayIndex, seg.id, a.mode)
      ui.toast(`已改为${MODE_LABEL[a.mode]}`, '撤销', undo)
      break
    }
    case 'reorder': {
      const order = a.order.map(n => byName(n)?.id).filter((id): id is string => !!id)
      if (order.length !== a.order.length) return
      trip.reorderByOrder(props.dayIndex, order)
      ui.toast('已按 AI 建议调整顺序', '撤销', undo)
      break
    }
    case 'trim': {
      const poi = byName(a.poi)
      if (!poi) return
      trip.removeFromDay(poi.id, props.dayIndex)
      ui.toast(`已精简「${poi.name}」`, '撤销', undo)
      break
    }
    case 'fill': {
      const poi = t ? (t.wishlist || []).map(id => t.pois[id]).find(p => p && p.name === a.poi) : null
      if (!poi) return
      const r = trip.addToDay(poi, props.dayIndex)
      if (r.existedIn?.length) ui.toast(`已在第 ${r.existedIn.join('、')} 日`)
      else ui.toast(`已补入「${poi.name}」`, '撤销', undo)
      break
    }
    case 'none': break
  }
  dismiss(key('ai'))
  aiAdvice.value = null
}
function ignoreAi() {
  dismiss(key('ai'))
  aiAdvice.value = null
}

const aiVisible = computed(() => AI_ENABLED && aiReady() && !dismissed(key('ai')))
const anyTip = computed(() => distanceTips.value.length > 0 || proposedOrder.value ||
  overload.value || underload.value || (aiVisible.value && (aiAdvice.value || aiLoading.value)))
</script>

<template>
  <section class="paper-card bg-mist/80 overflow-hidden">
    <header class="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-ink/15">
      <div class="flex items-center gap-1.5">
        <Sparkles :size="14" class="text-cinnabar" />
        <h3 class="font-brush text-sm text-ink">智能小助手</h3>
      </div>
      <span class="font-cn text-[10px] text-inkLight inline-flex items-center gap-1"><Lightbulb :size="11" />只建议 · 取弃由你</span>
    </header>

    <!-- AI 触发：仅内网构建 + 端点/Key 齐备时渲染；公网构建此块整块消失 -->
    <div v-if="aiVisible" class="px-3 py-2 border-b border-ink/10 flex items-center justify-between gap-2">
      <span class="font-cn text-[10px] text-inkLight tracking-wide inline-flex items-center gap-1"><Sparkles :size="11" class="text-cinnabar" />AI 通盘</span>
      <button
        type="button"
        class="h-7 px-2 inline-flex items-center gap-1 border border-cinnabar/40 text-cinnabar font-cn text-[10px] hover:bg-cinnabar/10 disabled:opacity-50"
        :disabled="aiLoading" @click="askAi"
      >
        <LoaderCircle v-if="aiLoading" :size="11" class="animate-spin" />
        <Sparkles v-else :size="11" />
        {{ aiLoading ? '正在看…' : '请 AI 通盘看一眼' }}
      </button>
    </div>
    <p v-if="aiFailed" class="px-3 py-1.5 font-cn text-[10px] text-inkLight/70">未取到建议</p>

    <div v-if="!anyTip" class="px-3 py-5 text-center font-cn text-[11px] text-inkLight">
      此日安排妥帖，暂无建议
    </div>

    <div v-else class="p-3 space-y-2.5">
      <!-- ⑤ AI 建议卡：受限动作，采用走现有 store 方法 -->
      <div v-if="aiAdvice" class="p-2.5 border border-cinnabar/40 bg-cinnabar/5" data-ai-card>
        <div class="flex items-start gap-2">
          <Sparkles :size="14" class="text-cinnabar shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="font-cn text-[11px] text-ink leading-relaxed">{{ aiAdvice.reason }}</p>
            <div v-if="aiAdvice.action !== 'none'" class="mt-2 flex items-center gap-1.5">
              <button class="h-7 px-2 inline-flex items-center gap-1 bg-cinnabar text-mist font-cn text-[10px]" @click="adoptAi">
                <Check :size="11" /> 采用
              </button>
              <button class="h-7 px-2 inline-flex items-center gap-1 border border-ink/25 text-inkLight font-cn text-[10px]" @click="ignoreAi">
                <X :size="11" /> 忽略
              </button>
            </div>
            <div v-else class="mt-2">
              <button class="h-7 px-2 border border-ink/25 text-inkLight font-cn text-[10px]" @click="ignoreAi">知道了</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ① 距离推荐 -->
      <div v-for="tip in distanceTips" :key="tip.seg.id" class="p-2.5 border border-cyanq/50 bg-paper/70">
        <div class="flex items-start gap-2">
          <Route :size="14" class="text-cyanqDeep shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="font-cn text-[11px] text-ink">
              这段约 {{ tip.km.toFixed(1) }}km，宜
              <span class="text-cinnabar">{{ MODE_LABEL[tip.mode] }}</span>
              <span v-if="tip.warning" class="text-ochre block mt-0.5">{{ tip.warning }}</span>
            </p>
            <div class="mt-2 flex items-center gap-1.5">
              <button class="h-7 px-2 inline-flex items-center gap-1 bg-cinnabar text-mist font-cn text-[10px]" @click="adoptMode(tip)">
                <Check :size="11" /> 采用
              </button>
              <button class="h-7 px-2 inline-flex items-center gap-1 border border-ink/25 text-inkLight font-cn text-[10px]" @click="dismiss(distKey(tip.seg))">
                <X :size="11" /> 忽略
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ② 顺路重排：虚线/虚框预览 -->
      <div v-if="proposedOrder" class="p-2.5 border border-dashed border-cyanq bg-paper/50">
        <div class="flex items-start gap-2">
          <ListOrdered :size="14" class="text-cyanqDeep shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="font-cn text-[11px] text-ink">顺路重排 · 预览</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-1">
              <template v-for="(name, i) in proposedNames" :key="`${name}-${i}`">
                <span v-if="i > 0" class="border-t border-dashed border-cyanq w-3"></span>
                <span class="font-cn text-[10px] px-1.5 py-0.5 border border-dashed border-cyanq/70 text-ink">{{ name }}</span>
              </template>
            </div>
            <div class="mt-2 flex items-center gap-1.5">
              <button class="h-7 px-2 inline-flex items-center gap-1 bg-cinnabar text-mist font-cn text-[10px]" @click="adoptReorder">
                <Check :size="11" /> 采用 <ArrowRight :size="10" />
              </button>
              <button class="h-7 px-2 inline-flex items-center gap-1 border border-ink/25 text-inkLight font-cn text-[10px]" @click="dismiss(key('reorder'))">
                <X :size="11" /> 放弃
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ③ 过载预警 -->
      <div v-if="overload" class="p-2.5 border border-cinnabar/40 bg-cinnabar/5">
        <div class="flex items-start gap-2">
          <AlertTriangle :size="14" class="text-cinnabar shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="font-cn text-[11px] text-ink">
              此日 {{ stats?.stopCount }} 处、交通 {{ stats?.travelMin }} 分，行程偏满
            </p>
            <div class="mt-2 flex items-center gap-1.5">
              <button class="h-7 px-2 inline-flex items-center gap-1 bg-cinnabar text-mist font-cn text-[10px] disabled:opacity-40" :disabled="!lastStop" @click="trimOverload">
                <Check :size="11" /> 精简一站
              </button>
              <button class="h-7 px-2 inline-flex items-center gap-1 border border-ink/25 text-inkLight font-cn text-[10px]" @click="dismiss(key('overload'))">
                <X :size="11" /> 忽略
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ④ 欠载提醒 -->
      <div v-if="underload" class="p-2.5 border border-ochre/50 bg-ochre/5">
        <div class="flex items-start gap-2">
          <Sun :size="14" class="text-ochre shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="font-cn text-[11px] text-ink">
              约 {{ stats?.endTime }} 即毕，天光尚早，可再添一处
            </p>
            <div class="mt-2 flex items-center gap-1.5">
              <button class="h-7 px-2 inline-flex items-center gap-1 bg-cinnabar text-mist font-cn text-[10px] disabled:opacity-40" :disabled="!candidate" @click="fillUnderload">
                <Check :size="11" /> {{ candidate ? `补入「${candidate.name}」` : '收藏池空' }}
              </button>
              <button class="h-7 px-2 inline-flex items-center gap-1 border border-ink/25 text-inkLight font-cn text-[10px]" @click="dismiss(key('underload'))">
                <X :size="11" /> 忽略
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
