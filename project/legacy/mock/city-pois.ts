import type { POI } from '../types'
import raw from './cities-poi.json'

// 城市封面图（Unsplash 真实城市风景直链）
const CITY_COVER: Record<string, string> = {
  成都: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=1200&q=80',
  杭州: 'https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=1200&q=80',
  西安: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=1200&q=80',
  重庆: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200&q=80',
  厦门: 'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=1200&q=80',
  北京: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1200&q=80',
  昆明: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1200&q=80',
  大理: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&q=80',
  丽江: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=1200&q=80',
}

const POI_COVER = [
  'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&q=80',
  'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80',
  'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80',
  'https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&q=80',
]

export function cityCover(city: string): string {
  return CITY_COVER[city] || 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80'
}

// 把采集的 JSON 转成 POI（含变体：每个景区派生出"附近美食""附近住宿"建议由用户搜索）
let seq = 0
function toPOIs(city: string, list: any[]): POI[] {
  return list.map((item, i) => {
    seq++
    return {
      id: `poi-${city}-${i}`,
      name: item.name,
      shortName: item.name.replace(/(风景名胜区|博物馆|景区|公园|步行街|古镇|古街|观景平台)/g, '').slice(0, 6) || item.name.slice(0, 4),
      category: 'sight',
      city: city as POI['city'],
      lat: item.lat,
      lng: item.lng,
      address: item.address,
      tags: ['热门景点'],
      coverImage: POI_COVER[i % POI_COVER.length],
      intro: item.intro,
      rating: Math.round((4.3 + (i % 5) * 0.12) * 10) / 10,
      poiId: item.poiId,
      source: 'local',
    }
  })
}

const rawMap = raw as Record<string, any[]>

export const CITY_POIS: Record<string, POI[]> = Object.fromEntries(
  Object.entries(rawMap).map(([city, list]) => [city, toPOIs(city, list)]),
)

export function getCityPOIs(city: string): POI[] {
  return CITY_POIS[city] || []
}

export function hasCityData(city: string): boolean {
  return !!CITY_POIS[city]?.length
}
