/**
 * 侧栏清单专项回归：印记/行迹两态分离 + 按时间排序 + 年份展开收拢 + 恢复归位。
 * 用法：先 build，另起 vite preview --port 5183，再 node scripts/verify-side-list.mjs
 */
import { chromium } from 'playwright'

const URL = `http://127.0.0.1:${process.env.PORT || '5183'}/#/`
const SHOT = 'screenshots'
const browser = await chromium.launch()
const results = []
const errors = []
function log(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  results.push({ name, ok })
}
async function check(name, fn) {
  try { const r = await fn(); log(name, !!r.ok, r.detail || '') }
  catch (e) { log(name, false, e instanceof Error ? e.message : String(e)) }
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', e => errors.push(e.message))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)

// 种子数据只在内存，不落 localStorage；这里注入最小合法 trip（store 会 normalize 补齐字段）
await page.evaluate(() => {
  const key = 'shicheng:trips'
  const mk = (id, title, startDate, archived) => ({
    id, title, sealText: title.slice(0, 2), startDate, archived,
    cities: [{ id: 'c-dali', name: '大理', province: '云南', center: { lng: 100.267, lat: 25.606 } }],
    days: [{ dayIndex: 1, city: '大理', poiIds: [], segmentIds: [], legIds: [] }],
    pois: {}, segments: {}, legs: {}, expenses: [], annotations: [], wishlist: [],
    completedAt: archived && startDate ? Date.parse(`${startDate}T10:00:00`) : undefined,
    updatedAt: startDate ? Date.parse(`${startDate}T09:00:00`) : Date.now(),
    createdAt: Date.now(),
  })
  const trips = [
    mk('t-2026-active', '二六秋行', '2026-11-16', false),
    mk('t-2025-active', '二十五春游', '2025-05-01', false),
    mk('t-nodate-active', '未定之程', undefined, false),
    mk('t-2026-done', '二六春行', '2026-03-01', true),
    mk('t-2024-done', '二四旧旅', '2024-08-01', true),
  ]
  localStorage.setItem(key, JSON.stringify({ schema: 1, trips }))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)

async function openScroll() {
  const rail = page.getByRole('button', { name: /展开挂轴/ })
  if (await rail.count() && await rail.isVisible()) await rail.first().click()
  await page.waitForTimeout(350)
}
await openScroll()

const panel = page.locator('.scroll-panel')
const title = () => panel.locator('h2').filter({ hasText: /我的攻略|已行卷/ }).first()
const cards = () => panel.locator('[data-side-trip]')
const yearHeads = () => panel.locator('button[aria-expanded]').filter({ hasText: /\d{4}|未定年/ }).filter({ hasText: /卷/ })
async function headsText() { return (await yearHeads().allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()) }

/* 印记态：只列未归档的三卷，按年 2026→2025→未定年 */
await check('S01 印记态标题与数量正确', async () => {
  const t = await title().innerText()
  return { ok: t.includes('我的攻略') && await cards().count() === 3, detail: `标题=${t}, 卡=${await cards().count()}` }
})
await check('S02 印记态按年份由近及远分组', async () => {
  const hs = await headsText()
  return { ok: hs.length === 3 && hs[0].startsWith('2026') && hs[1].startsWith('2025') && hs[2].startsWith('未定年'), detail: hs.join(' | ') }
})
await check('S03 印记态不含已行卷', async () => {
  const txt = await panel.innerText()
  return { ok: !txt.includes('二六春行') && !txt.includes('二四旧旅'), detail: '' }
})

/* 年份折叠：点组头收起，卡片隐藏；再点展开 */
await check('S04 年份组头可收拢与展开', async () => {
  const head = yearHeads().first()
  await head.click(); await page.waitForTimeout(200)
  const collapsed = await head.getAttribute('aria-expanded')
  const hidden = await cards().first().isVisible()
  await head.click(); await page.waitForTimeout(200)
  const expanded = await head.getAttribute('aria-expanded')
  const shown = await cards().first().isVisible()
  return { ok: collapsed === 'false' && !hidden && expanded === 'true' && shown,
    detail: `收起=${collapsed}/可见=${hidden}, 展开=${expanded}/可见=${shown}` }
})
await check('S05 全收/全展控制生效', async () => {
  await panel.locator('button[title*="收拢所有年份"]').click(); await page.waitForTimeout(200)
  let visibleAfterFold = 0
  for (const c of await cards().all()) if (await c.isVisible()) visibleAfterFold++
  await panel.locator('button[title*="展开所有年份"]').click(); await page.waitForTimeout(200)
  let visibleAfterUnfold = 0
  for (const c of await cards().all()) if (await c.isVisible()) visibleAfterUnfold++
  return { ok: visibleAfterFold === 0 && visibleAfterUnfold === 3,
    detail: `全收后可见=${visibleAfterFold}, 全展后可见=${visibleAfterUnfold}` }
})

/* 切到行迹态：只列两卷已归档 */
const trailTab = page.getByRole('tab', { name: '行迹' })
await trailTab.click(); await page.waitForTimeout(500)
await check('S06 行迹态标题与数量正确', async () => {
  const t = await title().innerText()
  return { ok: t.includes('已行卷') && await cards().count() === 2, detail: `标题=${t}, 卡=${await cards().count()}` }
})
await check('S07 行迹态按年份由近及远分组', async () => {
  const hs = await headsText()
  return { ok: hs.length === 2 && hs[0].startsWith('2026') && hs[1].startsWith('2024'), detail: hs.join(' | ') }
})
await check('S08 行迹态不含未行攻略', async () => {
  const txt = await panel.innerText()
  return { ok: !txt.includes('二六秋行') && !txt.includes('二十五春游'), detail: '' }
})
await page.screenshot({ path: `${SHOT}/verify-side-trail.png` })

/* 两态折叠状态独立：行迹态收起后切回印记，印记态应仍全展开 */
await check('S09 两态折叠状态互相独立', async () => {
  await yearHeads().first().click(); await page.waitForTimeout(150)
  const trailCollapsed = await yearHeads().first().getAttribute('aria-expanded')
  await page.getByRole('tab', { name: '印记' }).click(); await page.waitForTimeout(400)
  const markExpanded = await yearHeads().first().getAttribute('aria-expanded')
  return { ok: trailCollapsed === 'false' && markExpanded === 'true', detail: `行迹=${trailCollapsed}, 印记=${markExpanded}` }
})

/* 恢复：行迹态恢复一卷后，应离开已行卷并出现在印记态 */
await check('S10 恢复后卷归位印记态', async () => {
  await page.getByRole('tab', { name: '行迹' }).click(); await page.waitForTimeout(400)
  const done = cards().filter({ hasText: '二四旧旅' }).first()
  await done.getByRole('button', { name: '恢复' }).click(); await page.waitForTimeout(400)
  const trailTxt = await panel.innerText()
  await page.getByRole('tab', { name: '印记' }).click(); await page.waitForTimeout(400)
  const markTxt = await panel.innerText()
  return { ok: !trailTxt.includes('二四旧旅') && markTxt.includes('二四旧旅'),
    detail: `行迹仍含=${trailTxt.includes('二四旧旅')}, 印记含=${markTxt.includes('二四旧旅')}` }
})
await page.screenshot({ path: `${SHOT}/verify-side-mark.png` })

const failed = results.filter(r => !r.ok)
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`)
await browser.close()
process.exit(failed.length || errors.length ? 1 : 0)
