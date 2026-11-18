import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { City, DayPlan, Expense, InkStroke, POI, TransportMode, Trip } from '../types'
import { estimate } from '../lib/estimate'
import { fetchRoute } from '../lib/routeApi'
import { useUiStore } from './ui'
import { makeDemoTrip } from '../seed'

const STORAGE = 'shicheng:trips'
const SCHEMA = 1

export interface UndoEntry {
  label: string
  snapshot: string
  tripId: string
  at: number
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return [makeDemoTrip()]
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed?.trips) ? parsed.trips : Array.isArray(parsed) ? parsed : []
    if (!list.length) return [makeDemoTrip()]
    return list.map(normalizeTrip)
  } catch {
    return [makeDemoTrip()]
  }
}

function normalizeTrip(t: any): Trip {
  const now = Date.now()
  return {
    id: t.id || uid('trip'),
    title: t.title || '未命名旅程',
    sealText: t.sealText || '远游',
    cities: t.cities || [],
    startDate: t.startDate,
    days: (t.days || []).map((d: any, i: number) => ({
      dayIndex: d.dayIndex || i + 1,
      date: d.date,
      city: d.city || t.cities?.[0]?.name || '',
      title: d.title || `Day ${i + 1} · ${d.city || ''}`,
      departTime: d.departTime || '09:00',
      poiIds: d.poiIds || [],
      basePoiId: d.basePoiId,
      segmentIds: d.segmentIds || [],
      weather: d.weather,
    })),
    pois: t.pois || {},
    wishlist: t.wishlist || [],
    segments: t.segments || {},
    expenses: (t.expenses || []).map((e: any) => ({ amount: Number(e.amount) || 0, createdAt: e.createdAt || now, ...e })),
    annotations: t.annotations || [],
    totalBudget: t.totalBudget,
    coverImage: t.coverImage,
    archived: !!t.archived,
    createdAt: t.createdAt || now,
    updatedAt: t.updatedAt || now,
    openedAt: t.openedAt,
    completedAt: t.completedAt,
  }
}

