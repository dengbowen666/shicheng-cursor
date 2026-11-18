import type { TravelMode } from '../types'

// 交通方式视觉样式（地图线型 + 颜色）
export const MODE_STYLE: Record<TravelMode, { color: string; dash: string; width: number; label: string }> = {
  drive:   { color: '#A64834', dash: '0',        width: 3,   label: '打车' },
  walk:    { color: '#6E8B88', dash: '2 7',      width: 2.4, label: '步行' },
  bike:    { color: '#8FA9A6', dash: '8 5',      width: 2.4, label: '骑行' },
  transit: { color: '#B08D70', dash: '10 6',     width: 3,   label: '公交' },
  train:   { color: '#5A5449', dash: '14 4 2 4', width: 3.4, label: '火车' },
}

export const MODE_LIST: { key: TravelMode; label: string }[] = [
  { key: 'drive', label: '打车' },
  { key: 'walk', label: '步行' },
  { key: 'bike', label: '骑行' },
  { key: 'transit', label: '公交' },
  { key: 'train', label: '火车' },
]

export const MODE_COLOR: Record<TravelMode, string> = {
  drive: '#A64834', walk: '#6E8B88', bike: '#8FA9A6', transit: '#B08D70', train: '#5A5449',
}
