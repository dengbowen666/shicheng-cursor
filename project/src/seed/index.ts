// 构建期种子数据入口。三城种子由腾讯位置服务连接器实采，source:'seed'；
// 其余城市从已采集的 7 城快照转入，仅作「无 Key 演示数据」，运行时不限制搜索任意城市。
import type { City, DailyWeather, POI, Trip, TransportMode, TransportSegment } from '../types'
import { PRESET_CITIES } from '../data/cities'
import { daliRaw } from './dali'
import { lijiangRaw } from './lijiang'
import { beijingRaw } from './beijing'
import type { RawPOI } from './raw'
import cityPoiRaw from '../mock/cities-poi.json'

const COVERS: Record<string, string> = {
  sight: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&q=70',
  food: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=70',
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=70',
  shop: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=70',
  custom: '',
}

export function rawToPoi(r: RawPOI, city: string, prefix: string): POI {
  return {
    id: `${prefix}-${r.poiId}`,
    name: r.name,
    category: r.category,
    role: r.role || 'stop',
    location: { lng: r.lng, lat: r.lat },
    address: r.address,
    city,
    rating: r.rating,
    pricePerPerson: r.pricePerPerson,
    openTime: r.openTime,
    tags: r.tags || [],
    coverImage: COVERS[r.category],
    intro: r.intro,
    stayMinutes: r.stayMinutes,
    source: 'seed',
    poiId: r.poiId,
  }
}

const extra: Record<string, POI[]> = {}
for (const [city, list] of Object.entries(cityPoiRaw as Record<string, any[]>)) {
  if (['大理', '丽江', '北京'].includes(city)) continue
  extra[city] = list.map((item, i) => ({
    id: `seed-${city}-${item.poiId || i}`,
    name: item.name,
    category: 'sight' as const,
    role: 'stop' as const,
    location: { lng: item.lng, lat: item.lat },
    address: item.address,
    city,
    rating: 4.5 + (i % 4) * 0.1,
    pricePerPerson: 0,
    tags: ['热门景点'],
    intro: item.intro,
    stayMinutes: 90,
    source: 'seed' as const,
    poiId: item.poiId,
  }))
}

export const SEED_POIS: Record<string, POI[]> = {
  大理: daliRaw.map(r => rawToPoi(r, '大理', 'seed-dali')),
  丽江: lijiangRaw.map(r => rawToPoi(r, '丽江', 'seed-lijiang')),
  北京: beijingRaw.map(r => rawToPoi(r, '北京', 'seed-beijing')),
  ...extra,
}

export const SEED_CITIES: City[] = PRESET_CITIES

export function findCity(name: string): City | undefined {
  return PRESET_CITIES.find(c => c.name === name || name.includes(c.name))
}

export function getSeedPois(city: string, category?: POI['category']): POI[] {
  const list = SEED_POIS[city] || []
  return category ? list.filter(p => p.category === category) : list
}

// ============ 种子天气（实采自腾讯天气接口，配诗句与穿衣建议） ============
function wx(date: string, text: string, code: number, max: number, min: number): DailyWeather {
  const advice = max >= 28 ? '短袖防晒' : max >= 18 ? '薄外套即可' : max >= 10 ? '夹衣加薄毛衣' : max >= 3 ? '薄羽绒加围巾' : '厚羽绒保暖'
  const poem: Record<string, string> = { 晴: '水光潋滟晴方好', 多云: '云淡风轻近午天', 阴: '山色空蒙雨亦奇', 雨: '沾衣欲湿杏花雨', 雪: '晚来天欲雪，能饮一杯无' }
  return { date, code, text, poem: poem[text] || '山色空蒙雨亦奇', tempMax: max, tempMin: min, advice }
}

export const SEED_WEATHER: Record<string, DailyWeather[]> = {
  大理: [
    wx('2026-11-16', '多云', 2, 23, 8), wx('2026-11-17', '多云', 2, 23, 8),
    wx('2026-11-18', '多云', 2, 24, 8), wx('2026-11-19', '晴', 0, 24, 8), wx('2026-11-20', '多云', 2, 23, 8),
  ],
  丽江: [
    wx('2026-11-16', '多云', 2, 18, 2), wx('2026-11-17', '多云', 2, 18, 2),
    wx('2026-11-18', '多云', 2, 19, 2), wx('2026-11-19', '晴', 0, 19, 2), wx('2026-11-20', '多云', 2, 19, 2),
  ],
  北京: [
    wx('2026-11-16', '阴', 3, 9, 1), wx('2026-11-17', '阴', 3, 9, 1),
    wx('2026-11-18', '晴', 0, 6, -1), wx('2026-11-19', '晴', 0, 6, -2), wx('2026-11-20', '多云', 2, 6, -2),
  ],
  成都: [
    wx('2026-11-17', '多云', 2, 17, 10), wx('2026-11-18', '多云', 2, 17, 7),
    wx('2026-11-19', '多云', 2, 17, 6), wx('2026-11-20', '晴', 0, 20, 7),
  ],
}

export const MONTH_CLIMATE: Record<number, string> = {
  1: '北方干冷、南方湿冷，早晚温差大', 2: '春寒料峭，注意倒春寒', 3: '南方多雨，北方风沙渐起',
  4: '气候宜人，适合踏青', 5: '初夏微热，雨水增多', 6: '梅雨与暑热交替', 7: '高温多雨，注意防晒补水',
  8: '暑热未退，午后雷阵雨多', 9: '秋高气爽，昼夜温差拉开', 10: '秋色正好，山区早晚偏凉',
  11: '深秋转冷，北方需保暖', 12: '寒冬初至，注意结冰与大风',
}

