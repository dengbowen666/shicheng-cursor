// 拾程 v4.1 数据模型（设计文档 §6.3）
// 坐标系纪律：腾讯系 POI / 路线 / 地图交互统一 GCJ-02；天气仅按城市中心请求 Open-Meteo WGS-84。

export interface LngLat { lng: number; lat: number }

export type POICategory = 'food' | 'hotel' | 'sight' | 'shop' | 'custom'
export type PoiRole = 'stop' | 'base' // stop=途经点，base=驻地锚点（D29）
export type PoiSource = 'api' | 'seed' | 'custom' | 'map'

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

// L01：城际交通方式——与市内 TransportMode 语义分开（高铁/飞机是市内段无法表达的）
export type LegMode = 'highspeed' | 'train' | 'flight' | 'car' | 'coach' | 'walk'

/** L01：城际行程段（Leg）——从一座城到另一座城的一次移动，一等公民 */
export interface Leg {
  id: string
  fromCity: string
  toCity: string
  mode: LegMode
  departTime?: string          // 发车/起飞时刻 HH:mm
  arriveTime?: string          // 到达时刻 HH:mm
  durationMin?: number         // 时长（分）
  cost?: number                // 花费（分）
  note?: string                // 车次 / 航班号
  estimated: boolean           // true=按经验估算，界面标「估」
}

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
  pinned?: boolean // O05：固定走法，重建交通段时豁免删除与覆盖
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
  legIds: string[]             // L01：本日出发的城际段（可多条→同日跨城）
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
  legs: Record<string, Leg>    // L01：城际段字典，按 day.legIds 引用
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
  | { kind: 'leg'; time: string; legId: string; arrive: string }  // L03：城际段条目
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

// L01：城际方式标签与配色——统一用朱砂系长虚线，区别于市内 POI 连线
export const LEG_MODE_LABEL: Record<LegMode, string> = {
  highspeed: '高铁', train: '火车', flight: '飞机', car: '自驾', coach: '大巴', walk: '徒步',
}

export const LEG_MODE_COLOR: Record<LegMode, string> = {
  highspeed: '#A64834', train: '#8C3A28', flight: '#B0513A',
  car: '#B08D70', coach: '#9A7557', walk: '#6E8B88',
}
