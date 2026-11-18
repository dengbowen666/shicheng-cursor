import type { LngLat } from '../types'

export interface MapBounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
  cos: number
  spanX: number
  spanY: number
}

/** 降级底图的线性投影：按 cos(纬度) 修正，并撑到与画布同比例，避免图形失真与留白。 */
export function fitBounds(points: LngLat[], width: number, height: number, padding = 1.34, minSpan = 0.012): MapBounds {
  if (!points.length) {
    points = [{ lng: 100, lat: 25 }]
  }
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const p of points) {
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng)
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
  }
  const midLat = (minLat + maxLat) / 2
  const cos = Math.cos((midLat * Math.PI) / 180)
  let spanX = Math.max(maxLng - minLng, minSpan) * cos * padding
  let spanY = Math.max(maxLat - minLat, minSpan) * padding
  const aspect = width / height
  if (spanX / spanY > aspect) spanY = spanX / aspect
  else spanX = spanY * aspect
  const cx = (minLng + maxLng) / 2, cy = (minLat + maxLat) / 2
  return {
    minLng: cx - spanX / cos / 2, maxLng: cx + spanX / cos / 2,
    minLat: cy - spanY / 2, maxLat: cy + spanY / 2,
    cos, spanX, spanY,
  }
}

export function project(p: LngLat, b: MapBounds, width: number, height: number) {
  return {
    x: (((p.lng - b.minLng) * b.cos) / b.spanX) * width,
    y: ((b.maxLat - p.lat) / b.spanY) * height,
  }
}

export function unproject(x: number, y: number, b: MapBounds, width: number, height: number): LngLat {
  return {
    lng: b.minLng + (x / width) * b.spanX / b.cos,
    lat: b.maxLat - (y / height) * b.spanY,
  }
}

/** 以同一中心放大视野，给拖拽/缩小留出瓦片缓冲，避免侧边露纸色。 */
export function expandBounds(b: MapBounds, factor: number): MapBounds {
  const f = Math.max(1, factor)
  const cx = (b.minLng + b.maxLng) / 2
  const cy = (b.minLat + b.maxLat) / 2
  const spanX = b.spanX * f
  const spanY = b.spanY * f
  return {
    minLng: cx - spanX / b.cos / 2,
    maxLng: cx + spanX / b.cos / 2,
    minLat: cy - spanY / 2,
    maxLat: cy + spanY / 2,
    cos: b.cos,
    spanX,
    spanY,
  }
}

/** 腾讯 GL 当前视野 → 与瓦片对齐的线性投影框（印章必须跟建筑落在同一套经纬度上） */
export function boundsFromCorners(sw: LngLat, ne: LngLat): MapBounds {
  const minLng = sw.lng
  const maxLng = ne.lng
  const minLat = sw.lat
  const maxLat = ne.lat
  const midLat = (minLat + maxLat) / 2
  const cos = Math.cos((midLat * Math.PI) / 180)
  return {
    minLng, maxLng, minLat, maxLat, cos,
    spanX: Math.max(1e-9, maxLng - minLng) * cos,
    spanY: Math.max(1e-9, maxLat - minLat),
  }
}
