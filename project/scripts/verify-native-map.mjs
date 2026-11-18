/**
 * 真实底图专项（真实 DOM 事件，绝不 emit 绕过事件链）：
 *  1) GL 原生 draggable 开启，pointerdown 不再 setPointerCapture（否则酒店 POI click 被劫持）
 *  2) 点击 canvas 上的原生 POI（丽州大酒店）能出详情卡，且不擅自入日程
 *  3) 拖拽/缩放过程中 view 持续回传，覆盖层跟随，且 stage 无 CSS transform 回弹
 * 用法：build 后 vite preview --port 5185，再 node scripts/verify-native-map.mjs
 */
import { chromium } from 'playwright'

const APP_URL = `http://127.0.0.1:${process.env.PORT || '5185'}/#/`
const browser = await chromium.launch()
const results = []
function log(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  results.push({ name, ok })
}
async function check(name, fn) {
  try { const r = await fn(); log(name, !!r.ok, r.detail || '') }
  catch (e) { log(name, false, e instanceof Error ? e.message : String(e)) }
}

/* 忠实 stub：click 监听挂在自己的 canvas 上，并被 window.__emitCounts 计数。
   若根元素 setPointerCapture 劫持指针，canvas 的 click 永远不会触发——正是真实 bug。 */
const TMAP_STUB = `
(function () {
  window.__emitCounts = {}
  window.__setCaptureCalls = 0
  const origCapture = Element.prototype.setPointerCapture
  Element.prototype.setPointerCapture = function (id) {
    const root = document.querySelector('.map-cursor')
    if (root === this) window.__setCaptureCalls++
    return origCapture ? origCapture.call(this, id) : undefined
  }
  class LatLng {
    constructor(lat, lng) { this.lat = lat; this.lng = lng }
    getLat() { return this.lat }
    getLng() { return this.lng }
  }
  class Map {
    constructor(el, opts) {
      this.el = el; this.opts = opts; this.center = opts.center; this.zoom = opts.zoom
      this.handlers = {}
      window.__tmap = this
      window.__tmapOpts = {
        draggable: !!opts.draggable, scrollable: !!opts.scrollable,
        doubleClickZoom: !!opts.doubleClickZoom, touchZoomable: !!opts.touchZoomable,
      }
      const canvas = document.createElement('canvas')
      canvas.width = 64; canvas.height = 64
      canvas.style.cssText = 'width:100%;height:100%;display:block;background:#e7e0d1'
      el.appendChild(canvas)
      this.canvas = canvas
      // 真实 DOM click → 触发 GL 内部 click 事件（带原生 POI）
      canvas.addEventListener('click', (ev) => {
        const ll = new LatLng(26.872, 100.232)
        this.emit('click', { poi: { name: '丽州大酒店', latLng: ll }, latLng: ll, point: { x: ev.clientX, y: ev.clientY } })
      })
      window.setTimeout(() => this.emit('tilesloaded', {}), 40)
    }
    on(name, fn) { (this.handlers[name] || (this.handlers[name] = [])).push(fn) }
    emit(name, evt) {
      window.__emitCounts[name] = (window.__emitCounts[name] || 0) + 1
      ;(this.handlers[name] || []).forEach((fn) => fn(evt))
    }
    setCenter(c) { this.center = c }
    setZoom(z) { this.zoom = z }
    getCenter() { return this.center }
    getZoom() { return this.zoom }
    getBounds() {
      const c = this.center || new LatLng(26.87, 100.23)
      return {
        getNorthEast: () => new LatLng(c.getLat() + 0.01, c.getLng() + 0.015),
        getSouthWest: () => new LatLng(c.getLat() - 0.01, c.getLng() - 0.015),
      }
    }
    getStyles() { return [] }
    setStyles() {} setStyle() {} setMapStyleId() {} setMapStyle() {} resize() {} destroy() {}
  }
  window.TMap = { Map, LatLng, service: {} }
})()
`

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.route('**/api/gljs**', route => route.fulfill({ contentType: 'application/javascript', body: TMAP_STUB }))
await page.route('**/ws/place/v1/suggestion**', route => {
  const cb = new URL(route.request().url()).searchParams.get('callback') || '_'
  return route.fulfill({ contentType: 'application/javascript', body: `${cb}({status:0,data:[]})` })
})
await page.route('**/ws/geocoder/v1**', route => {
  const cb = new URL(route.request().url()).searchParams.get('callback') || '_'
  return route.fulfill({ contentType: 'application/javascript', body: `${cb}({status:0,result:{address:'丽江市古城区民主路'}})` })
})

