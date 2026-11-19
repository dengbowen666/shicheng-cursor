/* 验证跨设备同步链路（全部走真实 DOM 与真实 localStorage，不造假）：
   设备 A 造 2 份攻略 → 导出备份 → 设备 B（全新上下文，自带一份 A 没有的多余攻略）
   → 通过真实 UI 导入并选「同步本机/整体替换」→ 设备 B 与 A 完全一致、多余攻略消失
   → 刷新后仍一致（持久化）。用最小静态服务托管 dist，不依赖外部预览进程。 */
import { chromium } from 'playwright'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('dist')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (p === '/' || p === '') p = '/index.html'
  const file = path.join(ROOT, p)
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const PORT = server.address().port
const URL = `http://127.0.0.1:${PORT}/#/`

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? ' · ' + detail : ''}`) }
  else { fail++; console.log(`FAIL ${name}${detail ? ' · ' + detail : ''}`) }
}

const STUB = `(function(){
class LatLng{constructor(a,b){this.lat=a;this.lng=b}getLat(){return this.lat}getLng(){return this.lng}}
class Map{constructor(el,o){this.el=el;this.center=o.center;this.zoom=o.zoom;this.h={};window.__tmap=this;
  const c=document.createElement('canvas');c.width=32;c.height=32;el.appendChild(c);this.canvas=c;setTimeout(()=>this.emit('tilesloaded',{}),30)}
  on(n,f){(this.h[n]||(this.h[n]=[])).push(f)}emit(n,e){(this.h[n]||[]).forEach(f=>f(e))}
  setCenter(c){this.center=c}setZoom(z){this.zoom=z}getCenter(){return this.center}getZoom(){return this.zoom}
  getBounds(){const c=this.center||new LatLng(26.87,100.23);return{getNorthEast:()=>new LatLng(c.getLat()+0.01,c.getLng()+0.015),getSouthWest:()=>new LatLng(c.getLat()-0.01,c.getLng()-0.015)}}
  getStyles(){return this.styles||[]}setStyles(l){this.styles=l}setStyle(){}setMapStyleId(){}setMapStyle(){}resize(){}destroy(){}}
window.TMap={Map,LatLng,service:{}}})()`

const browser = await chromium.launch()
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const pageA = await ctxA.newPage()
const pageB = await ctxB.newPage()
pageA.on('pageerror', e => console.log('PAGEERR-A', e.message))
pageB.on('pageerror', e => console.log('PAGEERR-B', e.message))
for (const p of [pageA, pageB]) {
  await p.route('**/api/gljs**', r => r.fulfill({ contentType: 'application/javascript', body: STUB }))
  await p.route('**/ws/**', r => {
    const cb = new URL(r.request().url()).searchParams.get('callback') || '_'
    r.fulfill({ contentType: 'application/javascript', body: `${cb}({status:0,data:[],result:{address:'测试地址'}})` })
  })
}

// 直接把一份完整 trip 写进 localStorage 并刷新，模拟该设备的既有数据
const writeTrips = async (page, trips) => {
  await page.evaluate((trips) => {
    localStorage.setItem('shicheng:trips', JSON.stringify({ schema: 1, trips }))
  }, trips)
  await page.reload({ waitUntil: 'networkidle' })
}
// 从 dist 的 seed 模块构造一份合法 demo（字段完整，能被 normalizeTrip 接受）
const demoTrip = {
  id: 'demo-dali-lijiang', title: '大理 · 丽江 5日', sealText: '远游',
  cities: [{ name: '大理', center: { lng: 100.23, lat: 25.7 } }, { name: '丽江', center: { lng: 100.23, lat: 26.87 } }],
  startDate: '2026-11-16', days: [{ dayIndex: 1, date: '2026-11-16', city: '大理', title: 'Day 1 · 大理', departTime: '09:00', poiIds: [], basePoiId: undefined, segmentIds: [], legIds: [] }],
  pois: {}, wishlist: [], segments: {}, legs: {}, expenses: [], annotations: [],
  totalBudget: 0, coverImage: '', archived: false, createdAt: Date.now(), updatedAt: Date.now(),
}
const fullATrips = [demoTrip, { ...JSON.parse(JSON.stringify(demoTrip)), id: 'sync-test-trip', title: '跨设备同步测试卷', createdAt: Date.now() }]

// ---------- 设备 A：写入 2 份攻略 ----------
await pageA.goto(URL, { waitUntil: 'networkidle' })
await pageA.evaluate(() => localStorage.clear())
await writeTrips(pageA, fullATrips)
const fullA = await pageA.evaluate(() => JSON.parse(localStorage.getItem('shicheng:trips')).trips.map(t => t.id).sort())
check('设备 A 有 2 份攻略（demo + 自建）', fullA.length === 2 && fullA.includes('sync-test-trip'), JSON.stringify(fullA))

// 真实导出：打开设置 → 点「导出备份」→ 捕获下载文件内容
await pageA.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /设置/.test(b.textContent || ''))
  if (btn) btn.click()
})
await pageA.waitForTimeout(300)
const [download] = await Promise.all([
  pageA.waitForEvent('download', { timeout: 5000 }),
  pageA.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /导出备份/.test(b.textContent || ''))
    if (btn) btn.click()
  }),
])
const backupPath = await download.path()
const backupText = fs.readFileSync(backupPath, 'utf8')
let backupParsed
try { backupParsed = JSON.parse(backupText) } catch { backupParsed = null }
check('导出备份是合法 JSON 且含 2 份攻略', !!backupParsed && backupParsed.trips?.length === 2, `trips=${backupParsed?.trips?.length}`)

// ---------- 设备 B：全新上下文，写入 demo + 一份"A 没有的多余攻略"，模拟两台机器已分叉 ----------
await pageB.goto(URL, { waitUntil: 'networkidle' })
await pageB.evaluate(() => localStorage.clear())
await writeTrips(pageB, [demoTrip, { ...JSON.parse(JSON.stringify(demoTrip)), id: 'local-only-garbage', title: '仅本机多余攻略', createdAt: Date.now() }])
const beforeB = await pageB.evaluate(() => JSON.parse(localStorage.getItem('shicheng:trips')).trips.map(t => t.id).sort())
check('设备 B 替换前含多余攻略（分叉状态）', beforeB.includes('local-only-garbage'), JSON.stringify(beforeB))

// 真实 UI 导入：设置 → 导入恢复 → 选文件 → 弹窗选「同步本机」
await pageB.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /设置/.test(b.textContent || ''))
  if (btn) btn.click()
})
await pageB.waitForTimeout(300)
const fileInput = pageB.locator('input[type="file"]')
await fileInput.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) })
await pageB.waitForTimeout(300)
const syncBtn = pageB.locator('button', { hasText: '同步本机' })
const syncVisible = await syncBtn.isVisible().catch(() => false)
check('导入弹窗出现「同步本机」选项', syncVisible)
if (syncVisible) await syncBtn.click()
await pageB.waitForTimeout(400)

const afterB = await pageB.evaluate(() => JSON.parse(localStorage.getItem('shicheng:trips')).trips.map(t => t.id).sort())
check('整体替换后设备 B 与设备 A 完全一致', JSON.stringify(afterB) === JSON.stringify(fullA), `A=${JSON.stringify(fullA)} B=${JSON.stringify(afterB)}`)
check('本机多余攻略已被清除', !afterB.includes('local-only-garbage'), JSON.stringify(afterB))
check('设备 A 的自建攻略已同步过来', afterB.includes('sync-test-trip'), JSON.stringify(afterB))

// 刷新验证持久化
await pageB.reload({ waitUntil: 'networkidle' })
const persistedB = await pageB.evaluate(() => JSON.parse(localStorage.getItem('shicheng:trips')).trips.map(t => t.id).sort())
check('刷新后仍一致（持久化生效）', JSON.stringify(persistedB) === JSON.stringify(fullA), JSON.stringify(persistedB))

// ---------- 撤销验证：重新走一次替换，然后点 toast 的撤销，应恢复到替换前 ----------
await pageB.evaluate(() => localStorage.clear())
await writeTrips(pageB, [demoTrip, { ...JSON.parse(JSON.stringify(demoTrip)), id: 'local-only-garbage', title: '仅本机多余攻略', createdAt: Date.now() }])
await pageB.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /设置/.test(b.textContent || ''))
  if (btn) btn.click()
})
await pageB.waitForTimeout(300)
await pageB.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) })
await pageB.waitForTimeout(300)
await pageB.locator('button', { hasText: '同步本机' }).click()
await pageB.waitForTimeout(400)
const undoBtn = pageB.locator('button', { hasText: /^撤销$/ })
const hasUndo = await undoBtn.isVisible().catch(() => false)
check('整体替换后出现撤销按钮', hasUndo)
if (hasUndo) {
  await undoBtn.click()
  await pageB.waitForTimeout(400)
  const afterUndo = await pageB.evaluate(() => JSON.parse(localStorage.getItem('shicheng:trips')).trips.map(t => t.id).sort())
  check('撤销恢复到替换前（多余攻略回来了）', afterUndo.includes('local-only-garbage') && !afterUndo.includes('sync-test-trip'), JSON.stringify(afterUndo))
}

await browser.close()
server.close()
console.log(`\n结果：${pass} PASS / ${fail} FAIL`)
process.exit(fail ? 1 : 0)
