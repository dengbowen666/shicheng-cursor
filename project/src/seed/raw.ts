import type { POICategory, PoiRole } from '../types'

export interface RawPOI {
  name: string
  lat: number
  lng: number
  address: string
  poiId: string
  category: POICategory
  intro?: string
  rating?: number
  pricePerPerson?: number
  openTime?: string
  tags?: string[]
  role?: PoiRole
  stayMinutes?: number
}
