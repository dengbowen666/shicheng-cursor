/**
 * O01–O13 专项回归：直接断言 DOM / localStorage，不依赖 shoot.mjs 的旧版选择器。
 * 用法：先 npm run build，另起 vite preview --port 5183，再 node scripts/verify-o.mjs
 */
import { chromium } from 'playwright'

const URL = `http://127.0.0.1:${process.env.PORT || '5183'}/#/`
const browser = await chromium.launch()
const results = []
function log(name, ok, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  results.push({ name, ok })
}
async function check(name, fn) {
  try { const r = await fn(); log(name, !!r.ok, r.detail || '') }
  catch (e) { log(name, false, e instanceof Error ? e.message : String(e)) }
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)

async function enterDemo() {
  await page.evaluate(() => { location.hash = '#/trip/demo-dali-lijiang' })
  await page.waitForTimeout(1200)
}
const readTrips = () => page.evaluate(() => JSON.parse(localStorage.getItem('shicheng:trips') || '{}').trips || [])

/* O02：出发时间可编辑 */
await enterDemo()
await check('O02 出发时间可编辑并持久化', async () => {
  const btn = page.locator('button[title="改出发时间"]')
  if (await btn.count() === 0) return { ok: false, detail: '无入口' }
  await btn.first().click()
  const input = page.locator('input[type="time"]')
  if (await input.count() === 0) return { ok: false, detail: '无时间输入' }
  await input.first().fill('08:30')
  await input.first().press('Enter')
  await page.waitForTimeout(300)
  const trips = await readTrips()
  const t = trips.find(x => x.id === 'demo-dali-lijiang')
  return { ok: t?.days?.[0]?.departTime === '08:30', detail: `departTime=${t?.days?.[0]?.departTime}` }
})

/* O01：城市可改 + cities 同步 */
await check('O01 城市可改+cities同步', async () => {
  const cityBtn = page.locator('button[title="改这一天所在城市"]')
  if (await cityBtn.count() === 0) return { ok: false, detail: '无入口' }
  await cityBtn.first().click()
  await page.waitForTimeout(200)
  const search = page.locator('input[placeholder="搜城市，改这一天所在地"]')
  await search.first().fill('北京')
  await page.waitForTimeout(250)
  // 城市浮层里的结果按钮：锁定含搜索框的浮层容器，再找「北京」候选
  const pop = page.locator('div.paper-card').filter({ has: page.locator('input[placeholder="搜城市，改这一天所在地"]') })
  const cand = pop.locator('button').filter({ hasText: '北京' }).first()
  await cand.click({ timeout: 3000 })
  await page.waitForTimeout(300)
  const trips = await readTrips()
  const t = trips.find(x => x.id === 'demo-dali-lijiang')
  const day0 = t?.days?.[0]?.city
  const cities = (t?.cities || []).map(c => c.name)
  return { ok: day0 === '北京' && cities.includes('北京'), detail: `day0=${day0} cities=${cities.join('/')}` }
})

/* O03：统一撤销 */
await check('O03 统一撤销生效', async () => {
  const btn = page.locator('button[title="改出发时间"]')
  await btn.first().click()
  const input = page.locator('input[type="time"]')
  await input.first().fill('07:15')
  await input.first().press('Enter')
  await page.waitForTimeout(200)
  await page.evaluate(() => {
    const bs = [...document.querySelectorAll('button')]
    const b = bs.find(x => x.textContent?.trim() === '撤销')
    if (b) b.click()
  })
  await page.waitForTimeout(300)
  const trips = await readTrips()
  const t = trips.find(x => x.id === 'demo-dali-lijiang')
  return { ok: t?.days?.[0]?.departTime !== '07:15', detail: `departTime=${t?.days?.[0]?.departTime}` }
})

