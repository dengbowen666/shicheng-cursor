import type { DayPlan, POI, TimelineEntry, TransportSegment, Expense } from '../types'
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
): TimelineEntry[] {
  const out: TimelineEntry[] = []
  if (prevCity && prevCity !== day.city) {
    out.push({ kind: 'divider', label: `翌日 · 赴${day.city}` })
  }
  let t = toMin(day.departTime || '09:00')
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

export function dayStats(day: DayPlan, pois: Record<string, POI>, segments: Record<string, TransportSegment>) {
  const stops = day.poiIds.filter(id => !!pois[id])
  const travelMin = day.segmentIds.reduce((s, id) => s + (segments[id]?.durationMin || 0), 0)
  const timeline = deriveDay(day, pois, segments)
  const lastPoi = [...timeline].reverse().find(e => e.kind === 'poi') as Extract<TimelineEntry, { kind: 'poi' }> | undefined
  const endMin = lastPoi ? toMin(lastPoi.leave) : toMin(day.departTime || '09:00')
  return { stopCount: stops.length, travelMin, endMin, endTime: fmt(endMin) }
}

export { fmt as formatMinute }
