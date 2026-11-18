/**
 * 城市地图专项回归：拖拽流畅度 + 真实底图 POI 点击详情。
 * 用法：先 build，另起 vite preview --port 5185，再 node scripts/verify-city-map.mjs
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

/* 腾讯 GL 的最小替身：只提供页面用到的 API，并把 click 暴露给测试 */
const TMAP_STUB = `
(function () {
  class LatLng {
    constructor(lat, lng) { this.lat = lat; this.lng = lng }
    getLat() { return this.lat }
    getLng() { return this.lng }
  }
  class Map {
    constructor(el, opts) {
      this.el = el; this.center = opts.center; this.zoom = opts.zoom; this.handlers = {}
      const canvas = document.createElement('canvas')
      canvas.width = 64; canvas.height = 64
      el.appendChild(canvas)
      window.__tmap = this
      window.setTimeout(() => this.emit('tilesloaded', {}), 40)
    }
    on(name, fn) { (this.handlers[name] || (this.handlers[name] = [])).push(fn) }
    emit(name, evt) { (this.handlers[name] || []).forEach(fn => fn(evt)) }
    setCenter(c) { this.center = c }
    setZoom(z) { this.zoom = z }
    getCenter() { return this.center }
    getBounds() {
      const c = this.center || new LatLng(25.7, 100.17)
      return {
        getNorthEast: () => new LatLng(c.getLat() + 0.02, c.getLng() + 0.03),
        getSouthWest: () => new LatLng(c.getLat() - 0.02, c.getLng() - 0.03),
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
  return route.fulfill({ contentType: 'application/javascript', body: `${cb}({status:0,result:{address:'测试地址'}})` })
})
await page.goto(APP_URL, { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('shicheng:key', 'TESTKEY')
})
await page.reload({ waitUntil: 'networkidle' })
await page.evaluate(() => { location.hash = '#/trip/demo-dali-lijiang' })
await page.waitForTimeout(1100)
await page.waitForFunction(() => !!window.__tmap, null, { timeout: 5000 }).catch(() => {})

const readState = () => page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const t = pinia._s.get('trip').trips.find(x => x.id === 'demo-dali-lijiang')
  return {
    day1: t?.days?.find(d => d.dayIndex === 1),
    pois: Object.values(t?.pois || {}),
  }
})
const day1 = async () => (await readState()).day1
async function gotoDay1() {
  const tabs = page.locator('button.min-w-\\[54px\\]')
  if (await tabs.count()) { await tabs.first().click(); await page.waitForTimeout(350) }
}
const closeCard = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(200) }
const cardTitle = name => page.locator('.paper-card h3').filter({ hasText: name }).first()
const ghost = name => page.locator('g.poi-marker').filter({ has: page.locator(`title:text-is("${name}")`) }).first()

await gotoDay1()

/* 1. 自己的印章只开详情，不擅自加入日程 */
await check('自有印章点击只显示详情', async () => {
  const before = (await day1())?.poiIds?.length || 0
  const target = ghost('色了木')
  if (!await target.count()) return { ok: false, detail: '未找到「色了木」印章' }
  await target.dispatchEvent('click')
  await page.waitForTimeout(250)
  const shown = await cardTitle('色了木').count()
  const after = (await day1())?.poiIds?.length || 0
  await closeCard()
  return { ok: shown > 0 && after === before, detail: `详情=${shown} · poiIds ${before}→${after}` }
})

/* 2. 腾讯真实底图上的原生地点点击后显示详情，由用户决定加不加 */
await check('真实底图 POI 点击显示详情且不直接入日程', async () => {
  const before = (await day1())?.poiIds?.length || 0
  const stubbed = await page.evaluate(() => !!window.__tmap)
  if (!stubbed) return { ok: false, detail: '腾讯 GL 替身未就绪' }
  await page.evaluate(() => {
    window.__tmap.emit('click', {
      poi: { name: '洱海公园', latLng: new window.TMap.LatLng(25.60366, 100.24588) },
      latLng: new window.TMap.LatLng(25.60366, 100.24588),
    })
  })
  await page.waitForTimeout(350)
  const shown = await cardTitle('洱海公园').count()
  const state = await readState()
  const mapPoi = state.pois.find(p => p.id.startsWith('map-') && p.name === '洱海公园')
  const after = state.day1?.poiIds?.length || 0
  await closeCard()
  return {
    ok: shown > 0 && !!mapPoi && after === before,
    detail: `详情=${shown} · 地图来源=${!!mapPoi} · poiIds ${before}→${after}`,
  }
})

/* 3. 真实底图：拖拽交还 GL 原生，根节点不再模拟 transform（松手无回弹）
       —— CSS transform 模拟拖拽已被 verify-native-map.mjs 的原生方案取代 */
await check('真实底图不启用 CSS 模拟拖拽（交还 GL）', async () => {
  const r = await page.evaluate(async () => {
    const root = document.querySelector('.map-cursor')
    const stage = document.querySelector('.map-stage-live')
    if (!root || !stage) return { ok: false, detail: '地图节点缺失' }
    let mutations = 0
    const mo = new MutationObserver(list => {
      if (list.some(m => m.attributeName === 'style')) mutations += 1
    })
    mo.observe(stage, { attributes: true, attributeFilter: ['style'] })
    const rect = root.getBoundingClientRect()
    const opts = { bubbles: true, pointerId: 91, button: 0, buttons: 1, pointerType: 'mouse' }
    root.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: rect.left + 220, clientY: rect.top + 180 }))
    await new Promise(resolve => requestAnimationFrame(resolve))
    const during = root.classList.contains('is-live-pan')
    for (let i = 0; i < 60; i += 1) {
      root.dispatchEvent(new PointerEvent('pointermove', {
        ...opts, clientX: rect.left + 220 + i * 2, clientY: rect.top + 180 + i,
      }))
    }
    await new Promise(resolve => setTimeout(resolve, 120))
    root.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: rect.left + 340, clientY: rect.top + 240 }))
    await new Promise(resolve => setTimeout(resolve, 80))
    const after = root.classList.contains('is-live-pan')
    mo.disconnect()
    // 新契约：根节点的合成 pointer 事件不触发 CSS transform 拖拽；GL 的 dragstart 才置交互态
    return { ok: !during && !after && mutations === 0, mutations, during, after }
  })
  return { ok: r.ok, detail: `60 次移动 → ${r.mutations} 次样式写入 · 交互态 ${r.during}/${r.after}` }
})

log('无脚本异常', errors.length === 0, errors.join(' | '))
await browser.close()
const pass = results.filter(r => r.ok).length
console.log(`\ndone — ${pass}/${results.length} passed`)
process.exit(pass === results.length ? 0 : 1)
