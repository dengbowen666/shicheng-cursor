import type { LngLat, TransportMode } from '../types'
import { route } from './jsonp'

/**
 * 真实路径规划：把腾讯 WebService 的压缩坐标还原成可绘制折线。
 * 有 Key 时用它替换「直线 × 经验速度」的估算，线段、耗时、费用同步变成真实值。
 */

export interface RouteResult {
  distanceKm: number
  durationMin: number
  cost?: number
  path: LngLat[]
  lineNos?: string[]
  transferCount?: number
}

const API_MODE: Record<TransportMode, 'driving' | 'walking' | 'bicycling' | 'transit'> = {
  taxi: 'driving',
  walk: 'walking',
  bike: 'bicycling',
  transit: 'transit',
}

/**
 * 腾讯压缩坐标串：首个点为绝对经纬度，其后每两个数为相对前一点的差值（1e-6 度）。
 * 已用真实响应校验：末点与目的地误差约 10 米；(0,0) 表示重复点，直接跳过。
 */
export function decodePolyline(raw: number[]): LngLat[] {
  if (!raw || raw.length < 2) return []
  const out: LngLat[] = [{ lat: raw[0], lng: raw[1] }]
  let lat = raw[0]
  let lng = raw[1]
  for (let i = 2; i < raw.length - 1; i += 2) {
    lat = Math.round((lat + raw[i] / 1e6) * 1e6) / 1e6
    lng = Math.round((lng + raw[i + 1] / 1e6) * 1e6) / 1e6
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev.lat - lat) < 1e-7 && Math.abs(prev.lng - lng) < 1e-7) continue
    out.push({ lat, lng })
  }
  return out
}

export async function fetchRoute(
  key: string,
  mode: TransportMode,
  from: LngLat,
  to: LngLat,
  city?: string,
): Promise<RouteResult | null> {
  if (!key) return null
  const api = API_MODE[mode]
  const res = await route(api, `${from.lat},${from.lng}`, `${to.lat},${to.lng}`, key, city)
  const r: any = res?.result?.routes?.[0]
  if (!r) return null

  let path: LngLat[] = []
  let lineNos: string[] | undefined
  let transferCount: number | undefined
  if (api === 'transit') {
    const nos: string[] = []
    for (const step of r.steps || []) {
      path.push(...decodePolyline(step.polyline || []))
      // 公交步骤常见字段：lines[].title / vehicle.title / mode=TRANSIT
      const lines = step.lines || step.transit?.lines || []
      for (const line of lines) {
        const title = line.title || line.name || line.vehicle?.title
        if (title && !nos.includes(title)) nos.push(String(title).replace(/公交|地铁/g, '').trim() || String(title))
      }
      if (!lines.length && step.mode === 'TRANSIT' && step.title) nos.push(String(step.title))
    }
    if (nos.length) lineNos = nos.slice(0, 4)
    transferCount = Math.max(0, (r.steps || []).filter((s: any) => s.mode === 'TRANSIT' || s.lines?.length).length - 1)
  } else {
    path = decodePolyline(r.polyline || [])
  }
  // 相邻重复点会让线宽渲染发毛，先清一遍
  path = path.filter((p, i) => i === 0
    || Math.abs(p.lat - path[i - 1].lat) > 1e-6
    || Math.abs(p.lng - path[i - 1].lng) > 1e-6)

  const distanceKm = Math.max(0.1, Math.round((r.distance || 0) / 100) / 10)
  const durationMin = Math.max(1, Math.round(r.duration || 0))
  // 打车费用服务不返回，仍按 2.4 元/公里估；公交取接口票价（分）
  const cost = mode === 'taxi'
    ? Math.max(8, Math.round(distanceKm * 2.4))
    : api === 'transit' && r.price
      ? Math.round(r.price / 100)
      : undefined

  return { distanceKm, durationMin, cost, path, lineNos, transferCount }
}
