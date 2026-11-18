import type { DayPlan, POI, TimelineEntry, TransportSegment, Expense, Leg } from '../types'
import { DEFAULT_STAY } from './estimate'

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
function fmt(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 设计文档 §6.6：交通段 → 到达 → 停留 → 离开，逐点串联；驻地不占白天时段。 */
export function deriveDay(
  day: DayPlan,
  pois: Record<string, POI>,
  segments: Record<string, TransportSegment>,
  expenses: Expense[] = [],
  prevCity?: string,
  legs: Record<string, Leg> = {},
): TimelineEntry[] {
  const out: TimelineEntry[] = []
  // L03：本日城际段作为真实条目排在行程开篇；有段时不再重复渲染旧 divider 文案
  const dayLegs = (day.legIds || []).map(id => legs[id]).filter((l): l is Leg => !!l)
  if (!dayLegs.length && prevCity && prevCity !== day.city) {
    out.push({ kind: 'divider', label: `翌日 · 赴${day.city}` })
  }
  let t = toMin(day.departTime || '09:00')
  for (const leg of dayLegs) {
    if (leg.departTime) t = toMin(leg.departTime)
    const arrive = leg.arriveTime ? toMin(leg.arriveTime) : t + (leg.durationMin || 0)
    out.push({ kind: 'leg', legId: leg.id, time: fmt(t), arrive: fmt(arrive) })
    // 到达时刻成为后续市内行程的起点
    t = arrive
  }
  const stops = day.poiIds.filter(id => pois[id] && pois[id].role !== 'base')
  let prev: string | null = null
  for (const poiId of stops) {
    const poi = pois[poiId]
    const seg = prev
      ? day.segmentIds.map(id => segments[id]).find(s => s && s.fromPoiId === prev && s.toPoiId === poiId)
      : undefined
    if (seg) {
      t += seg.durationMin || 0
      out.push({ kind: 'move', time: fmt(t), segmentId: seg.id })
    }
    const arrive = fmt(t)
    const stay = poi.stayMinutes ?? DEFAULT_STAY[poi.category] ?? 60
    t += stay
    out.push({ kind: 'poi', time: arrive, poiId, arrive, leave: fmt(t) })
    prev = poiId
  }
  if (day.basePoiId && pois[day.basePoiId]) {
    out.push({ kind: 'stay', label: `宿 · ${pois[day.basePoiId].name}` })
  }
  for (const e of expenses.filter(x => x.dayIndex === day.dayIndex)) {
    out.push({ kind: 'expense', expenseId: e.id })
  }
  return out
}

export function dayStats(day: DayPlan, pois: Record<string, POI>, segments: Record<string, TransportSegment>, legs: Record<string, Leg> = {}) {
  const stops = day.poiIds.filter(id => !!pois[id] && pois[id].role !== 'base')
  const cityTravelMin = (day.legIds || []).reduce((s, id) => {
    const l = legs[id]
    if (!l) return s
    // 优先用显式时长，否则用发到差
    if (l.durationMin) return s + l.durationMin
    if (l.departTime && l.arriveTime) return s + Math.max(0, toMin(l.arriveTime) - toMin(l.departTime))
    return s
  }, 0)
  const travelMin = day.segmentIds.reduce((s, id) => s + (segments[id]?.durationMin || 0), 0) + cityTravelMin
  const cityCost = (day.legIds || []).reduce((s, id) => s + (legs[id]?.cost || 0), 0)
  const timeline = deriveDay(day, pois, segments, [], undefined, legs)
  const lastPoi = [...timeline].reverse().find(e => e.kind === 'poi') as Extract<TimelineEntry, { kind: 'poi' }> | undefined
  const endMin = lastPoi ? toMin(lastPoi.leave) : toMin(day.departTime || '09:00')
  return { stopCount: stops.length, travelMin, cityTravelMin, cityCost, endMin, endTime: fmt(endMin) }
}

export { fmt as formatMinute }
