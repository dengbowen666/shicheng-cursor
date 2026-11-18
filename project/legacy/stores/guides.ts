import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CityGuide, GuideDay, GuideNode, GuideLeg, TravelMode, LngLat } from '../types'

const STORAGE_KEY = 'xingtu_guides_v2'

function genId(prefix = 'g'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

// 交通方式 → 估算速度（km/h）与每公里费用（元/km）
export const MODE_RATE: Record<TravelMode, { speed: number; costPerKm: number; label: string }> = {
  drive: { speed: 35, costPerKm: 2.2, label: '打车' },
  walk: { speed: 4.5, costPerKm: 0, label: '步行' },
  bike: { speed: 12, costPerKm: 0, label: '骑行' },
  transit: { speed: 18, costPerKm: 0.4, label: '公交' },
  train: { speed: 160, costPerKm: 0.5, label: '火车' },
}

// 距离（km）→ 根据方式估算时长与费用
export function estimateLeg(mode: TravelMode, km: number): { durationMin: number; cost?: number } {
  const r = MODE_RATE[mode]
  const durationMin = Math.max(3, Math.round((km / r.speed) * 60))
  const cost = r.costPerKm > 0 ? Math.round(km * r.costPerKm) : undefined
  return { durationMin, cost }
}

// 球面距离
export function distanceKm(a: LngLat, b: LngLat): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function loadGuides(): CityGuide[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr
    }
  } catch { /* ignore */ }
  return []
}

