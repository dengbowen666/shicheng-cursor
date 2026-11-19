import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { City, DayPlan, Expense, InkStroke, Leg, POI, TransportMode, Trip } from '../types'
import { estimate } from '../lib/estimate'
import { fetchRoute } from '../lib/routeApi'
import { useUiStore } from './ui'
import { useCityStore } from './city'
import { makeDemoTrip } from '../seed'

const STORAGE = 'shicheng:trips'
const SCHEMA = 1

export interface UndoEntry {
  label: string
  snapshot: string
  tripId: string
  at: number
}

/** O09：导入策略——同 ID 冲突时覆盖 / 跳过 / 另存为副本；replace=整体替换本机（跨设备同步） */
export type ImportPolicy = 'overwrite' | 'skip' | 'clone' | 'replace'
export interface ImportResult { ok: boolean; message: string; conflicts: string[]; added: number; skipped: number; total?: number }

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
      legIds: (d.legIds || []).filter((id: string) => !!(t.legs || {})[id]), // L01：丢弃指向不存在段的悬空引用
      weather: d.weather,
    })),
    pois: t.pois || {},
    wishlist: t.wishlist || [],
    segments: t.segments || {},
    legs: t.legs || {}, // L01：旧数据平滑补空
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

  // 首次加载（含自动生成的演示攻略）主动落盘一次：watch 初始不触发，
  // 否则全新用户什么都没做就关页时 localStorage 始终为空，数据等于没持久化。
  try {
    if (!localStorage.getItem(STORAGE)) {
      localStorage.setItem(STORAGE, JSON.stringify({ schema: SCHEMA, trips: trips.value }))
    }
  } catch { /* 存储不可用时不影响启动 */ }

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
  // O03：一次用户动作可能触发多次底层 mutation，用 depth 合并成一条快照
  let batchDepth = 0
  let batchTripId: string | null = null
  let batchLabel = ''
  function beginBatch(tripId: string, label: string) {
    if (batchDepth++ === 0) { batchTripId = tripId; batchLabel = label }
  }
  function endBatch() {
    if (--batchDepth === 0 && batchTripId) {
      pushSnapshot(batchTripId, batchLabel)
      batchTripId = null
      batchLabel = ''
    }
  }
  function pushSnapshot(tripId: string, label: string) {
    const trip = trips.value.find(t => t.id === tripId)
    if (!trip) return
    undoStack.value.push({ label, snapshot: JSON.stringify(trip), tripId, at: Date.now() })
    if (undoStack.value.length > 12) undoStack.value.shift()
  }
  function snapshot(tripId: string, label: string) {
    if (batchDepth > 0) return
    pushSnapshot(tripId, label)
  }
  /** 全量快照：把整个 trips 数组压成一个可撤销条目，供整体替换/清空等跨卷操作使用 */
  const ALL_SNAPSHOT_ID = '__all_trips__'
  function snapshotAll(label: string) {
    undoStack.value.push({ label, snapshot: JSON.stringify(trips.value), tripId: ALL_SNAPSHOT_ID, at: Date.now() })
    if (undoStack.value.length > 12) undoStack.value.shift()
  }
  function undo(): string | null {
    const entry = undoStack.value.pop()
    if (!entry) return null
    if (entry.tripId === ALL_SNAPSHOT_ID) {
      // 跨卷操作：整卷恢复（含 activeTripId），否则整体替换/清空无法一次撤销
      const restored = (JSON.parse(entry.snapshot) as any[]).map(normalizeTrip)
      trips.value = restored
      if (!activeTripId.value || !findTrip(activeTripId.value)) activeTripId.value = restored[0]?.id || null
      return `已撤销：${entry.label}`
    }
    const restored = normalizeTrip(JSON.parse(entry.snapshot))
    const idx = trips.value.findIndex(t => t.id === entry.tripId)
    if (idx < 0) {
      // 该卷已被删除（或撤销链上更早的删除）：把快照整卷放回，删除才可撤销
      trips.value.push(restored)
    } else {
      trips.value[idx] = restored
    }
    // 撤销对象不是当前攻略时切过去，否则用户看不到任何变化
    if (activeTripId.value !== entry.tripId) activeTripId.value = entry.tripId
    return `已撤销：${entry.label}`
  }

  /** 从各天的 city 反推 trip.cities：去重、按首次出现顺序；extra 用于刚选入的新城。
   *  L02：城际段两端城市也要保住（否则仅作端点的城市会从 cities 消失，地图连线取不到中心）。 */
  function syncCities(trip: Trip, extra?: City) {
    const known = new Map<string, City>()
    for (const c of trip.cities) known.set(c.name, c)
    if (extra) known.set(extra.name, extra)
    const seen = new Set<string>()
    const next: City[] = []
    const add = (name?: string) => {
      const c = name ? known.get(name) : undefined
      if (c && !seen.has(c.name)) { seen.add(c.name); next.push(c) }
    }
    for (const d of trip.days) add(d.city)
    for (const leg of Object.values(trip.legs || {})) { add(leg.fromCity); add(leg.toCity) }
    trip.cities = next
  }

  /** L02：确保城市在 trip.cities 中（带 center），供城际连线/统计使用；返回该城 */
  function ensureCity(t: Trip, name: string): City | undefined {
    const hit = t.cities.find(c => c.name === name)
    if (hit) return hit
    const found = useCityStore().findCity(name)
    if (found) t.cities.push({ ...found })
    return found
  }

  /** L02：添加城际段——并入两端城市、挂到到达日并把当日主城切到到达城，合成一条快照 */
  function addLeg(input: Omit<Leg, 'id'>, dayIndex: number): Leg | null {
    const t = activeTrip.value
    const day = t?.days.find(d => d.dayIndex === dayIndex)
    if (!t || !day || !input.fromCity || !input.toCity || input.fromCity === input.toCity) return null
    beginBatch(t.id, '添加城际段')
    try {
      ensureCity(t, input.fromCity)
      ensureCity(t, input.toCity)
      const leg: Leg = { ...input, id: uid('leg') }
      t.legs[leg.id] = leg
      day.legIds.push(leg.id)
      day.city = input.toCity // 段挂在到达日：当日主城即到达城
      syncCities(t)
      touch(t)
      return leg
    } finally { endBatch() }
  }

  /** L02：改城际段；端点/到达城变化时同步当日主城与 cities，合成一条快照 */
  function updateLeg(id: string, patch: Partial<Leg>) {
    const t = activeTrip.value
    const leg = t?.legs[id]
    if (!t || !leg) return
    beginBatch(t.id, '改城际段')
    try {
      Object.assign(leg, patch)
      if (patch.fromCity) ensureCity(t, patch.fromCity)
      if (patch.toCity) {
        ensureCity(t, patch.toCity)
        for (const d of t.days) if (d.legIds.includes(id)) d.city = patch.toCity
      }
      syncCities(t)
      touch(t)
    } finally { endBatch() }
  }

  /** L02：删除城际段，并从所有日的 legIds 中摘除 */
  function removeLeg(id: string) {
    const t = activeTrip.value
    if (!t?.legs[id]) return
    snapshot(t.id, '删除城际段')
    delete t.legs[id]
    for (const d of t.days) d.legIds = d.legIds.filter(x => x !== id)
    touch(t)
  }

  /** L02：某日出发的城际段（按 legIds 顺序） */
  function legsOfDay(dayIndex: number): Leg[] {
    const t = activeTrip.value
    const day = t?.days.find(d => d.dayIndex === dayIndex)
    if (!t || !day) return []
    return day.legIds.map(id => t.legs[id]).filter((l): l is Leg => !!l)
  }

  /** O01：改某天所在城市，同步 cities 并重取该日路线 */
  function setDayCity(dayIndex: number, city: City) {
    const t = activeTrip.value
    if (!t) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    if (!day || day.city === city.name) return
    snapshot(t.id, '改城市')
    day.city = city.name
    syncCities(t, city)
    touch(t)
    void refineDay(dayIndex)
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
        legIds: [],
      })),
      pois: {},
      wishlist: [],
      segments: {},
      legs: {},
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
    // 归档/恢复必须同步维护 completedAt，否则恢复后仍被判为「已行」，回不到印记态
    if (archived) t.completedAt = Date.now()
    else delete t.completedAt
    touch(t)
  }

  function updateTrip(id: string, patch: Partial<Trip>) {
    const t = findTrip(id)
    if (!t) return
    snapshot(id, '改题名/设置')
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
    snapshot(t.id, '移出心愿池')
    t.wishlist = t.wishlist.filter(id => id !== poiId)
    touch(t)
  }
  function isWishlisted(poiId: string) { return !!activeTrip.value?.wishlist.includes(poiId) }
  function inDays(poiId: string): number[] {
    return activeTrip.value?.days.filter(d => d.poiIds.includes(poiId)).map(d => d.dayIndex) || []
  }

  /**
   * O04：增量重建。按相邻 stop 对生成段；未变化的段原样复用（含真实 path/cost/estimated=false），
   * 只删除失效段、新建新增段，仅当有新段时才补取真实路线。
   */
  function rebuildSegments(dayIndex: number) {
    const t = activeTrip.value
    if (!t) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    if (!day) return

    const stops = day.poiIds.filter(id => t.pois[id] && t.pois[id].role !== 'base')
    const desired = new Map<string, { from: string; to: string }>()
    const order: string[] = []
    for (let i = 0; i < stops.length - 1; i++) {
      const key = `${stops[i]}|${stops[i + 1]}`
      if (!desired.has(key)) { desired.set(key, { from: stops[i], to: stops[i + 1] }); order.push(key) }
    }

    // ① 失效段：端点对已不在 desired，或引用了不存在的 POI
    //    O05：pinned 段只在字典里保留（保住真实路线/走法），从当天段列表暂时摘掉，
    //    待端点对恢复时原样复活；非 pinned 段直接删除。
    const kept: string[] = []
    for (const sid of day.segmentIds) {
      const s = t.segments[sid]
      const key = s ? `${s.fromPoiId}|${s.toPoiId}` : ''
      if (s && desired.has(key) && t.pois[s.fromPoiId] && t.pois[s.toPoiId]) kept.push(sid)
      else if (s?.pinned) { /* 保留字典条目，不进 kept */ }
      else delete t.segments[sid]
    }
    day.segmentIds = kept

    // ② 复用已有段；缺失的段才新建。pinned 的历史段按端点对优先复活。
    const existing = new Map<string, string>()
    for (const sid of day.segmentIds) {
      const s = t.segments[sid]
      if (s) existing.set(`${s.fromPoiId}|${s.toPoiId}`, sid)
    }
    const pinnedByKey = new Map<string, string>()
    for (const [sid, s] of Object.entries(t.segments)) {
      if (s.pinned && t.pois[s.fromPoiId] && t.pois[s.toPoiId]) pinnedByKey.set(`${s.fromPoiId}|${s.toPoiId}`, sid)
    }
    let hasNew = false
    for (const key of order) {
      if (existing.has(key)) continue
      const revived = pinnedByKey.get(key)
      if (revived) { day.segmentIds.push(revived); continue }
      const { from, to } = desired.get(key)!
      const a = t.pois[from], b = t.pois[to]
      const e = estimate(a.location, b.location, 'walk')
      const id = uid('seg')
      t.segments[id] = {
        id, fromPoiId: from, toPoiId: to, mode: 'walk',
        durationMin: e.durationMin, distanceKm: e.distanceKm, cost: e.cost, estimated: true,
      }
      day.segmentIds.push(id)
      hasNew = true
    }

    // 保持段顺序与 stops 顺序一致
    day.segmentIds = order.map(k => existing.get(k) || day.segmentIds.find(sid => {
      const s = t.segments[sid]
      return s && `${s.fromPoiId}|${s.toPoiId}` === k
    })!).filter((sid): sid is string => !!sid)

    touch(t)
    if (hasNew) void refineDay(dayIndex)
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

  /** O05：固定/取消固定某段走法（固定后重建不再覆盖其方式与真实路线） */
  function setSegmentPinned(segmentId: string, pinned: boolean) {
    const t = activeTrip.value
    const seg = t?.segments[segmentId]
    if (!t || !seg) return
    snapshot(t.id, pinned ? '固定走法' : '取消固定')
    seg.pinned = pinned
    touch(t)
  }

  /** O05：在某交通段的两点之间插入一处经停，原段自动拆成两段 */
  function insertStopAfter(segmentId: string, poi: POI): boolean {
    const t = activeTrip.value
    const seg = t?.segments[segmentId]
    if (!t || !seg) return false
    const day = t.days.find(d => d.segmentIds.includes(segmentId))
    if (!day) return false
    const at = day.poiIds.indexOf(seg.toPoiId)
    if (at < 0) return false
    snapshot(t.id, '插入经停')
    addPoi(poi, t.id)
    day.poiIds.splice(at, 0, poi.id)
    t.wishlist = t.wishlist.filter(id => id !== poi.id)
    rebuildSegments(day.dayIndex)
    touch(t)
    return true
  }

  /** O03：设/取消驻地是一次动作，内部多次 mutation 合并为一条快照 */
  function toggleBasePoi(dayIndex: number, poiId: string) {
    const t = activeTrip.value
    const day = t?.days.find(d => d.dayIndex === dayIndex)
    if (!t || !day || !t.pois[poiId]) return
    beginBatch(t.id, day.basePoiId === poiId ? '取消驻地' : '设驻地')
    try {
      if (day.basePoiId === poiId) {
        day.basePoiId = undefined
        t.pois[poiId].role = 'stop'
      } else {
        const oldBase = day.basePoiId
        if (oldBase && t.pois[oldBase]) t.pois[oldBase].role = 'stop'
        day.basePoiId = poiId
        t.pois[poiId].role = 'base'
      }
      rebuildSegments(dayIndex)
      touch(t)
    } finally {
      endBatch()
    }
  }

  function setSegmentMode(dayIndex: number, segmentId: string, mode: TransportMode) {
    const t = activeTrip.value
    if (!t) return
    const day = t.days.find(d => d.dayIndex === dayIndex)
    const seg = t.segments[segmentId]
    if (!day || !seg) return
    const from = t.pois[seg.fromPoiId], to = t.pois[seg.toPoiId]
    const e = estimate(from.location, to.location, mode)
    snapshot(t.id, '改交通方式')
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
    snapshot(t.id, '改地点')
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
    snapshot(t.id, '落自定义点')
    addPoi(poi, t.id)
    t.wishlist.push(poi.id)
    touch(t)
    return poi
  }

  function setDayField(dayIndex: number, patch: Partial<DayPlan>) {
    const t = activeTrip.value
    const day = t?.days.find(d => d.dayIndex === dayIndex)
    if (!t || !day) return
    snapshot(t.id, '改日程')
    Object.assign(day, patch)
    touch(t)
  }
  function addDay() {
    const t = activeTrip.value
    if (!t || t.days.length >= 15) return
    snapshot(t.id, '加一天')
    const n = t.days.length + 1
    const city = t.cities[t.cities.length - 1]?.name || ''
    t.days.push({ dayIndex: n, city, title: `Day ${n} · ${city}`, departTime: '09:00', poiIds: [], segmentIds: [], legIds: [] })
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
    syncCities(t)
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
    snapshot(t.id, '改账目')
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
  /** O09：预检——只解析并列出同 ID 冲突，不改任何数据 */
  function inspectImport(json: string): ImportResult {
    try {
      const parsed = JSON.parse(json)
      const incoming: Trip[] = Array.isArray(parsed?.trips) ? parsed.trips : Array.isArray(parsed) ? parsed : []
      if (!incoming.length) return { ok: false, message: '文件中没有攻略数据', conflicts: [], added: 0, skipped: 0 }
      const known = new Set(trips.value.map(t => t.id))
      const conflicts = incoming.filter(t => t && known.has(t.id)).map(t => t.title || '未命名旅程')
      return { ok: true, message: `备份含 ${incoming.length} 份攻略，本机现有 ${trips.value.length} 份`, conflicts, added: 0, skipped: 0, total: incoming.length }
    } catch {
      return { ok: false, message: 'JSON 格式不正确', conflicts: [], added: 0, skipped: 0 }
    }
  }

  function importData(json: string, policy: ImportPolicy = 'overwrite'): ImportResult {
    try {
      const parsed = JSON.parse(json)
      const incoming: Trip[] = Array.isArray(parsed?.trips) ? parsed.trips : Array.isArray(parsed) ? parsed : []
      if (!incoming.length) return { ok: false, message: '文件中没有攻略数据', conflicts: [], added: 0, skipped: 0 }
      // 整体替换：本机数据完全以备份为准（跨设备同步的正确语义），一次可撤销
      if (policy === 'replace') {
        snapshotAll('整体替换前状态')
        const list = incoming.filter(Boolean).map(normalizeTrip)
        trips.value = list
        activeTripId.value = list.find(t => !t.archived)?.id || list[0]?.id || null
        return { ok: true, message: `已同步：本机现有 ${list.length} 份攻略，与备份完全一致`, conflicts: [], added: list.length, skipped: 0, total: list.length }
      }
      snapshot(activeTripId.value || incoming[0]?.id || '', '导入前状态')
      let added = 0, skipped = 0
      for (const item of incoming) {
        const incomingTrip = normalizeTrip(item)
        const idx = trips.value.findIndex(t => t.id === incomingTrip.id)
        if (idx >= 0) {
          if (policy === 'skip') { skipped++; continue }
          if (policy === 'clone') {
            incomingTrip.id = uid('trip')
            incomingTrip.title = `${incomingTrip.title} · 副本`
            trips.value.push(incomingTrip)
            added++
            continue
          }
          trips.value[idx] = incomingTrip
        } else {
          trips.value.push(incomingTrip)
          added++
        }
      }
      if (!activeTripId.value || !findTrip(activeTripId.value)) activeTripId.value = trips.value[0]?.id || null
      const tail = skipped ? `，跳过 ${skipped} 份` : ''
      return { ok: true, message: `已导入 ${added} 份攻略${tail}（合并模式，本机其他攻略保留）`, conflicts: [], added, skipped, total: incoming.length }
    } catch {
      return { ok: false, message: 'JSON 格式不正确', conflicts: [], added: 0, skipped: 0 }
    }
  }
  function clearAll() {
    snapshotAll('清空数据')
    trips.value = []
    activeTripId.value = null
  }

  return {
    trips, activeTripId, activeTrip, sortedTrips, activeTrips, archivedTrips, undoStack,
    findTrip, openTrip, createTrip, deleteTrip, archiveTrip, updateTrip, setDayCity, syncCities, undo,
    addLeg, updateLeg, removeLeg, legsOfDay,
    addPoi, addToWishlist, removeFromWishlist, isWishlisted, inDays,
    addToDay, removeFromDay, movePoi, reorderPoi, reorderByOrder, rebuildSegments, setSegmentMode, setSegmentPinned, insertStopAfter, toggleBasePoi, refineDay, refineTrip,
    updatePoi, addCustomPoi, setDayField, addDay, removeDay,
    addExpense, updateExpense, deleteExpense,
    addAnnotation, undoAnnotation, clearAnnotations,
    exportData, inspectImport, importData, clearAll,
  }
})
