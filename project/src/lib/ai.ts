/**
 * AI 辅助接入层（A 系列 v0.2）。
 * 设计纪律见 docs/AI辅助设计文档-A.md：AI 只产出「一个受限动作」，采用时走现有 store 方法；
 * 任何失败一律返回 null，由调用方静默不渲染卡片，绝不打断编辑。
 */

export interface AdviceRequest {
  dayIndex: number
  city: string
  date?: string
  departTime: string
  stops: { name: string; category: string; stayMin: number; arrive: string }[]
  segments: { from: string; to: string; mode: string; km?: number; min: number }[]
  weather?: string
  budgetLeft?: string
  pool: string[] // 收藏池候选（最多 8 个）
}

export type AdviceAction =
  | { action: 'mode'; seg: [string, string]; mode: 'walk' | 'bike' | 'taxi' | 'transit'; reason: string }
  | { action: 'reorder'; order: string[]; reason: string }
  | { action: 'trim'; poi: string; reason: string }
  | { action: 'fill'; poi: string; reason: string }
  | { action: 'none'; reason: string }

/** 公网构建整块不启用；内网构建 VITE_AI_ENABLED=1 才渲染按钮 */
export const AI_ENABLED: boolean = import.meta.env.VITE_AI_ENABLED === '1'

const BASE_STORAGE = 'shicheng:aiBase'
const KEY_STORAGE = 'shicheng:aiKey'

export function aiBase(): string { return localStorage.getItem(BASE_STORAGE) || '' }
export function aiKey(): string { return localStorage.getItem(KEY_STORAGE) || '' }
export function setAi(base: string, key: string) {
  if (base) localStorage.setItem(BASE_STORAGE, base)
  else localStorage.removeItem(BASE_STORAGE)
  if (key) localStorage.setItem(KEY_STORAGE, key)
  else localStorage.removeItem(KEY_STORAGE)
}
/** 按钮渲染条件：构建启用 + 端点 + Key 都齐 */
export function aiReady(): boolean { return AI_ENABLED && !!aiBase() && !!aiKey() }

const SYSTEM_PROMPT = `你是行程编辑，审视当日安排，只提出一条最值得改的建议。

可选动作，仅限这五种：
  mode    改某段交通方式
  reorder 调整当日各点顺序
  trim    删掉某一点
  fill    从收藏池补入某一点
  none    无可改，如实说明

规则：
- 最多一条建议；若安排已妥，用 none。
- 只许使用输入中出现的地名与交通方式，不得编造地点。
- 不得计算或自行推算输入中未给出的数字（距离、耗时、金额）。
- reason 用半文半白，四十字以内，说清"为何"而不是"是什么"。

只输出一行 JSON，不要代码块标记，不要解释：
{"action":"mode|reorder|trim|fill|none","seg":["起点名","终点名"],"mode":"walk|bike|taxi|transit","order":["名",...],"poi":"名称","reason":"……"}
按所选动作只填相关字段，其余省略。`

function buildQuery(req: AdviceRequest): string {
  const lines: string[] = [
    `第 ${req.dayIndex} 日 · ${req.city}${req.date ? ` · ${req.date}` : ''} · ${req.departTime} 出发`,
    '',
    '停留点：',
    ...(req.stops.length
      ? req.stops.map((s, i) => `${i + 1}. ${s.name}（${s.category}，${s.stayMin} 分，${s.arrive} 到）`)
      : ['（无）']),
    '',
    '交通段：',
    ...(req.segments.length
      ? req.segments.map(s => `${s.from} → ${s.to}：${s.mode}${s.km != null ? `，约 ${s.km} km` : ''}，${s.min} 分`)
      : ['（无）']),
    '',
    `收藏池：${req.pool.length ? req.pool.join('、') : '（空）'}`,
  ]
  if (req.weather) lines.push(`天气：${req.weather}`)
  if (req.budgetLeft) lines.push(`预算余：${req.budgetLeft}`)
  return lines.join('\n')
}

const ACTIONS = new Set(['mode', 'reorder', 'trim', 'fill', 'none'])
const MODES = new Set(['walk', 'bike', 'taxi', 'transit'])

/** 短哈希：poiIds + segmentIds + modes 的指纹，日程一变即失效 */
export function fingerprint(signature: string): string {
  let h = 2166136261
  for (let i = 0; i < signature.length; i++) {
    h ^= signature.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

export function adviceCacheKey(tripId: string, dayIndex: number, sig: string): string {
  return `shicheng:ai:advice:${tripId}:${dayIndex}:${fingerprint(sig)}`
}

function readCache(key: string): AdviceAction | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const obj = JSON.parse(raw)
    return validShape(obj) ? obj as AdviceAction : null
  } catch { return null }
}
function writeCache(key: string, value: AdviceAction) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 配额满：不阻断 */ }
}