export const useGuideStore = defineStore('guides', () => {
  const guides = ref<CityGuide[]>(loadGuides())
  const activeGuideId = ref<string | null>(null)

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(guides.value)) } catch { /* ignore */ }
  }

  const activeGuide = computed(() => guides.value.find(g => g.id === activeGuideId.value) || null)

  // 某城市是否已有攻略
  function findByCity(cityName: string): CityGuide | undefined {
    return guides.value.find(g => g.cityName === cityName)
  }

  // 新建攻略
  function createGuide(input: { cityName: string; province: string; center: LngLat; coverImage?: string }): CityGuide {
    const now = new Date().toISOString()
    const guide: CityGuide = {
      id: genId('guide'),
      cityName: input.cityName,
      province: input.province,
      center: input.center,
      coverImage: input.coverImage || '',
      totalBudget: 3000,
      days: [{ dayIndex: 1, title: '第一天', nodes: [], legs: [] }],
      expenses: [],
      createdAt: now,
      updatedAt: now,
    }
    guides.value.unshift(guide)
    activeGuideId.value = guide.id
    persist()
    return guide
  }

  function openGuide(id: string) {
    activeGuideId.value = id
  }

  function touch() {
    const g = activeGuide.value
    if (g) { g.updatedAt = new Date().toISOString(); persist() }
  }

  function removeGuide(id: string) {
    guides.value = guides.value.filter(g => g.id !== id)
    if (activeGuideId.value === id) activeGuideId.value = null
    persist()
  }

  function addDay() {
    const g = activeGuide.value
    if (!g) return
    g.days.push({ dayIndex: g.days.length + 1, title: `第${g.days.length + 1}天`, nodes: [], legs: [] })
    touch()
  }

  function removeDay(dayIndex: number) {
    const g = activeGuide.value
    if (!g || g.days.length <= 1) return
    g.days = g.days.filter(d => d.dayIndex !== dayIndex)
    g.days.forEach((d, i) => { d.dayIndex = i + 1 })
    touch()
  }

  // 加节点到某天末尾
  function addNode(dayIndex: number, node: Omit<GuideNode, 'id'>) {
    const g = activeGuide.value
    if (!g) return
    const day = g.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    const newNode: GuideNode = { ...node, id: genId('n') }
    const prev = day.nodes[day.nodes.length - 1]
    day.nodes.push(newNode)
    // 自动生成到上一节点之间的交通段（默认打车估算）
    if (prev) {
      const km = distanceKm(prev, newNode)
      const est = estimateLeg('drive', km)
      day.legs.push({ id: genId('leg'), fromId: prev.id, toId: newNode.id, mode: 'drive', durationMin: est.durationMin, distanceKm: Math.round(km * 10) / 10, cost: est.cost })
    }
    touch()
  }

  function removeNode(dayIndex: number, nodeId: string) {
    const g = activeGuide.value
    if (!g) return
    const day = g.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    day.nodes = day.nodes.filter(n => n.id !== nodeId)
    day.legs = day.legs.filter(l => l.fromId !== nodeId && l.toId !== nodeId)
    // 重建腿
    rebuildLegs(day)
    touch()
  }

  // 重建某天的腿（保持已有 mode 设置）
  function rebuildLegs(day: GuideDay) {
    const oldMap = new Map<string, GuideLeg>()
    day.legs.forEach(l => oldMap.set(`${l.fromId}-${l.toId}`, l))
    const legs: GuideLeg[] = []
    for (let i = 0; i < day.nodes.length - 1; i++) {
      const from = day.nodes[i], to = day.nodes[i + 1]
      const key = `${from.id}-${to.id}`
      const existing = oldMap.get(key)
      if (existing) {
        legs.push(existing)
      } else {
        const km = distanceKm(from, to)
        const est = estimateLeg('drive', km)
        legs.push({ id: genId('leg'), fromId: from.id, toId: to.id, mode: 'drive', durationMin: est.durationMin, distanceKm: Math.round(km * 10) / 10, cost: est.cost })
      }
    }
    day.legs = legs
  }

  // 改变某段交通方式 → 重新估算时长费用
  function setLegMode(dayIndex: number, legId: string, mode: TravelMode) {
    const g = activeGuide.value
    if (!g) return
    const day = g.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    const leg = day.legs.find(l => l.id === legId)
    if (!leg) return
    leg.mode = mode
    leg.manual = true
    const est = estimateLeg(mode, leg.distanceKm)
    leg.durationMin = est.durationMin
    leg.cost = est.cost
    touch()
  }

  // 手动调整某段时长
  function setLegDuration(dayIndex: number, legId: string, minutes: number) {
    const g = activeGuide.value
    if (!g) return
    const day = g.days.find(d => d.dayIndex === dayIndex)
    const leg = day?.legs.find(l => l.id === legId)
    if (!leg) return
    leg.durationMin = Math.max(1, minutes)
    leg.manual = true
    touch()
  }

  // 移动节点顺序
  function moveNode(dayIndex: number, nodeId: string, dir: -1 | 1) {
    const g = activeGuide.value
    if (!g) return
    const day = g.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    const idx = day.nodes.findIndex(n => n.id === nodeId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= day.nodes.length) return
    const [n] = day.nodes.splice(idx, 1)
    day.nodes.splice(target, 0, n)
    rebuildLegs(day)
    touch()
  }

  // 拖拽重排（直接指定新顺序的 id 列表）
  function reorderNodes(dayIndex: number, orderedIds: string[]) {
    const g = activeGuide.value
    if (!g) return
    const day = g.days.find(d => d.dayIndex === dayIndex)
    if (!day) return
    const map = new Map(day.nodes.map(n => [n.id, n]))
    const next = orderedIds.map(id => map.get(id)).filter(Boolean) as GuideNode[]
    if (next.length !== day.nodes.length) return
    day.nodes = next
    rebuildLegs(day)
    touch()
  }

  function updateBudget(v: number) {
    const g = activeGuide.value
    if (g) { g.totalBudget = v; touch() }
  }

  function addExpense(expense: Omit<import('../types').Expense, 'id' | 'createdAt'>) {
    const g = activeGuide.value
    if (!g) return
    g.expenses.push({ ...expense, id: genId('e'), createdAt: new Date().toISOString() })
    touch()
  }
  function removeExpense(id: string) {
    const g = activeGuide.value
    if (!g) return
    g.expenses = g.expenses.filter(e => e.id !== id)
    touch()
  }
  function updateExpense(id: string, patch: Partial<import('../types').Expense>) {
    const g = activeGuide.value
    if (!g) return
    const e = g.expenses.find(x => x.id === id)
    if (e) Object.assign(e, patch)
    touch()
  }

  // 首次打开：为空时生成一份示例攻略（成都），直观展示交通可视化
  function seedDemoIfEmpty() {
    if (guides.value.length > 0) return
    try {
      if (localStorage.getItem('xingtu_seeded_v1')) return
      localStorage.setItem('xingtu_seeded_v1', '1')
    } catch { /* ignore */ }
    const demo: CityGuide = {
      id: genId('guide'),
      cityName: '成都',
      province: '四川省',
      center: { lat: 30.5728, lng: 104.0668 },
      coverImage: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=1200&q=80',
      totalBudget: 2800,
      days: [
        {
          dayIndex: 1,
          title: '第一天',
          nodes: [
            { id: genId('n'), name: '宽窄巷子', shortName: '宽窄巷子', category: 'sight', lat: 30.663831, lng: 104.05364, address: '青羊区长顺上街127号', stayMinutes: 120 },
            { id: genId('n'), name: '成都市人民公园', shortName: '人民公园', category: 'sight', lat: 30.657133, lng: 104.057591, address: '青羊区祠堂街9号', stayMinutes: 90 },
            { id: genId('n'), name: '成都博物馆', shortName: '成都博物馆', category: 'sight', lat: 30.657331, lng: 104.06376, address: '青羊区小河街1号', stayMinutes: 120 },
            { id: genId('n'), name: '春熙路步行街', shortName: '春熙路', category: 'sight', lat: 30.6555, lng: 104.07721, address: '锦江区春熙路', stayMinutes: 150 },
          ],
          legs: [],
        },
      ],
      expenses: [
        { id: genId('e'), dayIndex: 1, date: '', amount: 68, category: 'food', title: '宽窄巷子小吃', createdAt: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    // 生成交通段并设置不同方式，直观展示
    const d = demo.days[0]
    const modes: TravelMode[] = ['walk', 'bike', 'drive']
    for (let i = 0; i < d.nodes.length - 1; i++) {
      const km = Math.round(distanceKm(d.nodes[i], d.nodes[i + 1]) * 10) / 10
      const mode = modes[i % modes.length]
      const est = estimateLeg(mode, km)
      d.legs.push({ id: genId('leg'), fromId: d.nodes[i].id, toId: d.nodes[i + 1].id, mode, durationMin: est.durationMin, distanceKm: km, cost: est.cost })
    }
    guides.value.unshift(demo)
    persist()
  }

  function exportGuides(): string {
    return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), guides: guides.value }, null, 2)
  }
  function importGuides(json: string): number {
    const data = JSON.parse(json)
    const list: CityGuide[] = Array.isArray(data) ? data : data.guides
    let count = 0
    for (const g of list) {
      if (!g?.id || !g.cityName) continue
      const exist = guides.value.findIndex(x => x.id === g.id)
      if (exist >= 0) guides.value[exist] = g
      else guides.value.unshift(g)
      count++
    }
    persist()
    return count
  }

  return {
    guides, activeGuideId, activeGuide, findByCity,
    createGuide, openGuide, removeGuide, addDay, removeDay,
    addNode, removeNode, reorderNodes, moveNode, setLegMode, setLegDuration,
    updateBudget, addExpense, removeExpense, updateExpense,
    exportGuides, importGuides, touch, seedDemoIfEmpty,
  }
})
