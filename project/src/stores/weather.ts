import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { DailyWeather } from '../types'
import { SEED_WEATHER, MONTH_CLIMATE } from '../seed'
import { fetchWeather } from '../lib/weatherApi'

const TTL = 1000 * 60 * 60 * 24

interface CacheItem { at: number; days: DailyWeather[]; live: boolean }

export const useWeatherStore = defineStore('weather', () => {
  const cache = ref<Record<string, CacheItem>>(load())
  const loading = ref<Record<string, boolean>>({})
  const live = ref<Record<string, boolean>>({})

  function load(): Record<string, CacheItem> {
    try {
      const raw = localStorage.getItem('shicheng:weather')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }
  function persist() {
    try { localStorage.setItem('shicheng:weather', JSON.stringify(cache.value)) } catch { /* ignore */ }
  }

  function get(city: string): DailyWeather[] {
    return cache.value[city]?.days || SEED_WEATHER[city] || []
  }
  function isLive(city: string) { return !!live.value[city] }

  async function loadCity(city: string, center: { lat: number; lng: number }, force = false) {
    const hit = cache.value[city]
    if (!force && hit && Date.now() - hit.at < TTL) {
      live.value[city] = hit.live
      return hit.days
    }
    loading.value[city] = true
    const result = await fetchWeather(city, center)
    loading.value[city] = false
    cache.value[city] = { at: Date.now(), days: result.days, live: result.live }
    live.value[city] = result.live
    persist()
    return result.days
  }

  function forDate(city: string, date?: string): DailyWeather | undefined {
    if (!date) return get(city)[0]
    return get(city).find(d => d.date === date) || get(city)[0]
  }

  function climate(date?: string): string {
    const m = date ? new Date(date).getMonth() + 1 : new Date().getMonth() + 1
    return MONTH_CLIMATE[m] || ''
  }

  return { cache, loading, live, get, isLive, loadCity, forDate, climate }
})
