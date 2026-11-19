import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type DrawerKind = 'itinerary' | 'expense' | 'wishlist' | 'today' | 'assist' | 'route' | null
export type SheetSize = 'peek' | 'half' | 'full'
export type BaseMapKind = 'paper' | 'standard'
export type ModalKind = 'settings' | 'keyGuide' | 'export' | 'route' | 'place' | 'customPoi' | 'segment' | 'leg' | null

const KEY_STORAGE = 'shicheng:key'
const KEY_SOURCE_STORAGE = 'shicheng:keySource' // 'user' = 用户在设置面板手填；缺省 = 构建期注入/历史残留
const SETTINGS_STORAGE = 'shicheng:settings'
const DISMISSED_STORAGE = 'shicheng:dismissed'

/** 构建期注入的默认 Key（部署时为 GitHub Secrets 注入的新 Key；本地为 .env）。它是权威来源 */
const DEFAULT_KEY = (import.meta.env.VITE_TMAP_KEY as string | undefined)?.trim() || ''

/**
 * 解析启动时生效的 Key：
 * - 用户在设置面板手填的 Key（有 'user' 标记）始终优先，尊重本机手动覆盖；
 * - 否则一律用构建期注入的 DEFAULT_KEY——这样重新部署/换 Secret Key 时，
 *   会自动替换掉历史残留的旧 Key（旧 Key 失效会让真实底图整片加载不出来，只剩水墨降级层）。
 * - 无 DEFAULT_KEY（本地未配 .env）时才回落到历史残留，兼容老数据。
 */
function resolveInitialKey(): string {
  const stored = localStorage.getItem(KEY_STORAGE) || ''
  const source = localStorage.getItem(KEY_SOURCE_STORAGE)
  if (stored && source === 'user') return stored
  if (DEFAULT_KEY) return DEFAULT_KEY
  return stored
}

export interface ToastItem { id: number; text: string; action?: string; onAction?: () => void }

export const useUiStore = defineStore('ui', () => {
  const activeDayIndex = ref(1)
  const viewMode = ref<'day' | 'all'>('day')
  const layers = ref({ food: true, hotel: true, sight: true })
  const drawer = ref<DrawerKind>(null)
  const selectedPoiId = ref<string | null>(null)
  const selectedSegmentId = ref<string | null>(null)
  const sheet = ref<SheetSize>('peek')
  // O10：桌面左右工作台可折叠，给地图让位（跨攻略保持）
  const studioCollapsed = ref(false)
  const inspectorCollapsed = ref(false)
  const modal = ref<ModalKind>(null)
  const modalPayload = ref<any>(null)
  const annotateMode = ref(false)
  const replaying = ref(false)
  const mapKey = ref<string>(resolveInitialKey())
  const isDemo = ref(true)
  const toasts = ref<ToastItem[]>([])
  const settings = ref<{ standardMap: boolean; baseMap: BaseMapKind }>({ standardMap: false, baseMap: 'paper' })

  // O06：已忽略的智能建议，按攻略隔离、持久化；键由调用方按天生成
  const dismissedByTrip = ref<Record<string, string[]>>(loadDismissed())
  function loadDismissed(): Record<string, string[]> {
    try {
      const raw = localStorage.getItem(DISMISSED_STORAGE)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }
  function persistDismissed() {
    try { localStorage.setItem(DISMISSED_STORAGE, JSON.stringify(dismissedByTrip.value)) } catch { /* ignore */ }
  }
  function isDismissed(tripId: string, key: string): boolean {
    return !!dismissedByTrip.value[tripId]?.includes(key)
  }
  function dismissKey(tripId: string, key: string) {
    const list = dismissedByTrip.value[tripId] || []
    if (list.includes(key)) return
    dismissedByTrip.value[tripId] = [...list, key]
    persistDismissed()
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE)
    if (raw) Object.assign(settings.value, JSON.parse(raw))
  } catch { /* ignore */ }
  if ((settings.value.baseMap as string) === 'ink') {
    settings.value.baseMap = 'paper'
    settings.value.standardMap = false
  }

  watch(mapKey, v => {
    if (v) localStorage.setItem(KEY_STORAGE, v)
    else localStorage.removeItem(KEY_STORAGE)
    isDemo.value = !v
  }, { immediate: true })

  watch(settings, v => {
    try { localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(v)) } catch { /* ignore */ }
  }, { deep: true })

  const isMobile = computed(() => typeof window !== 'undefined' && window.innerWidth < 768)

  function setKey(key: string) {
    const next = key.trim()
    mapKey.value = next
    // 空值视为「恢复构建默认」：清掉用户标记，让 DEFAULT_KEY 在下一次解析时生效
    if (!next) {
      localStorage.removeItem(KEY_SOURCE_STORAGE)
      if (DEFAULT_KEY) mapKey.value = DEFAULT_KEY
    } else {
      localStorage.setItem(KEY_SOURCE_STORAGE, 'user')
    }
  }
  /** 是否有构建期注入的 Key（设置面板据此显示「恢复默认」入口） */
  const hasBuildKey = computed(() => !!DEFAULT_KEY)
  /** 恢复使用构建期注入的默认 Key，清掉本机手填/残留 */
  function resetKey() {
    localStorage.removeItem(KEY_SOURCE_STORAGE)
    mapKey.value = DEFAULT_KEY
  }
  function openDrawer(kind: DrawerKind) {
    drawer.value = kind
    if (kind) inspectorCollapsed.value = false
    if (isMobile.value && kind) sheet.value = 'half'
  }
  function closeDrawer() { drawer.value = null }
  function toggleLayer(k: 'food' | 'hotel' | 'sight') { layers.value[k] = !layers.value[k] }
  function openModal(kind: ModalKind, payload?: any) {
    modal.value = kind
    modalPayload.value = payload || null
  }
  function closeModal() { modal.value = null; modalPayload.value = null; clearSelection() }
  /** O08：关闭弹层/按 Esc 时一并清掉选中的地点与交通段，避免幽灵状态 */
  function clearSelection() { selectedPoiId.value = null; selectedSegmentId.value = null }
  function toast(text: string, action?: string, onAction?: () => void) {
    const t = { id: Date.now() + Math.random(), text, action, onAction }
    toasts.value.push(t)
    window.setTimeout(() => dismiss(t.id), action ? 5200 : 2800)
    return t.id
  }
  function dismiss(id: number) { toasts.value = toasts.value.filter(t => t.id !== id) }
  function runToastAction(id: number) {
    const t = toasts.value.find(x => x.id === id)
    t?.onAction?.()
    dismiss(id)
  }

  /** D17：status 199 自动弹权限引导（防抖） */
  let last199At = 0
  function notifyKeyGuide(detail?: string) {
    const now = Date.now()
    if (now - last199At < 10000) return
    last199At = now
    openModal('keyGuide')
    toast(detail || 'WebService 返回 199：Key 未生效或权限未开')
  }

  return {
    activeDayIndex, viewMode, layers, drawer, selectedPoiId, selectedSegmentId,
    sheet, studioCollapsed, inspectorCollapsed, modal, modalPayload, annotateMode, replaying, mapKey, isDemo, toasts, settings, isMobile, hasBuildKey,
    dismissedByTrip, isDismissed, dismissKey,
    setKey, resetKey, openDrawer, closeDrawer, toggleLayer, openModal, closeModal, clearSelection, toast, dismiss, runToastAction,
    notifyKeyGuide,
  }
})
