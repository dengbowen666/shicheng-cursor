/**
 * L01–L04 专项回归：城际段（Leg）全生命周期。
 * 断言 localStorage 数据 + DOM，不依赖旧 shoot 选择器。
 * 用法：先 build，另起 vite preview --port 5183，再 node scripts/verify-leg.mjs
 */
import { chromium } from 'playwright'

const URL = `http://127.0.0.1:${process.env.PORT || '5183'}/#/`
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const readDemo = () => page.evaluate(() => {
  const trips = JSON.parse(localStorage.getItem('shicheng:trips') || '{}').trips || []
  return trips.find(t => t.id === 'demo-dali-lijiang')
})
async function enterDemo() {
  await page.evaluate(() => { location.hash = '#/trip/demo-dali-lijiang' })
  await page.waitForTimeout(1100)
}
/** 切到第 n 日（DayRail 日签 button，按 min-w-[54px] 定位后取第 n 个） */
async function gotoDay(n) {
  const tabs = page.locator('button.min-w-\\[54px\\]')
  if (await tabs.count() >= n) { await tabs.nth(n - 1).click(); await page.waitForTimeout(450) }
}

/* L01：seed 示范段存在，旧数据平滑兼容 */
await check('L01 seed 自带一条 Leg 且结构完整', async () => {
  await enterDemo()
  const t = await readDemo()
  const legs = Object.values(t?.legs || {})
  const okLeg = legs.find(l => l.fromCity === '大理' && l.toCity === '丽江' && l.mode === 'highspeed')
  const day4 = t?.days?.find(d => d.dayIndex === 4)
  return {
    ok: !!okLeg && !!day4?.legIds?.includes(okLeg.id) && okLeg.arriveTime === '11:05',
    detail: `legs=${legs.length} day4.legIds=${day4?.legIds?.join(',')}`,
  }
})

/* L03：时间轴把 Leg 渲染成真实条目（非旧 divider 文案） */
await check('L03 时间轴显示城际条目', async () => {
  await gotoDay(4)
  const body = await page.locator('body').innerText()
  // 打开时间轴抽屉
  const tl = page.locator('button:has-text("时间轴")').first()
  if (await tl.count() > 0) { await tl.click(); await page.waitForTimeout(400) }
  const txt = await page.locator('body').innerText()
  const hasLegCity = txt.includes('大理') && txt.includes('丽江')
  const hasNote = txt.includes('D8662')
  return { ok: hasLegCity && hasNote && body.length > 0, detail: `含城际车次=${hasNote}` }
})

/* L02：增设城际段 → 持久化 + cities 同步 + 当日主城切到到达城 */
await check('L02 增设城际段并持久化', async () => {
  await page.keyboard.press('Escape')
  await enterDemo()
  await gotoDay(1)
  const addBtn = page.locator('button:has-text("增设城际段")').first()
  if (await addBtn.count() === 0) return { ok: false, detail: '无增设入口' }
  await addBtn.click()
  await page.waitForTimeout(300)
  // 出发城已默认填好；选到达城
  await page.locator('[data-leg-field="to"]').click()
  await page.waitForTimeout(200)
  const search = page.locator('input[placeholder="搜到达城"]')
  await search.fill('北京')
  await page.waitForTimeout(250)
  const pop = page.locator('div.paper-card').filter({ has: page.locator('input[placeholder="搜到达城"]') })
  const cand = pop.locator('button').filter({ hasText: '北京' }).first()
  await cand.click({ timeout: 3000, noWaitAfter: true }).catch(() => {})
  await page.waitForTimeout(300)
  await page.locator('[data-leg-save]').click()
  await page.waitForTimeout(400)
  const t = await readDemo()
  const day1 = t?.days?.find(d => d.dayIndex === 1)
  const added = Object.values(t?.legs || {}).find(l => l.toCity === '北京')
  const cities = (t?.cities || []).map(c => c.name)
  return {
    ok: !!added && !!day1?.legIds?.includes(added.id) && day1?.city === '北京' && cities.includes('北京'),
    detail: `新段=${added?.fromCity}->${added?.toCity} day1.city=${day1?.city}`,
  }
})

/* L02：删除城际段 + 撤销恢复 */
await check('L02 删除城际段可撤销', async () => {
  const t0 = await readDemo()
  const added = Object.values(t0?.legs || {}).find(l => l.toCity === '北京')
  if (!added) return { ok: false, detail: '无待测段' }
  // 点开该段所在日（Day1）的段条，进入编辑后删除
  await gotoDay(1)
  const legBtn = page.locator(`button[title*="${added.fromCity}→${added.toCity}"]`).first()
  if (await legBtn.count() > 0) { await legBtn.click(); await page.waitForTimeout(300) }
  else { await page.evaluate(id => { location.hash = '#/trip/demo-dali-lijiang' }, added.id) }
  const del = page.locator('button[title="删除这一程"]')
  if (await del.count() === 0) return { ok: false, detail: '无删除入口（弹层未开）' }
  await del.click()
  await page.waitForTimeout(300)
  const afterDel = await readDemo()
  const gone = !Object.values(afterDel?.legs || {}).some(l => l.toCity === '北京')
  // 撤销
  await page.evaluate(() => {
    const bs = [...document.querySelectorAll('button')]
    const b = bs.find(x => x.textContent?.trim() === '撤销')
    if (b) b.click()
  })
  await page.waitForTimeout(300)
  const afterUndo = await readDemo()
  const restored = Object.values(afterUndo?.legs || {}).some(l => l.toCity === '北京')
  return { ok: gone && restored, detail: `已删=${gone} 已恢复=${restored}` }
})

log('无脚本异常', errors.length === 0, errors.join(' | '))
await browser.close()
const pass = results.filter(r => r.ok).length
console.log(`\ndone — ${pass}/${results.length} passed`)
process.exit(pass === results.length ? 0 : 1)
