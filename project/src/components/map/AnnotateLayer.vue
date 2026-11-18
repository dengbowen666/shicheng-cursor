<script setup lang="ts">
/**
 * 朱笔批注层（D 批注）：canvas 叠加层，用 roughStroke 画 #A64834 手绘笔迹。
 * 组件只 emit 新增笔迹（屏幕坐标，CSS 像素）；撤销 / 清空由父组件通过暴露的
 * undo() / clear() / redraw() 控制，组件自身不发出撤销或清空事件。
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { roughStroke } from '../../lib/motion'

type Pt = { x: number; y: number }

const props = defineProps<{ active: boolean }>()
const emit = defineEmits<{ (e: 'stroke', points: Pt[]): void }>()

const COLOR = '#A64834'
const WIDTH = 3
const canvasRef = ref<HTMLCanvasElement | null>(null)

let strokes: Pt[][] = []
let layers: HTMLCanvasElement[] = []
let current: Pt[] = []
let pointerId: number | null = null
let ro: ResizeObserver | null = null

function ctxOf(canvas: HTMLCanvasElement) {
  return canvas.getContext('2d')!
}

/** 用 roughStroke 把单笔渲染到独立离屏画布，缓存起来以便叠加多笔 */
async function buildLayer(points: Pt[]): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = canvasRef.value?.width || 1
  canvas.height = canvasRef.value?.height || 1
  await roughStroke(canvas, points, COLOR, WIDTH)
  return canvas
}

/** 实时预览用普通 canvas 线，笔画提交后才换成 rough 质感 */
function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = ctxOf(canvas)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const layer of layers) ctx.drawImage(layer, 0, 0)
  if (current.length >= 2) {
    ctx.strokeStyle = COLOR
    ctx.lineWidth = WIDTH
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    current.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
    ctx.stroke()
  }
}

async function commit() {
  if (current.length < 2) { current = []; render(); return }
  const points = current.slice()
  const layer = await buildLayer(points)
  strokes.push(points)
  layers.push(layer)
  current = []
  render()
  emit('stroke', points)
}

function pointFrom(e: PointerEvent): Pt {
  const rect = canvasRef.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onDown(e: PointerEvent) {
  if (!props.active || pointerId !== null) return
  pointerId = e.pointerId
  canvasRef.value?.setPointerCapture(e.pointerId)
  current = [pointFrom(e)]
  render()
}

function onMove(e: PointerEvent) {
  if (!props.active || e.pointerId !== pointerId) return
  current.push(pointFrom(e))
  render()
}

function onUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  if (canvasRef.value?.hasPointerCapture(e.pointerId)) canvasRef.value.releasePointerCapture(e.pointerId)
  pointerId = null
  void commit()
}

function resize() {
  const canvas = canvasRef.value
  const host = canvas?.parentElement
  if (!canvas || !host) return
  const w = Math.max(1, host.clientWidth)
  const h = Math.max(1, host.clientHeight)
  if (canvas.width === w && canvas.height === h) return
  canvas.width = w
  canvas.height = h
  void rebuild()
}

async function rebuild() {
  layers = await Promise.all(strokes.map(buildLayer))
  render()
}

onMounted(async () => {
  await nextTick()
  resize()
  if (canvasRef.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize)
    ro.observe(canvasRef.value.parentElement!)
  } else {
    window.addEventListener('resize', resize)
  }
})

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', resize)
})

// 批注模式关闭时把正在画的半笔收尾提交
watch(() => props.active, active => {
  if (!active && current.length >= 2) void commit()
  else if (!active) { current = []; render() }
})

/** 父组件控制：撤销最后一笔 */
function undo() {
  strokes.pop()
  layers.pop()
  current = []
  render()
}

/** 父组件控制：清空全部笔迹 */
function clear() {
  strokes = []
  layers = []
  current = []
  render()
}

/** 父组件控制：按屏幕坐标重建既有笔迹（用于恢复持久化的 annotations） */
function redraw(list: Pt[][]) {
  strokes = list.filter(p => p.length >= 2).map(p => p.slice())
  void rebuild()
}

defineExpose({ undo, clear, redraw })
</script>

<template>
  <canvas
    ref="canvasRef"
    class="absolute inset-0 w-full h-full"
    :style="{ pointerEvents: active ? 'auto' : 'none', touchAction: active ? 'none' : 'auto', cursor: active ? 'crosshair' : 'default' }"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  />
</template>
