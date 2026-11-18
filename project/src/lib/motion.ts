/**
 * 全站动效唯一入口（D54 / D59 / D81）：
 * 晕 / 落 / 展 / 行 四语法；prefers-reduced-motion 与低端机一律静默降级。
 */
import { animate, createTimeline, stagger, createDrawable, utils } from 'animejs'

type Point = { x: number; y: number }

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const mem = (navigator as any).deviceMemory
  const cores = navigator.hardwareConcurrency || 4
  return (typeof mem === 'number' && mem <= 2) || cores <= 2
}

export function canAnimate(): boolean {
  return !prefersReducedMotion() && !isLowEndDevice()
}

/** 落 · 印章落定 */
export function stamp(el: HTMLElement | null) {
  if (!el) return
  if (!canAnimate()) {
    el.classList.add('seal-stamp')
    return
  }
  animate(el, {
    scale: [1.45, 0.94, 1],
    rotate: [-8, 2, 0],
    opacity: [0, 1],
    duration: 420,
    ease: 'out(3)',
  })
}

/** 晕 · 水墨径向揭开 */
export function inkReveal(el: HTMLElement | null, duration = 800): Promise<void> {
  if (!el) return Promise.resolve()
  if (!canAnimate()) {
    el.style.opacity = '1'
    return Promise.resolve()
  }
  return new Promise(resolve => {
    el.classList.add('ink-reveal')
    window.setTimeout(() => {
      el.classList.remove('ink-reveal')
      resolve()
    }, duration)
  })
}

/** 展 · 挂轴 / 抽屉展开感 */
export function unroll(el: HTMLElement | null, from: 'right' | 'bottom' = 'right') {
  if (!el || !canAnimate()) return
  if (from === 'right') {
    animate(el, {
      translateX: [28, 0],
      opacity: [0.15, 1],
      duration: 320,
      ease: 'out(2)',
    })
  } else {
    animate(el, {
      translateY: [36, 0],
      opacity: [0.15, 1],
      duration: 320,
      ease: 'out(2)',
    })
  }
}

/** 行 · SVG path 描边生长 */
export function drawPath(path: SVGPathElement | null, duration = 900) {
  if (!path || !canAnimate()) return
  try {
    const drawable = createDrawable(path)
    animate(drawable, {
      draw: ['0 0', '0 1'],
      duration,
      ease: 'inOut(2)',
    })
  } catch {
    /* drawable 不可用时静默 */
  }
}

/** 行 · 沿 path 移动 marker（优先 anime，失败回落 rAF） */
export function moveAlong(
  marker: SVGElement | null,
  path: SVGPathElement | null,
  duration = 3000,
  onDone?: () => void,
) {
  if (!marker || !path || !canAnimate()) {
    onDone?.()
    return () => {}
  }
  const len = path.getTotalLength()
  try {
    const anim = animate(marker, {
      duration,
      ease: 'linear',
      onUpdate: (self: any) => {
        const p = Math.min(1, self.progress)
        const pt = path.getPointAtLength(len * p)
        marker.setAttribute('transform', `translate(${pt.x},${pt.y})`)
      },
      onComplete: () => onDone?.(),
    } as any)
    return () => { try { anim.pause(); anim.cancel?.() } catch { /* ignore */ } }
  } catch {
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const pt = path.getPointAtLength(len * p)
      marker.setAttribute('transform', `translate(${pt.x},${pt.y})`)
      if (p < 1) raf = requestAnimationFrame(step)
      else onDone?.()
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }
}

/** 落 · 列表 / 印记 stagger */
export function stampStagger(targets: string | NodeListOf<Element> | Element[], delayMs = 60) {
  if (!canAnimate()) return
  animate(targets as any, {
    opacity: [0, 1],
    translateY: [10, 0],
    scale: [1.12, 1],
    delay: stagger(delayMs),
    duration: 420,
    ease: 'out(3)',
  })
}

/** 数字滚动（金额 / 统计） */
export function countUp(el: HTMLElement | null, to: number, duration = 700, prefix = '', suffix = '') {
  if (!el) return
  if (!canAnimate()) {
    el.textContent = `${prefix}${to}${suffix}`
    return
  }
  const obj = { v: 0 }
  animate(obj, {
    v: to,
    duration,
    ease: 'out(2)',
    onUpdate: () => {
      el.textContent = `${prefix}${Math.round(obj.v)}${suffix}`
    },
  })
}

/** 朱笔批注：roughjs 手绘质感 */
export async function roughStroke(canvas: HTMLCanvasElement, points: Point[], color = '#A64834', width = 3) {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  try {
    const roughmod: any = await import('roughjs')
    const rough = (roughmod.default || roughmod).canvas(canvas)
    if (points.length > 2) {
      rough.linearPath(points.map(p => [p.x, p.y]), {
        stroke: color, strokeWidth: width, roughness: 1.6, bowing: 1.2,
      })
    } else if (points.length === 2) {
      rough.line(points[0].x, points[0].y, points[1].x, points[1].y, {
        stroke: color, strokeWidth: width, roughness: 1.5,
      })
    }
  } catch {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.beginPath()
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.stroke()
  }
}

/** rough-notation 手绘圈选高亮 */
export async function annotateHighlight(el: HTMLElement | null, type: 'underline' | 'circle' | 'box' = 'underline') {
  if (!el || !canAnimate()) return null
  try {
    const mod: any = await import('rough-notation')
    const annotate = mod.annotate || mod.default?.annotate
    const a = annotate(el, { type, color: '#A64834', padding: 4, strokeWidth: 1.5 })
    a.show()
    return a
  } catch {
    return null
  }
}

/** Lottie 水墨素材按需加载 */
export async function loadLottie(container: HTMLElement, path: string) {
  if (!canAnimate()) return null
  try {
    const mod: any = await import('lottie-web')
    const lottie = mod.default || mod
    return lottie.loadAnimation({
      container, renderer: 'svg', loop: false, autoplay: true, path,
    })
  } catch {
    return null
  }
}

/** 路由级晕染遮罩时间线 */
export function playInkWash(mask: HTMLElement, duration = 720): Promise<void> {
  if (!canAnimate()) {
    mask.style.opacity = '0'
    return Promise.resolve()
  }
  mask.style.pointerEvents = 'auto'
  return new Promise(resolve => {
    const tl = createTimeline({
      defaults: { ease: 'inOut(2)' },
      onComplete: () => {
        mask.style.pointerEvents = 'none'
        resolve()
      },
    })
    tl.add(mask, { opacity: [0, 0.92], duration: duration * 0.45 }, 0)
      .add(mask, { opacity: [0.92, 0], duration: duration * 0.55 }, duration * 0.45)
  })
}

export { animate, createTimeline, stagger, utils }