/** 结构校验：动作白名单、字段类型、mode 白名单（缓存读取用） */
function validShape(obj: any): boolean {
  if (!obj || typeof obj !== 'object' || !ACTIONS.has(obj.action)) return false
  if (typeof obj.reason !== 'string' || !obj.reason.trim()) return false
  switch (obj.action) {
    case 'mode':
      return Array.isArray(obj.seg) && obj.seg.length === 2 &&
        typeof obj.seg[0] === 'string' && typeof obj.seg[1] === 'string' && MODES.has(obj.mode)
    case 'reorder':
      return Array.isArray(obj.order) && obj.order.length > 0 && obj.order.every((n: any) => typeof n === 'string')
    case 'trim':
    case 'fill':
      return typeof obj.poi === 'string' && !!obj.poi
    case 'none':
      return true
    default:
      return false
  }
}

/** 名称回查：只接受请求中出现过的地名，杜绝模型编造；缓存校验后用真实请求数据再校验 */
function validateNames(action: AdviceAction, req: AdviceRequest): boolean {
  const stops = req.stops.map(s => s.name)
  const pools = req.pool
  const segs = req.segments.map(s => [s.from, s.to] as [string, string])
  if (!validShape(action)) return false
  switch (action.action) {
    case 'mode':
      return segs.some(([a, b]) => a === action.seg[0] && b === action.seg[1])
    case 'reorder':
      return action.order.length === stops.length &&
        new Set(action.order).size === action.order.length &&
        action.order.every(n => stops.includes(n))
    case 'trim':
      return stops.includes(action.poi)
    case 'fill':
      return pools.includes(action.poi)
    case 'none':
      return true
  }
}

/** 从可能带 ```json 包裹的原文里取出第一个 { 到最后一个 } */
function parseAdvice(raw: string): AdviceAction | null {
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const obj = JSON.parse(raw.slice(start, end + 1))
    if (!obj || !ACTIONS.has(obj.action)) return null
    if (typeof obj.reason !== 'string' || !obj.reason.trim()) return null
    obj.reason = obj.reason.trim().slice(0, 40)
    return obj as AdviceAction
  } catch { return null }
}

const TIMEOUT_MS = 15000
const CONTROLLERS = new Map<string, AbortController>()
const INFLIGHT = new Map<string, Promise<AdviceAction | null>>()

/**
 * 取一条建议。失败/超时/畸形/校验不过一律 null。
 * 同一 key 3 秒内不重复发请求；同一 key 并发复用同一 Promise。
 */
export async function advise(
  req: AdviceRequest,
  opts?: { cacheKey?: string; signalKey?: string; lastAt?: number },
): Promise<AdviceAction | null> {
  if (!aiReady()) return null

  const cacheKey = opts?.cacheKey
  if (cacheKey) {
    const cached = readCache(cacheKey)
    if (cached) return cached
  }
  const signalKey = opts?.signalKey || `${req.dayIndex}`
  const now = Date.now()
  if (opts?.lastAt && now - opts.lastAt < 3000) return null

  const existing = INFLIGHT.get(signalKey)
  if (existing) return existing

  const task = (async (): Promise<AdviceAction | null> => {
    const base = aiBase().replace(/\/+$/, '')
    const key = aiKey()
    const ctrl = new AbortController()
    CONTROLLERS.set(signalKey, ctrl)
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`${base}/chat-messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: { system: SYSTEM_PROMPT },
          query: buildQuery(req),
          response_mode: 'blocking',
          conversation_id: '',
          user: 'shicheng-local',
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) return null
      const data = await res.json() as any
      const raw = typeof data?.answer === 'string' ? data.answer : ''
      const action = parseAdvice(raw)
      if (!action || !validateNames(action, req)) return null
      if (cacheKey) writeCache(cacheKey, action)
      return action
    } catch {
      return null
    } finally {
      clearTimeout(timer)
      CONTROLLERS.delete(signalKey)
      INFLIGHT.delete(signalKey)
    }
  })()
  INFLIGHT.set(signalKey, task)
  return task
}

export function cancelAdvise(signalKey = '0') { CONTROLLERS.get(signalKey)?.abort() }