export const useTripStore = defineStore('trip', () => {
  const trips = ref<Trip[]>(loadTrips())
  const activeTripId = ref<string | null>(trips.value.find(t => !t.archived)?.id || trips.value[0]?.id || null)
  const undoStack = ref<UndoEntry[]>([])

  const activeTrip = computed(() => trips.value.find(t => t.id === activeTripId.value) || null)
  const sortedTrips = computed(() => [...trips.value].sort((a, b) => b.updatedAt - a.updatedAt))
  const activeTrips = computed(() => sortedTrips.value.filter(t => !t.archived))
  const archivedTrips = computed(() => sortedTrips.value.filter(t => t.archived))

  watch(trips, value => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ schema: SCHEMA, trips: value }))
    } catch {
      // localStorage 满时由 UI 层提示导出 JSON；这里不阻断编辑
    }
  }, { deep: true })

  function touch(trip: Trip) {
    trip.updatedAt = Date.now()
  }

  /* ===== 真实路径：有 Key 就把「直线估算」换成 WebService 路线 ===== */
  const ui = useUiStore()
  const inflight = new Set<string>()

  /** 逐段取真实路线；失败的段保留估算值，不打断编辑 */
  async function refineDay(dayIndex: number) {
    const t = activeTrip.value
    const key = ui.mapKey
    if (!t || !key) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    for (const sid of [...day.segmentIds]) {
      const seg = t.segments[sid]
      if (!seg || !seg.estimated) continue
      const from = t.pois[seg.fromPoiId]
      const to = t.pois[seg.toPoiId]
      if (!from || !to) continue
      const stamp = `${sid}|${seg.mode}|${from.location.lat.toFixed(5)},${from.location.lng.toFixed(5)}|${to.location.lat.toFixed(5)},${to.location.lng.toFixed(5)}`
      if (inflight.has(stamp)) continue
      inflight.add(stamp)
      const modeAtRequest = seg.mode
      try {
        const r = await fetchRoute(key, modeAtRequest, from.location, to.location, day.city)
        const live = activeTrip.value
        const still = live?.segments[sid]
        // 请求期间改了方式 / 删了段，就丢弃这次结果
        if (!r || !still || still.mode !== modeAtRequest) continue
        still.distanceKm = r.distanceKm
        still.durationMin = r.durationMin
        still.cost = r.cost
        still.path = r.path
        still.lineNos = r.lineNos
        still.transferCount = r.transferCount
        still.estimated = false
        touch(live!)
      } catch (err: any) {
        /* 网络或 Key 权限问题：保留估算，界面继续标「估」；199 弹引导 */
        if (err?.status === 199) ui.notifyKeyGuide()
      } finally {
        inflight.delete(stamp)
      }
    }
  }

  /** 整趟旅程按日顺序补路线：先眼前当天，其余各日在后台排完 */
  async function refineTrip() {
    const t = activeTrip.value
    if (!t || !ui.mapKey) return
    for (const d of [...t.days]) await refineDay(d.dayIndex)
  }
  function snapshot(tripId: string, label: string) {
    const trip = trips.value.find(t => t.id === tripId)
    if (!trip) return
    undoStack.value.push({ label, snapshot: JSON.stringify(trip), tripId, at: Date.now() })
    if (undoStack.value.length > 12) undoStack.value.shift()
  }
  function undo(): string | null {
    const entry = undoStack.value.pop()
    if (!entry) return null
    const idx = trips.value.findIndex(t => t.id === entry.tripId)
    if (idx < 0) return null
    trips.value[idx] = normalizeTrip(JSON.parse(entry.snapshot))
    return `已撤销：${entry.label}`
  }

  function findTrip(id: string) { return trips.value.find(t => t.id === id) || null }
  function openTrip(id: string) {
    activeTripId.value = id
    const t = findTrip(id)
    if (t) { t.openedAt = Date.now(); touch(t) }
  }

  function createTrip(input: { city: City; days: number; title?: string; budget?: number; sealText?: string; startDate?: string }): Trip {
    const city = input.city
    const now = Date.now()
    const trip: Trip = {
      id: uid('trip'),
      title: input.title?.trim() || `${city.name} · ${input.days}日`,
      sealText: input.sealText?.slice(0, 2) || '远游',
      cities: [city],
      startDate: input.startDate,
      days: Array.from({ length: Math.min(15, Math.max(1, input.days)) }, (_, i) => ({
        dayIndex: i + 1,
        city: city.name,
        title: `Day ${i + 1} · ${city.name}`,
        departTime: '09:00',
        poiIds: [],
        segmentIds: [],
      })),
      pois: {},
      wishlist: [],
      segments: {},
      expenses: [],
      annotations: [],
      totalBudget: input.budget || undefined,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    trips.value.push(trip)
    activeTripId.value = trip.id
    return trip
  }

  function deleteTrip(id: string) {
    const idx = trips.value.findIndex(t => t.id === id)
    if (idx < 0) return
    snapshot(id, '删除攻略')
    trips.value.splice(idx, 1)
    if (activeTripId.value === id) activeTripId.value = trips.value[0]?.id || null
  }
  function archiveTrip(id: string, archived = true) {
    const t = findTrip(id)
    if (!t) return
    snapshot(id, archived ? '归档攻略' : '恢复攻略')
    t.archived = archived
    if (archived) t.completedAt = Date.now()
    touch(t)
  }

  function updateTrip(id: string, patch: Partial<Trip>) {
    const t = findTrip(id)
    if (!t) return
    Object.assign(t, patch)
    touch(t)
  }

  function addPoi(poi: POI, tripId = activeTripId.value) {
    const t = findTrip(tripId || '')
    if (!t) return
    if (!t.pois[poi.id]) t.pois[poi.id] = { ...poi }
  }

  function addToWishlist(poi: POI, tripId = activeTripId.value): boolean {
    const t = findTrip(tripId || '')
    if (!t) return false
    addPoi(poi, t.id)
    if (t.wishlist.includes(poi.id)) return false
    snapshot(t.id, '收藏地点')
    t.wishlist.push(poi.id)
    touch(t)
    return true
  }
  function removeFromWishlist(poiId: string) {
    const t = activeTrip.value
    if (!t) return
    t.wishlist = t.wishlist.filter(id => id !== poiId)
    touch(t)
  }
  function isWishlisted(poiId: string) { return !!activeTrip.value?.wishlist.includes(poiId) }
  function inDays(poiId: string): number[] {
    return activeTrip.value?.days.filter(d => d.poiIds.includes(poiId)).map(d => d.dayIndex) || []
  }

  function rebuildSegments(dayIndex: number) {
    const t = activeTrip.value
    if (!t) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    const oldModes = new Map<string, TransportMode>()
    for (const sid of day.segmentIds) {
      const s = t.segments[sid]
      if (s) oldModes.set(`${s.fromPoiId}|${s.toPoiId}`, s.mode)
    }
    for (const sid of day.segmentIds) delete t.segments[sid]
    day.segmentIds = []
    const stops = day.poiIds.filter(id => t.pois[id] && t.pois[id].role !== 'base')
    for (let i = 0; i < stops.length - 1; i++) {
      const from = t.pois[stops[i]], to = t.pois[stops[i + 1]]
      const key = `${from.id}|${to.id}`
      const mode = oldModes.get(key) || 'walk'
      const e = estimate(from.location, to.location, mode)
      const id = uid('seg')
      t.segments[id] = {
        id, fromPoiId: from.id, toPoiId: to.id, mode,
        durationMin: e.durationMin, distanceKm: e.distanceKm, cost: e.cost, estimated: true,
      }
      day.segmentIds.push(id)
    }
    touch(t)
    void refineDay(dayIndex)
  }

  function addToDay(poi: POI, dayIndex: number, atIndex?: number): { ok: boolean; existedIn?: number[] } {
    const t = activeTrip.value
    if (!t) return { ok: false }
    const day = t.days.find(d => d.dayIndex === dayIndex)
    if (!day) return { ok: false }
    addPoi(poi, t.id)
    const existed = inDays(poi.id)
    if (day.poiIds.includes(poi.id)) return { ok: true, existedIn: existed }
    snapshot(t.id, '加入日程')
    if (poi.category === 'hotel' && !day.basePoiId) {
      day.basePoiId = poi.id
      t.pois[poi.id].role = 'base'
      if (!day.poiIds.includes(poi.id)) day.poiIds.push(poi.id)
    } else {
      const idx = typeof atIndex === 'number' ? Math.max(0, Math.min(atIndex, day.poiIds.length)) : day.poiIds.length
      day.poiIds.splice(idx, 0, poi.id)
    }
    t.wishlist = t.wishlist.filter(id => id !== poi.id)
    rebuildSegments(dayIndex)
    touch(t)
    return { ok: true, existedIn: existed }
  }

  function removeFromDay(poiId: string, dayIndex: number) {
    const t = activeTrip.value
    if (!t) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    snapshot(t.id, '移出日程')
    day.poiIds = day.poiIds.filter(id => id !== poiId)
    if (day.basePoiId === poiId) day.basePoiId = undefined
    if (t.pois[poiId] && !inDays(poiId).length && !t.wishlist.includes(poiId)) t.wishlist.push(poiId)
    rebuildSegments(dayIndex)
    touch(t)
  }

  function movePoi(poiId: string, fromDay: number, toDay: number, toIndex?: number) {
    const t = activeTrip.value
    if (!t || fromDay === toDay) return
    const source = t.days.find(d => d.dayIndex === fromDay)
    const target = t.days.find(d => d.dayIndex === toDay)
    if (!source || !target) return
    snapshot(t.id, '跨日移动')
    source.poiIds = source.poiIds.filter(id => id !== poiId)
    if (source.basePoiId === poiId) source.basePoiId = undefined
    const idx = typeof toIndex === 'number' ? Math.max(0, Math.min(toIndex, target.poiIds.length)) : target.poiIds.length
    target.poiIds.splice(idx, 0, poiId)
    if (t.pois[poiId]?.category === 'hotel') { target.basePoiId = poiId; t.pois[poiId].role = 'base' }
    rebuildSegments(fromDay)
    rebuildSegments(toDay)
    touch(t)
  }

  function reorderPoi(poiId: string, dayIndex: number, delta: number) {
    const t = activeTrip.value
    if (!t) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    const idx = day.poiIds.indexOf(poiId)
    const next = idx + delta
    if (idx < 0 || next < 0 || next >= day.poiIds.length) return
    snapshot(t.id, '调整顺序')
    ;[day.poiIds[idx], day.poiIds[next]] = [day.poiIds[next], day.poiIds[idx]]
    rebuildSegments(dayIndex)
    touch(t)
  }

  function reorderByOrder(dayIndex: number, ids: string[]) {
    const t = activeTrip.value
    if (!t) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    snapshot(t.id, '顺路重排')
    day.poiIds = ids.filter(id => day.poiIds.includes(id))
    rebuildSegments(dayIndex)
    touch(t)
  }

  function setSegmentMode(dayIndex: number, segmentId: string, mode: TransportMode) {
    const t = activeTrip.value
    if (!t) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    const seg = t.segments[segmentId]
    if (!day || !seg) return
    const from = t.pois[seg.fromPoiId], to = t.pois[seg.toPoiId]
    const e = estimate(from.location, to.location, mode)
    seg.mode = mode
    seg.durationMin = e.durationMin
    seg.distanceKm = e.distanceKm
    seg.cost = e.cost
    seg.estimated = true
    touch(t)
    void refineDay(dayIndex)
  }

  function updatePoi(poiId: string, patch: Partial<POI>) {
    const t = activeTrip.value
    if (!t?.pois[poiId]) return
    Object.assign(t.pois[poiId], patch)
    touch(t)
  }

  function addCustomPoi(input: { name: string; category: POI['category']; city: string; location: { lng: number; lat: number }; address?: string; note?: string }): POI {
    const t = activeTrip.value!
    const poi: POI = {
      id: uid('custom'), name: input.name, category: input.category, role: input.category === 'hotel' ? 'base' : 'stop',
      location: input.location, address: input.address || '', city: input.city, tags: [], source: 'custom',
      intro: input.note, note: input.note, stayMinutes: input.category === 'hotel' ? 0 : 60,
    }
    addPoi(poi, t.id)
    t.wishlist.push(poi.id)
    touch(t)
    return poi
  }

  function setDayField(dayIndex: number, patch: Partial<DayPlan>) {
    const t = activeTrip.value
    const day = t?.days.find(d => d.dayIndex === dayIndex)
    if (!t || !day) return
    Object.assign(day, patch)
    touch(t)
  }
  function addDay() {
    const t = activeTrip.value
    if (!t || t.days.length >= 15) return
    const n = t.days.length + 1
    const city = t.cities[t.cities.length - 1]?.name || ''
    t.days.push({ dayIndex: n, city, title: `Day ${n} · ${city}`, departTime: '09:00', poiIds: [], segmentIds: [] })
    touch(t)
  }
  function removeDay(dayIndex: number) {
    const t = activeTrip.value
    if (!t || t.days.length <= 1) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    snapshot(t.id, '减去一天')
    for (const sid of day.segmentIds) delete t.segments[sid]
    const leftover = [...day.poiIds]
    t.days = t.days.filter(d => d.dayIndex !== dayIndex).map((d, i) => ({ ...d, dayIndex: i + 1 }))
    for (const pid of leftover) {
      if (!inDays(pid).length && t.pois[pid] && !t.wishlist.includes(pid)) t.wishlist.push(pid)
    }
    for (const e of t.expenses) {
      if (e.dayIndex === dayIndex) e.dayIndex = Math.min(dayIndex, t.days.length)
      else if (e.dayIndex > dayIndex) e.dayIndex -= 1
    }
    touch(t)
  }

  function addExpense(e: Omit<Expense, 'id' | 'createdAt'>) {
    const t = activeTrip.value
    if (!t) return
    snapshot(t.id, '记一笔')
    t.expenses.push({ ...e, id: uid('exp'), createdAt: Date.now() })
    touch(t)
  }
  function updateExpense(id: string, patch: Partial<Expense>) {
    const t = activeTrip.value
    if (!t) return
    const e = t.expenses.find(x => x.id === id)
    if (!e) return
    Object.assign(e, patch)
    touch(t)
  }
  function deleteExpense(id: string) {
    const t = activeTrip.value
    if (!t) return
    snapshot(t.id, '删除开销')
    t.expenses = t.expenses.filter(e => e.id !== id)
    touch(t)
  }

  function addAnnotation(stroke: Omit<InkStroke, 'id' | 'createdAt' | 'color' | 'width'>) {
    const t = activeTrip.value
    if (!t) return
    t.annotations.push({ ...stroke, id: uid('ink'), color: '#A64834', width: 3, createdAt: Date.now() })
    touch(t)
  }
  function undoAnnotation() {
    const t = activeTrip.value
    if (!t?.annotations.length) return
    t.annotations.pop()
    touch(t)
  }
  function clearAnnotations() {
    const t = activeTrip.value
    if (!t) return
    snapshot(t.id, '清空批注')
    t.annotations = []
    touch(t)
  }

  function exportData() {
    return JSON.stringify({ schema: SCHEMA, exportedAt: new Date().toISOString(), trips: trips.value }, null, 2)
  }
  function importData(json: string): { ok: boolean; message: string } {
    try {
      const parsed = JSON.parse(json)
      const incoming: Trip[] = Array.isArray(parsed?.trips) ? parsed.trips : Array.isArray(parsed) ? parsed : []
      if (!incoming.length) return { ok: false, message: '文件中没有攻略数据' }
      let added = 0
      for (const item of incoming) {
        const trip = normalizeTrip(item)
        const idx = trips.value.findIndex(t => t.id === trip.id)
        if (idx >= 0) trips.value[idx] = trip
        else trips.value.push(trip)
        added++
      }
      return { ok: true, message: `已导入 ${added} 份攻略` }
    } catch {
      return { ok: false, message: 'JSON 格式不正确' }
    }
  }
  function clearAll() {
    snapshot(activeTripId.value || '', '清空数据')
    trips.value = []
    activeTripId.value = null
  }

  return {
    trips, activeTripId, activeTrip, sortedTrips, activeTrips, archivedTrips, undoStack,
    findTrip, openTrip, createTrip, deleteTrip, archiveTrip, updateTrip, undo,
    addPoi, addToWishlist, removeFromWishlist, isWishlisted, inDays,
    addToDay, removeFromDay, movePoi, reorderPoi, reorderByOrder, rebuildSegments, setSegmentMode, refineDay, refineTrip,
    updatePoi, addCustomPoi, setDayField, addDay, removeDay,
    addExpense, updateExpense, deleteExpense,
    addAnnotation, undoAnnotation, clearAnnotations,
    exportData, importData, clearAll,
  }
})
