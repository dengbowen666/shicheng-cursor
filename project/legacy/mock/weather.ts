import raw from './weather.json'

export interface WeatherDay {
  date: string
  day: string
  night: string
  tempMax: number
  tempMin: number
}

const DATA = raw as unknown as Record<string, { days: WeatherDay[] }> & { _source?: string }

/** 取城市 4 日预报；无数据返回 null */
export function getWeather(city: string): WeatherDay[] | null {
  const hit = DATA[city]
  if (hit && hit.days?.length) return hit.days
  // 兼容「成都市」「杭州市」这类带「市」的写法
  const key = Object.keys(DATA).find(k => k !== '_source' && city.startsWith(k))
  return key ? DATA[key].days : null
}

/** 天气文案 → 语义分类，供图标选择 */
export function weatherKind(text: string): 'sun' | 'cloudsun' | 'cloud' | 'rain' | 'snow' | 'fog' {
  if (/雪/.test(text)) return 'snow'
  if (/雨/.test(text)) return 'rain'
  if (/雾|霾/.test(text)) return 'fog'
  if (/晴/.test(text)) return 'sun'
  if (/多云/.test(text)) return 'cloudsun'
  return 'cloud'
}

/** 出行提示：根据降水与温差给一句提醒 */
export function weatherTip(d: WeatherDay): string | null {
  const kind = weatherKind(d.day)
  if (kind === 'rain') return '带伞'
  if (kind === 'snow') return '防滑保暖'
  if (d.tempMax - d.tempMin >= 12) return '早晚温差大'
  if (d.tempMax >= 30) return '防晒补水'
  if (d.tempMin <= 0) return '注意保暖'
  return null
}

/** 2026-11-17 → 11/17 周二 */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  const wd = '日一二三四五六'[new Date(iso + 'T00:00:00').getDay()]
  return `${Number(m)}/${Number(d)} 周${wd}`
}
