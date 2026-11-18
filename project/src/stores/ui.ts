import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type DrawerKind = 'itinerary' | 'expense' | 'wishlist' | 'today' | 'assist' | 'route' | null
export type SheetSize = 'peek' | 'half' | 'full'
export type BaseMapKind = 'paper' | 'standard'
export type ModalKind = 'settings' | 'keyGuide' | 'export' | 'route' | 'place' | 'customPoi' | 'segment' | null

const KEY_STORAGE = 'shicheng:key'
const SETTINGS_STORAGE = 'shicheng:settings'

/** 构建期注入的默认 Key（.env 的 VITE_TMAP_KEY）；设置面板里填的会覆盖它 */
const DEFAULT_KEY = (import.meta.env.VITE_TMAP_KEY as string | undefined)?.trim() || ''

export interface ToastItem { id: number; text: string; action?: string; onAction?: () => void }

export const useUiStore = defineStore('ui', () => {
  const activeDayIndex = ref(1)
  const viewMode = ref<'day' | 'all'>('day')
  const layers = ref({ food: true, hotel: true, sight: true })
  const drawer = ref<DrawerKind>(null)
  const selectedPoiId = ref<string | null>(null)
  const selectedSegmentId = ref<string | null>(null)
  const sheet = ref<SheetSize>('peek')
  const modal = ref<ModalKind>(null)
  const modalPayload = ref<any>(null)
  const annotateMode = ref(false)
  const replaying = ref(false)
  const mapKey = ref<string>(localStorage.getItem(KEY_STORAGE) || DEFAULT_KEY)
  const isDemo = ref(true)
  const toasts = ref<ToastItem[]>([])
  const settings = ref<{ standardMap: boolean; baseMap: BaseMapKind }>({ standardMap: false, baseMap: 'paper' })

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
    mapKey.value = key.trim()
  }
  function openDrawer(kind: DrawerKind) {
    drawer.value = kind
    if (isMobile.value && kind) sheet.value = 'half'
  }
  function closeDrawer() { drawer.value = null }
  function toggleLayer(k: 'food' | 'hotel' | 'sight') { layers.value[k] = !layers.value[k] }
  function openModal(kind: ModalKind, payload?: any) {
    modal.value = kind
    modalPayload.value = payload || null
  }
  function closeModal() { modal.value = null; modalPayload.value = null }
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
    sheet, modal, modalPayload, annotateMode, replaying, mapKey, isDemo, toasts, settings, isMobile,
    setKey, openDrawer, closeDrawer, toggleLayer, openModal, closeModal, toast, dismiss, runToastAction,
    notifyKeyGuide,
  }
})