/* O07：dayStats 排除驻地 */
await check('O07 处数不含驻地', async () => {
  const trips = await readTrips()
  const t = trips.find(x => x.id === 'demo-dali-lijiang')
  if (!t) return { ok: false, detail: '无数据' }
  const d = t.days[0]
  const stops = d.poiIds.filter(id => t.pois[id] && t.pois[id].role !== 'base')
  const m = (await page.locator('body').innerText()).match(/(\d+)\s*处/)
  return { ok: !!m && Number(m[1]) === stops.length, detail: `显示=${m?.[1]} 应为=${stops.length}` }
})

/* O06：dismissed 持久化 */
await check('O06 dismissed 持久化', async () => {
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('shicheng:dismissed') || '{}')
    d['demo-dali-lijiang'] = [...(d['demo-dali-lijiang'] || []), 'reorder@1']
    localStorage.setItem('shicheng:dismissed', JSON.stringify(d))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('shicheng:dismissed') || '{}'))
  return { ok: (after['demo-dali-lijiang'] || []).includes('reorder@1') }
})

/* O05：固定走法写入 pinned */
await check('O05 固定走法写入 pinned', async () => {
  await enterDemo()
  const seg = page.locator('button[title^="改交通方式"]').first()
  if (await seg.count() === 0) return { ok: false, detail: '无交通段' }
  await seg.click()
  await page.waitForTimeout(300)
  const pinBtn = page.locator('button').filter({ hasText: '固定此走法' })
  if (await pinBtn.count() === 0) return { ok: false, detail: '无固定入口' }
  await pinBtn.first().click()
  await page.waitForTimeout(300)
  const trips = await readTrips()
  const t = trips.find(x => x.id === 'demo-dali-lijiang')
  const pinnedCount = Object.values(t?.segments || {}).filter(s => s.pinned).length
  await page.keyboard.press('Escape') // 关掉交通弹层，避免遮挡后续操作
  await page.waitForTimeout(200)
  return { ok: pinnedCount > 0, detail: `pinned段=${pinnedCount}` }
})

/* O10：面板折叠 */
await check('O10 面板可折叠', async () => {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await enterDemo()
  const before = await page.locator('button[title="收起工作台，给地图让位"]').count()
  if (before === 0) return { ok: false, detail: '无收起入口' }
  await page.locator('button[title="收起工作台，给地图让位"]').first().click()
  await page.waitForTimeout(250)
  const after = await page.locator('button[title="展开工作台"]').count()
  return { ok: after > 0 }
})

/* O09：导入预检不破坏数据（打开设置弹层 → 选文件） */
await check('O09 导入冲突有确认层', async () => {
  await page.evaluate(() => { location.hash = '#/' })
  await page.waitForTimeout(900)
  const before = (await readTrips()).length
  const backup = await page.evaluate(() => localStorage.getItem('shicheng:trips'))
  // 桌面首页挂轴默认收起，先展开
  const rail = page.locator('button[aria-label="展开挂轴"]')
  if (await rail.count() > 0) { await rail.first().click(); await page.waitForTimeout(500) }
  const settingBtn = page.locator('button').filter({ hasText: '设置 · Key / 备份' })
  if (await settingBtn.count() === 0) return { ok: false, detail: '无设置入口' }
  await settingBtn.first().click()
  await page.waitForTimeout(400)
  const chooser = page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null)
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input[type="file"]')]
    if (inputs[0]) inputs[0].click()
  })
  const fc = await chooser
  if (!fc) return { ok: false, detail: '无文件选择器' }
  await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
  await page.waitForTimeout(700)
  const hasModal = await page.locator('text=备份中有同名攻略').count()
  const after = (await readTrips()).length
  return { ok: hasModal > 0 && before === after, detail: `冲突层=${hasModal} trips ${before}->${after}` }
})

log('无脚本异常', errors.length === 0, errors.join(' | '))
await browser.close()
const pass = results.filter(r => r.ok).length
console.log(`\ndone — ${pass}/${results.length} passed`)
process.exit(pass === results.length ? 0 : 1)
