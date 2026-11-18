<script setup lang="ts">
/**
 * 真实底图：腾讯 GL + 纸色罩层。
 * 加载失败 / 超时 / tiles 异常一律 emit fail，由上层露出水墨舆图。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MapBounds } from '../../lib/projection'
import { boundsFromCorners } from '../../lib/projection'
import { applyInkStyle, loadTMap } from '../../lib/tmap'

const props = defineProps<{
  mapKey: string
  bounds: MapBounds
  width: number
  height: number
  standard?: boolean
}>()

const emit = defineEmits<{ (e: 'fail'): void; (e: 'ready'): void; (e: 'view', b: MapBounds): void }>()

const el = ref<HTMLDivElement | null>(null)
let map: any = null
let dead = false
let timer: number | undefined
let probeTimer: number | undefined
let failTimer: number | undefined
let markedReady = false
let tileSeen = false

function targetZoom() {
  const spanLng = Math.max(1e-6, props.bounds.maxLng - props.bounds.minLng)
  return Math.log2((props.width * 360) / (256 * spanLng))
}

function syncView(calibrate = false) {
  if (!map || dead) return
  const center = new window.TMap.LatLng(
    (props.bounds.minLat + props.bounds.maxLat) / 2,
    (props.bounds.minLng + props.bounds.maxLng) / 2,
  )
  const z = targetZoom()
  map.setCenter(center)
  map.setZoom(z)
  window.setTimeout(() => publishView(), calibrate ? 280 : 40)
  if (!calibrate) return
  window.setTimeout(() => {
    if (!map || dead) return
    try {
      const bb = map.getBounds()
      const ne = bb.getNorthEast()
      const sw = bb.getSouthWest()
      const measured = ne.getLng() - sw.getLng()
      const want = props.bounds.maxLng - props.bounds.minLng
      if (measured > 0 && Math.abs(measured - want) / want > 0.002) {
        map.setZoom(z + Math.log2(measured / want))
      }
      publishView()
    } catch { /* ignore */ }
  }, 260)
}

function publishView() {
  if (!map || dead) return
  try {
    const bb = map.getBounds()
    const ne = bb.getNorthEast()
    const sw = bb.getSouthWest()
    emit('view', boundsFromCorners(
      { lng: sw.getLng(), lat: sw.getLat() },
      { lng: ne.getLng(), lat: ne.getLat() },
    ))
  } catch { /* ignore */ }
}

function schedule() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => syncView(false), 80)
}

function markReady() {
  if (dead || markedReady) return
  markedReady = true
  window.clearTimeout(failTimer)
  window.clearTimeout(probeTimer)
  emit('ready')
}

function markFail() {
  if (dead || markedReady) return
  dead = true
  window.clearTimeout(failTimer)
  window.clearTimeout(probeTimer)
  try { map?.destroy?.() } catch { /* ignore */ }
  map = null
  emit('fail')
}

function onTileSignal() {
  if (dead || markedReady) return
  tileSeen = true
  // 等两帧让瓦片真正画上，避免空白 canvas 抢先盖住水墨底
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!dead && !markedReady) markReady()
    })
  })
}

onMounted(async () => {
  // 仅在收到 tilesloaded/idle 后才 ready；超时未出图 → 回落水墨舆图
  failTimer = window.setTimeout(() => markFail(), 8000)
  try {
    await loadTMap(props.mapKey)
    if (dead || !el.value) return
    if (!window.TMap) {
      markFail()
      return
    }
    const TMap = window.TMap
    map = new TMap.Map(el.value, {
      center: new TMap.LatLng(
        (props.bounds.minLat + props.bounds.maxLat) / 2,
        (props.bounds.minLng + props.bounds.maxLng) / 2,
      ),
      zoom: targetZoom(),
      minZoom: 3,
      maxZoom: 18,
      pitch: 0,
      rotation: 0,
      viewMode: '2D',
      showControl: false,
      draggable: false,
      scrollable: false,
      doubleClickZoom: false,
      touchZoomable: false,
      baseMap: {
        type: 'vector',
        // 纸韵档关掉 point：腾讯地名与拾程印章叠在一起，点选会点到瓦片而不是行程点
        features: props.standard ? ['base', 'road', 'building', 'point'] : ['base', 'road', 'building'],
      },
    })
    applyInkStyle(map, !!props.standard)
    let bound = false
    try {
      map.on('idle', () => { onTileSignal(); publishView() })
      map.on('tilesloaded', () => { onTileSignal(); publishView() })
      map.on('error', () => markFail())
      bound = true
    } catch { /* 老版本事件不全 */ }

    // 无事件 API 时：等 canvas 出现后再延迟确认；绝不在 1.8s 盲目 ready
    if (!bound) {
      let probes = 0
      const probe = () => {
        if (dead || markedReady) return
        probes += 1
        const canvas = el.value?.querySelector('canvas')
        if (canvas && probes >= 4) {
          markReady()
          return
        }
        if (probes >= 14) {
          markFail()
          return
        }
        probeTimer = window.setTimeout(probe, 500)
      }
      probeTimer = window.setTimeout(probe, 700)
    }
    window.setTimeout(() => syncView(true), 320)
  } catch {
    markFail()
  }
})

onBeforeUnmount(() => {
  dead = true
  window.clearTimeout(timer)
  window.clearTimeout(probeTimer)
  window.clearTimeout(failTimer)
  try { map?.destroy?.() } catch { /* ignore */ }
  map = null
})

watch(() => [props.bounds.minLng, props.bounds.maxLng, props.bounds.minLat, props.bounds.maxLat], schedule)
watch(() => [props.width, props.height], () => {
  try { map?.resize?.() } catch { /* ignore */ }
  schedule()
})
</script>

<template>
  <div class="tmap-inert pointer-events-none absolute inset-0 overflow-hidden">
    <div ref="el" class="absolute inset-0" :class="standard ? '' : 'gl-paper'" />
    <template v-if="!standard">
      <div class="pointer-events-none absolute inset-0 gl-wash" />
      <div class="pointer-events-none absolute inset-0 gl-mist" />
      <div class="pointer-events-none absolute inset-0 gl-ink-bleed" />
      <div class="pointer-events-none absolute inset-0 gl-grain" />
    </template>
  </div>
</template>

<style scoped>
.tmap-inert,
.tmap-inert :deep(*) {
  pointer-events: none !important;
}
</style>
