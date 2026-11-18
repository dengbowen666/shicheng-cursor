import type { LngLat, TransportMode } from '../types'

/** 行动层：移动端 qqmap:// 唤起腾讯地图 App，Web 端降级 URI 路线页。 */
export function launchNavigation(name: string, to: LngLat, key?: string, mode: TransportMode = 'taxi') {
  const typeMap: Record<TransportMode, string> = { taxi: 'drive', walk: 'walk', bike: 'bike', transit: 'bus' }
  const t = typeMap[mode]
  const toCoord = `${to.lat},${to.lng}`
  const appUri = `qqmap://map/routeplan?type=${t}&from=我的位置&fromcoord=CurrentLocation&to=${encodeURIComponent(name)}&tocoord=${toCoord}${key ? `&referer=${encodeURIComponent(key)}` : ''}`
  const webUri = `https://apis.map.qq.com/uri/v1/routeplan?type=${t}&from=我的位置&fromcoord=CurrentLocation&to=${encodeURIComponent(name)}&tocoord=${toCoord}&policy=0&referer=shicheng`
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  if (!isMobile) { window.open(webUri, '_blank', 'noopener'); return }
  let hidden = false
  const onHide = () => { hidden = true }
  document.addEventListener('visibilitychange', onHide)
  window.location.href = appUri
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide)
    if (!hidden) window.open(webUri, '_blank', 'noopener')
  }, 1200)
}

export function routeUrl(name: string, to: LngLat, mode: TransportMode = 'taxi') {
  const t = { taxi: 'drive', walk: 'walk', bike: 'bike', transit: 'bus' }[mode]
  return `https://apis.map.qq.com/uri/v1/routeplan?type=${t}&from=我的位置&fromcoord=CurrentLocation&to=${encodeURIComponent(name)}&tocoord=${to.lat},${to.lng}&referer=shicheng`
}