// ============ 开箱示例：大理 → 丽江 5 日 ============
function byName(city: string, name: string): POI {
  const hit = getSeedPois(city).find(p => p.name === name || p.name.includes(name))
  if (!hit) throw new Error(`种子 POI 缺失: ${city}/${name}`)
  return { ...hit }
}

function seg(id: string, from: POI, to: POI, mode: TransportMode): TransportSegment {
  const d = Math.hypot((from.location.lng - to.location.lng) * 96, (from.location.lat - to.location.lat) * 111)
  const speed = { walk: 4.5, bike: 12, taxi: 30, transit: 18 }[mode]
  return {
    id,
    fromPoiId: from.id,
    toPoiId: to.id,
    mode,
    durationMin: Math.max(4, Math.ceil((d / speed) * 60) + (mode === 'taxi' ? 5 : 0)),
    distanceKm: Math.round(d * 10) / 10,
    cost: mode === 'taxi' ? Math.max(8, Math.round(d * 2.4)) : undefined,
    estimated: true,
  }
}

export function makeDemoTrip(): Trip {
  const dali = findCity('大理')!
  const lijiang = findCity('丽江')!
  const names1 = ['大理古城观园客栈', '崇圣寺三塔', '大理古城', '陈氏海稍鱼古城店']
  const names2 = ['才村码头', '洱海生态廊道(才村码头服务站)', '喜洲古镇']
  const names3 = ['双廊古镇', '洱海景区']
  const names4 = ['丽江古城老院客栈', '丽江古城', '大水车', '88号小吃店']
  const names5 = ['白沙古镇', '束河古镇', '玉龙雪山', '蓝月谷']
  const poiMap: Record<string, POI> = {}
  const collect = (city: string, names: string[]) => names.map(n => { const p = byName(city, n); poiMap[p.id] = p; return p })
  const d1 = collect('大理', names1)
  const d2 = collect('大理', names2)
  const d3 = collect('大理', names3)
  const d4 = collect('丽江', names4)
  const d5 = collect('丽江', names5)

  const segments: Record<string, TransportSegment> = {}
  const link = (prefix: string, list: POI[], modes: TransportMode[]) => list.slice(0, -1).map((p, i) => {
    const s = seg(`${prefix}-${i}`, p, list[i + 1], modes[i] || 'walk')
    segments[s.id] = s
    return s.id
  })

  const day = (n: number, city: City, list: POI[], ids: string[], depart = '09:00') => ({
    dayIndex: n, city: city.name, title: `Day ${n} · ${city.name}`,
    date: `2026-11-${String(15 + n).padStart(2, '0')}`, departTime: depart,
    poiIds: ids, basePoiId: list.find(p => p.role === 'base')?.id, segmentIds: ids.slice(0, -1).map((_, i) => `${prefixOf(n)}-${i}`),
    weather: SEED_WEATHER[city.name]?.[n - 1] || SEED_WEATHER[city.name]?.[0],
  })
  const prefixOf = (n: number) => `demo-d${n}`

  const days = [
    day(1, dali, d1, d1.map(p => p.id)),
    day(2, dali, d2, d2.map(p => p.id)),
    day(3, dali, d3, d3.map(p => p.id)),
    day(4, lijiang, d4, d4.map(p => p.id)),
    day(5, lijiang, d5, d5.map(p => p.id)),
  ]
  link(prefixOf(1), d1, ['walk', 'taxi', 'walk'])
  link(prefixOf(2), d2, ['taxi', 'bike'])
  link(prefixOf(3), d3, ['taxi'])
  link(prefixOf(4), d4, ['walk', 'walk', 'walk'])
  link(prefixOf(5), d5, ['taxi', 'taxi', 'taxi'])

  const now = Date.now()
  return {
    id: 'demo-dali-lijiang',
    title: '大理 · 丽江 5日',
    sealText: '远游',
    cities: [dali, lijiang],
    startDate: '2026-11-16',
    days,
    pois: poiMap,
    wishlist: [
      getSeedPois('大理').find(p => p.name.includes('初心客栈'))?.id,
      getSeedPois('丽江').find(p => p.name.includes('小时光客栈'))?.id,
    ].filter(Boolean) as string[],
    segments,
    expenses: [
      { id: 'demo-exp-1', dayIndex: 1, date: '2026-11-16', amount: 48000, category: '住宿', title: '古城观园客栈', createdAt: now },
      { id: 'demo-exp-2', dayIndex: 1, date: '2026-11-16', amount: 15000, category: '门票', title: '崇圣寺三塔', createdAt: now },
      { id: 'demo-exp-3', dayIndex: 2, date: '2026-11-17', amount: 6800, category: '餐饮', title: '洱海边午餐', createdAt: now },
      { id: 'demo-exp-4', dayIndex: 2, date: '2026-11-17', amount: 6000, category: '交通', title: '打车前往喜洲', createdAt: now },
    ],
    annotations: [],
    totalBudget: 300000,
    coverImage: '',
    archived: false,
    createdAt: now - 86400000 * 5,
    updatedAt: now,
    openedAt: now,
  }
}
