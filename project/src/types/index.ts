// 拾程 v4.1 数据模型（设计文档 §6.3）
// 坐标系纪律：腾讯系 POI / 路线 / 地图交互统一 GCJ-02；天气仅按城市中心请求 Open-Meteo WGS-84。

export interface LngLat { lng: number; lat: number }

export type POICategory = 'food' | 'hotel' | 'sight' | 'shop' | 'custom'
export type PoiRole = 'stop' | 'base' // stop=途经点，base=驻地锚点（D29）
export type PoiSource = 'api' | 'seed' | 'custom'

export interface POI {
  id: string
  name: string
  category: POICategory
  role: PoiRole
  location: LngLat // GCJ-02
  address?: string
  city: string
  rating?: number
  pricePerPerson?: number
  openTime?: string
  tags: string[]
  coverImage?: string
  intro?: string
  stayMinutes?: number
  visitedAt?: number
  note?: string
  source: PoiSource
  poiId?: string
}

export type TransportMode = 'walk' | 'taxi' | 'transit' | 'bike'

export interface TransportSegment {
  id: string
  fromPoiId: string
  toPoiId: string
  mode: TransportMode
  durationMin: number
  distanceKm?: number
  cost?: number
  lineNos?: string[]
  transferCount?: number
  path?: LngLat[]
  estimated: boolean // true=直线×经验速度估算，界面标朱砂「估」
}

export interface DailyWeather {
  date: string
  code: number
  text: string
  poem?: string
  tempMax: number
  tempMin: number
  advice: string
}

export interface DayPlan {
  dayIndex: number
  date?: string
  city: string
  title: string
  departTime?: string
  poiIds: string[]
  basePoiId?: string
  segmentIds: string[]
  weather?: DailyWeather
}

export type ExpenseCategory = '餐饮' | '住宿' | '交通' | '门票' | '购物' | '其他'

export interface Expense {
  id: string
  dayIndex: number
  date?: string
  amount: number // 分，避免浮点误差
  category: ExpenseCategory
  title: string
  poiId?: string
  note?: string
  createdAt: number
}

export interface City {
  id: string
  name: string
  province: string
  center: LngLat
  adcode?: string
}

export interface InkStroke {
  id: string
  points: LngLat[]
  screenPoints?: { x: number; y: number }[]
  viewCenter?: LngLat
  color: '#A64834'
  width: number
  createdAt: number
}

export interface Trip {
  id: string
  title: string
  sealText: string
  cities: City[]
  startDate?: string
  days: DayPlan[]
  pois: Record<string, POI>
  wishlist: string[]
  segments: Record<string, TransportSegment>
  expenses: Expense[]
  annotations: InkStroke[]
  totalBudget?: number
  coverImage?: string
  archived: boolean
  createdAt: number
  updatedAt: number
  openedAt?: number
  completedAt?: number
}

export type TimelineEntry =
  | { kind: 'poi'; time: string; poiId: string; arrive: string; leave: string }
  | { kind: 'move'; time: string; segmentId: string }
  | { kind: 'stay'; label: string }
  | { kind: 'divider'; label: string }
  | { kind: 'expense'; expenseId: string }

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['餐饮', '住宿', '交通', '门票', '购物', '其他']

export const CATEGORY_LABEL: Record<POICategory, string> = {
  sight: '玩', food: '食', hotel: '宿', shop: '购', custom: '自',
}

export const MODE_LABEL: Record<TransportMode, string> = {
  walk: '步行', taxi: '打车', transit: '公交', bike: '骑行',
}

export const MODE_COLOR: Record<TransportMode, string> = {
  taxi: '#B08D70',
  walk: '#8FA9A6',
  transit: '#B9C6C4',
  bike: '#6E8B88',
}
