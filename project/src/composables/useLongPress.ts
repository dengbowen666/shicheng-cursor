import { onBeforeUnmount } from 'vue'

/** 长按 600ms 识别（D23 / D82）：短按不触发；移动超阈值取消 */
export function useLongPress(
  onLong: (e: PointerEvent) => void,
  opts: { ms?: number; moveTol?: number } = {},
) {
  const ms = opts.ms ?? 600
  const moveTol = opts.moveTol ?? 10
  let timer: number | null = null
  let start: { x: number; y: number; e: PointerEvent } | null = null
  let fired = false

  function clear() {
    if (timer != null) window.clearTimeout(timer)
    timer = null
    start = null
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    fired = false
    start = { x: e.clientX, y: e.clientY, e }
    timer = window.setTimeout(() => {
      if (!start) return
      fired = true
      onLong(start.e)
      clear()
    }, ms)
  }

  function onPointerMove(e: PointerEvent) {
    if (!start) return
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > moveTol) clear()
  }

  function onPointerUp() { clear() }

  onBeforeUnmount(clear)

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    /** 若刚触发过长按，短按 click 应忽略 */
    didFire: () => fired,
  }
}
