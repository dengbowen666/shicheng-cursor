// 腾讯地图三层架构中的视觉层：动态加载 GL SDK + 水墨样式。
// Key 由设置面板输入并只在运行时传入，不写入源码与文档。
let loaderPromise: Promise<any> | null = null
let loadedKey = ''

declare global { interface Window { TMap: any; _TMapSecurityConfig?: any } }

export function loadTMap(key: string): Promise<any> {
  if (!key) return Promise.reject(new Error('尚未设置地图 Key'))
  if (window.TMap && loadedKey === key) return Promise.resolve(window.TMap)
  if (loaderPromise && loadedKey === key) return loaderPromise
  loadedKey = key
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const fail = (msg: string) => {
      window.clearTimeout(timer)
      loaderPromise = null
      loadedKey = ''
      script.remove()
      reject(new Error(msg))
    }
    const timer = window.setTimeout(() => fail('地图 SDK 加载超时'), 12000)
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(key)}&libraries=service,geometry`
    script.async = true
    script.onload = () => {
      window.clearTimeout(timer)
      if (window.TMap) resolve(window.TMap)
      else fail('地图 SDK 未初始化')
    }
    script.onerror = () => fail('地图 SDK 加载失败，请检查 Key 与域名白名单')
    document.head.appendChild(script)
  })
  return loaderPromise
}

/** 宋韵水墨样式；standard=true 时切回标准底图，避免可读性损失（D09） */
export function applyInkStyle(map: any, standard = false) {
  if (!map) return
  try {
    if (standard) {
      map.setMapStyleId?.('style0')
      map.setStyle?.('normal')
      return
    }
    // 优先走自定义 mix（若 SDK 支持）；失败则靠 CSS 纸色罩层兜底
    const styleId = 'shicheng-ink'
    const inkMix = [
      { featureType: 'land', elementType: 'geometry', stylers: { color: '#F2ECE0' } },
      { featureType: 'space', elementType: 'geometry', stylers: { color: '#F2ECE0' } },
      { featureType: 'water', elementType: 'geometry', stylers: { color: '#B7C9C4' } },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: { color: '#5F7A74' } },
      { featureType: 'road', elementType: 'geometry', stylers: { color: '#E8DFCE' } },
      { featureType: 'road', elementType: 'geometry.fill', stylers: { color: '#E4DBC9' } },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: { color: '#C9BBA3' } },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: { color: '#7A7468' } },
      { featureType: 'building', elementType: 'geometry', stylers: { color: '#E6DCC9' } },
      { featureType: 'building', elementType: 'geometry.fill', stylers: { color: '#E6DCC9' } },
      { featureType: 'building', elementType: 'geometry.stroke', stylers: { color: '#D2C6B0' } },
      // 原生 POI 名字保留但压低对比：它们现在可点，不能藏起来
      { featureType: 'poi', elementType: 'labels.text.fill', stylers: { color: '#6E6A62' } },
      { featureType: 'poi', elementType: 'labels.text.stroke', stylers: { color: '#F2ECE0' } },
      { featureType: 'green', elementType: 'geometry', stylers: { color: '#D5DED4' } },
      { featureType: 'landscape', elementType: 'geometry', stylers: { color: '#E6EADF' } },
      { featureType: 'administrative', elementType: 'labels.text.fill', stylers: { color: '#7A7468' } },
    ]
    if (typeof map.setStyles === 'function') {
      const base = map.getStyles?.() || []
      map.setStyles([{ id: styleId, name: '宋韵水墨', base: 'normal', mix: inkMix }, ...base])
      map.setStyle?.(styleId)
    } else if (typeof map.setMapStyle === 'function') {
      map.setMapStyle({ style: styleId, features: inkMix })
    }
  } catch (e) {
    console.warn('应用水墨样式失败，使用 CSS 纸色罩层', e)
  }
}
