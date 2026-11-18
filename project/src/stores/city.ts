import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { City, POI, POICategory } from '../types'
import { SEED_CITIES, SEED_POIS } from '../seed'
import { searchPlace, searchSuggestion, reverseGeocode, WsError } from '../lib/jsonp'
import { useUiStore } from './ui'

interface TencentPlace {
  id?: string
  title?: string
  name?: string
  address?: string
  category?: string
  latitude?: number
  longitude?: number
  location?: { lat: number; lng: number }
  rating?: number
  average_price?: number
}

function parseLocation(p: TencentPlace): { lat: number; lng: number } | null {
  const loc: any = p.location
  if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') return { lat: loc.lat, lng: loc.lng }
  if (typeof loc === 'string' && loc.includes(',')) {
    const [a, b] = loc.split(',').map(Number)
    if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b }
  }
  if (p.latitude !== undefined && p.longitude !== undefined) return { lat: p.latitude, lng: p.longitude }
  return null
}

function normalize(p: TencentPlace, city: string, category?: POICategory): POI | null {
  const loc = parseLocation(p)
  if (!loc) return null
  const cat: POICategory = category || (/酒店|客栈|宾馆|民宿/.test(p.category || '') ? 'hotel'
    : /美食|餐厅|咖啡|小吃/.test(p.category || '') ? 'food'
      : /购物|商场|超市/.test(p.category || '') ? 'shop' : 'sight')
  return {
    id: `api-${p.id || `${p.title || p.name}-${loc.lat}-${loc.lng}`}`,
    name: p.title || p.name || '未命名地点',
    category: cat,
    role: cat === 'hotel' ? 'base' : 'stop',
    location: { lng: loc.lng, lat: loc.lat },
    address: p.address,
    city,
    rating: p.rating,
    pricePerPerson: p.average_price,
    tags: p.category ? [p.category.split(':').pop() || '地点'] : [],
    source: 'api',
    poiId: p.id,
  }
}

export const useCityStore = defineStore('city', () => {
  const cities = ref<City[]>(SEED_CITIES)
  const hotCache = ref<Record<string, POI[]>>(loadHot())
  const quotaExceeded = ref(false)

  function loadHot(): Record<string, POI[]> {
    try {
      const raw = localStorage.getItem('shicheng:hot')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }
  function persistHot() {
    try { localStorage.setItem('shicheng:hot', JSON.stringify(hotCache.value)) } catch { /* ignore */ }
  }

  function searchCities(keyword: string): City[] {
    const kw = keyword.trim()
    if (!kw) return cities.value.slice(0, 12)
    return cities.value.filter(c => c.name.includes(kw) || c.province.includes(kw)).slice(0, 20)
  }
  function findCity(name: string): City | undefined {
    return cities.value.find(c => c.name === name) || cities.value.find(c => name.includes(c.name))
  }

  async function hotPois(city: string, category: POICategory, key?: string): Promise<{ list: POI[]; live: boolean }> {
    const cacheKey = `${city}:${category}`
    const cached = hotCache.value[cacheKey]
    const cachedLive = !!cached?.some(p => p.source === 'api')
    if (cached && (cachedLive || !key)) return { list: cached, live: cachedLive }
    const seed = SEED_POIS[city]?.filter(p => p.category === category) || []
    if (!key) return { list: seed, live: false }
    try {
      const keyword = { sight: '景点', food: '美食', hotel: '酒店', shop: '购物', custom: '' }[category]
      const res: any = await searchPlace(keyword, city, key)
      const raw = res?.data || res?.result?.data || []
      const list = (Array.isArray(raw) ? raw : []).map((p: TencentPlace) => normalize(p, city, category)).filter(Boolean) as POI[]
      if (!list.length) return { list: seed, live: false }
      hotCache.value[cacheKey] = list
      persistHot()
      return { list, live: true }
    } catch (err) {
      if (err instanceof WsError && err.status === 199) {
        quotaExceeded.value = true
        useUiStore().notifyKeyGuide()
      }
      return { list: seed, live: false }
    }
  }

  async function searchPoi(keyword: string, city: string, key?: string): Promise<{ list: POI[]; live: boolean }> {
    const kw = keyword.trim()
    if (!kw) return { list: [], live: false }
    const local = (SEED_POIS[city] || []).filter(p => p.name.includes(kw) || (p.address || '').includes(kw))
    if (!key) return { list: local, live: false }
    try {
      const res: any = await searchSuggestion(kw, city, key)
      const raw = res?.data || res?.result?.data || []
      const list = (Array.isArray(raw) ? raw : []).map((p: TencentPlace) => normalize(p, city)).filter(Boolean) as POI[]
      if (!list.length) return { list: local, live: false }
      return { list: list.slice(0, 20), live: true }
    } catch (err) {
      if (err instanceof WsError && err.status === 199) {
        quotaExceeded.value = true
        useUiStore().notifyKeyGuide()
      }
      return { list: local, live: false }
    }
  }

  async function addressOf(location: { lat: number; lng: number }, key?: string): Promise<string> {
    if (!key) return ''
    try {
      const res: any = await reverseGeocode(location.lat, location.lng, key)
      return res?.result?.address || ''
    } catch { return '' }
  }

  return { cities, hotCache, quotaExceeded, searchCities, findCity, hotPois, searchPoi, addressOf }
})
