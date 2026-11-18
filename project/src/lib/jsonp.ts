// 腾讯 WebService JSONP 封装：绕浏览器跨域，统一 199 权限检测与缓存。
// Key 只从设置面板传入（localStorage），不写入代码。
const cache = new Map<string, { at: number; data: any }>()

export class WsError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export interface JsonpOptions {
  key: string
  cacheMs?: number
  timeoutMs?: number
}

export function jsonp<T = any>(endpoint: string, params: Record<string, string | number | undefined>, opts: JsonpOptions): Promise<T> {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>
  const cacheKey = `${endpoint}?${new URLSearchParams(clean).toString()}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < (opts.cacheMs ?? 0)) return Promise.resolve(cached.data as T)

  return new Promise((resolve, reject) => {
    const cbName = `_shicheng_cb_${Math.random().toString(36).replace('.', '')}`
    const script = document.createElement('script')
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new WsError('请求超时，请检查网络'))
    }, opts.timeoutMs ?? 8000)

    function cleanup() {
      window.clearTimeout(timer)
      delete (window as any)[cbName]
      script.remove()
    }
    ;(window as any)[cbName] = (data: any) => {
      cleanup()
      if (data?.status === 199) {
        reject(new WsError('WebService 权限未开通或 Key 无效', 199))
        return
      }
      if (data?.status && data.status !== 0) {
        reject(new WsError(data.message || `服务返回 ${data.status}`, data.status))
        return
      }
      if (opts.cacheMs) cache.set(cacheKey, { at: Date.now(), data })
      resolve(data as T)
    }
    const query = new URLSearchParams({ ...clean, output: 'jsonp', callback: cbName, key: opts.key }).toString()
    script.src = `${endpoint}?${query}`
    script.onerror = () => { cleanup(); reject(new WsError('网络请求失败')) }
    document.head.appendChild(script)
  })
}

export function searchSuggestion(keyword: string, region: string, key: string) {
  return jsonp('https://apis.map.qq.com/ws/place/v1/suggestion', { keyword, region, region_fix: 1, pageSize: 20 }, { key, cacheMs: 1000 * 60 * 60 * 24 })
}

export function searchPlace(keyword: string, region: string, key: string, category?: string) {
  return jsonp('https://apis.map.qq.com/ws/place/v1/search', {
    keyword, boundary: `region(${region},0)`, page_size: 20, ...(category ? { category } : {}),
  }, { key, cacheMs: 1000 * 60 * 60 * 24 })
}

export function route(mode: 'driving' | 'walking' | 'bicycling' | 'transit', from: string, to: string, key: string, city?: string) {
  return jsonp(`https://apis.map.qq.com/ws/direction/v1/${mode}`, {
    from, to, ...(city && mode === 'transit' ? { city } : {}),
  }, { key, cacheMs: 1000 * 60 * 60 * 6 })
}

export function reverseGeocode(lat: number, lng: number, key: string) {
  return jsonp('https://apis.map.qq.com/ws/geocoder/v1', { location: `${lat},${lng}` }, { key, cacheMs: 1000 * 60 * 60 * 24 })
}
