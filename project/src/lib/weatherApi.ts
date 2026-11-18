import type { DailyWeather } from '../types'
import { SEED_WEATHER } from '../seed'

const WEATHER_POEMS: Record<string, string> = {
  晴: '水光潋滟晴方好',
  多云: '云淡风轻近午天',
  雾: '山色空蒙雨亦奇',
  雨: '沾衣欲湿杏花雨',
  雪: '晚来天欲雪，能饮一杯无',
  雷雨: '黑云翻墨未遮山',
}

export function codeToText(code: number): string {
  if (code === 0 || code === 1) return '晴'
  if (code === 2 || code === 3) return '多云'
  if (code === 45 || code === 48) return '雾'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '雨'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '雪'
  if (code >= 95) return '雷雨'
  return '多云'
}

export function dressAdvice(max: number, min: number): string {
  if (max >= 30) return min <= 22 ? '短袖防晒，夜凉加薄衫' : '短袖防晒，多补水'
  if (max >= 24) return '短袖加薄外套'
  if (max >= 17) return max - min >= 10 ? '薄外套或长袖，昼夜温差大' : '薄外套或长袖'
  if (max >= 10) return '夹衣加薄毛衣'
  if (max >= 3) return '薄羽绒加围巾'
  return '厚羽绒，注意保暖'
}

function decorate(date: string, code: number, max: number, min: number): DailyWeather {
  const text = codeToText(code)
  return { date, code, text, poem: WEATHER_POEMS[text], tempMax: Math.round(max), tempMin: Math.round(min), advice: dressAdvice(max, min) }
}

/** 腾讯 GCJ-02 城市中心 → Open-Meteo WGS-84 的简化偏移；仅用于城市级预报，禁止逐 POI 混算。 */
function gcjToWgs(lat: number, lng: number) {
  return { lat: lat - 0.0060, lng: lng - 0.0065 }
}

/** Open-Meteo 免 Key；8 秒超时 + 种子兜底。失败不阻塞界面。 */
export async function fetchWeather(city: string, center: { lat: number; lng: number }): Promise<{ days: DailyWeather[]; live: boolean }> {
  const fallback = SEED_WEATHER[city]
  const wgs = gcjToWgs(center.lat, center.lng)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${wgs.lat.toFixed(4)}&longitude=${wgs.lng.toFixed(4)}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=16`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const d = data?.daily
    if (!d?.time?.length) throw new Error('empty forecast')
    const days = d.time.slice(0, 16).map((date: string, i: number) => decorate(date, d.weather_code[i], d.temperature_2m_max[i], d.temperature_2m_min[i]))
    return { days, live: true }
  } catch {
    return { days: fallback || [], live: false }
  } finally {
    window.clearTimeout(timer)
  }
}
