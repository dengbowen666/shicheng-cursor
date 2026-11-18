import type { LngLat, TransportMode } from '../types'

/** 无 Key 时的经验速度（设计文档 §6.6） */
export const SPEED: Record<'walk' | 'bike' | 'taxi' | 'transit', number> = {
  walk: 4.5,
  bike: 12,
  taxi: 30,
  transit: 18,
}

export const DEFAULT_STAY: Record<string, number> = {
  sight: 90,
  food: 60,
  shop: 60,
  custom: 30,
  hotel: 0, // 驻地锚点不占白天时段
}

/** GCJ-02 短距平面近似，返回公里 */
export function haversineFlat(from: LngLat, to: LngLat): number {
  const dx = (to.lng - from.lng) * 111.32 * Math.cos(((from.lat + to.lat) / 2) * Math.PI / 180)
  const dy = (to.lat - from.lat) * 110.57
  return Math.sqrt(dx * dx + dy * dy)
}

export interface EstimateResult {
  durationMin: number
  distanceKm: number
  cost?: number
  estimated: boolean
}

/** 直线×经验速度估算。transit 无 Key 不估，durationMin 为 0 并由界面提示需 Key。 */
export function estimate(from: LngLat, to: LngLat, mode: TransportMode): EstimateResult {
  const d = haversineFlat(from, to)
  if (mode === 'transit') return { durationMin: 0, distanceKm: Math.round(d * 10) / 10, estimated: true }
  const durationMin = mode === 'taxi'
    ? Math.ceil((d / SPEED.taxi) * 60) + 5
    : Math.ceil((d / SPEED[mode]) * 60)
  return {
    durationMin: Math.max(1, durationMin),
    distanceKm: Math.round(d * 10) / 10,
    cost: mode === 'taxi' ? Math.max(8, Math.round(d * 2.4)) : undefined,
    estimated: true,
  }
}

/** 智能推荐：<800m 步行，800m–3km 步行/骑行，>3km 打车；步行超 40 分钟预警（D21） */
export function recommendMode(km: number): { mode: TransportMode; warning?: string } {
  if (km < 0.8) return { mode: 'walk' }
  if (km <= 3) {
    const walkMin = Math.ceil((km / SPEED.walk) * 60)
    return walkMin > 40 ? { mode: 'bike', warning: `步行约 ${walkMin} 分钟，建议骑行或打车` } : { mode: 'walk' }
  }
  return { mode: 'taxi' }
}

export const SMART_THRESHOLD = {
  overloadPoiCount: 8,
  overloadTravelMin: 180,
  underloadEndHour: 15,
  nearWalkMin: 40,
}