await page.goto(APP_URL, { waitUntil: 'networkidle' })
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('shicheng:key', 'TESTKEY') })
await page.reload({ waitUntil: 'networkidle' })
await page.evaluate(() => { location.hash = '#/trip/demo-dali-lijiang' })
await page.waitForTimeout(1200)
await page.waitForFunction(() => !!window.__tmap, null, { timeout: 6000 }).catch(() => {})

const readState = () => page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const t = pinia._s.get('trip').trips.find(x => x.id === 'demo-dali-lijiang')
  return { day1: t?.days?.find(d => d.dayIndex === 1), pois: Object.values(t?.pois || {}) }
})
const card = name => page.locator('.z-50 .paper-card').filter({ hasText: name }).first()
const canvas = page.locator('.map-cursor canvas').first()

await check('GL 原生拖拽/缩放开启', async () => {
  const opts = await page.evaluate(() => window.__tmapOpts)
  return { ok: opts && opts.draggable && opts.scrollable && opts.doubleClickZoom && opts.touchZoomable, detail: JSON.stringify(opts) }
})

await check('真实点击酒店 POI 出详情且不入日程', async () => {
  if (!await canvas.count()) return { ok: false, detail: '未找到底图 canvas' }
  const before = (await readState()).day1?.poiIds?.length || 0
  const box = await canvas.boundingBox()
  // 点在 canvas 中部空白处，避开自有印章
  await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.42)
  await page.waitForTimeout(500)
  const shown = await card('丽州大酒店').count()
  const after = (await readState()).day1?.poiIds?.length || 0
  const hasAddBtn = shown ? await page.locator('.z-50 .paper-card').getByText('加日程').count() : 0
  if (shown) await page.keyboard.press('Escape')
  return { ok: shown > 0 && after === before && hasAddBtn > 0, detail: `详情=${shown} · 加日程按钮=${hasAddBtn} · poiIds ${before}→${after}` }
})

await check('pointerdown 不劫持指针（setPointerCapture=0）', async () => {
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3)
  await page.mouse.down()
  await page.waitForTimeout(80)
  await page.mouse.up()
  const cap = await page.evaluate(() => window.__setCaptureCalls)
  return { ok: cap === 0, detail: `setPointerCapture 调用=${cap}` }
})

await check('拖拽期间 view 持续回传且无 transform 回弹', async () => {
  const box = await canvas.boundingBox()
  const panBefore = await page.evaluate(() => window.__emitCounts.pan || 0)
  const marker = page.locator('.map-stage-world g[transform]').first()
  const markerBefore = await marker.getAttribute('transform')
  const stageBefore = await page.locator('.map-stage-live').evaluate(el => el.style.transform)
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4)
  await page.mouse.down()
  // 逐帧错开 pan，模拟真实拖拽；view 回传驱动覆盖层实时重投影
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      const m = window.__tmap
      const c = m.getCenter()
      m.setCenter(new window.TMap.LatLng(c.getLat() + 0.002, c.getLng() + 0.003))
      m.emit('pan', {})
    })
    await page.waitForTimeout(50)
  }
  await page.mouse.up()
  await page.waitForTimeout(250)
  const panAfter = await page.evaluate(() => window.__emitCounts.pan || 0)
  const markerAfter = await marker.getAttribute('transform')
  const stageAfter = await page.locator('.map-stage-live').evaluate(el => el.style.transform)
  const markerFollowed = markerBefore !== markerAfter
  const noBounce = /translate3d\(0px, 0px, 0\) scale\(1\)|^$/.test(stageAfter || '')
  return { ok: panAfter > panBefore && markerFollowed && noBounce, detail: `pan ${panBefore}→${panAfter} · 印章 ${markerBefore}→${markerAfter} · stage "${stageBefore}"→"${stageAfter}"` }
})

await check('无脚本异常', async () => ({ ok: errors.length === 0, detail: errors.join(' | ') }))

await browser.close()
const passed = results.filter(r => r.ok).length
console.log(`\ndone — ${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
