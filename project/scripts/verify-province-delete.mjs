/**
 * 省视图分离 + 清单删除专项回归。
 * 用法：先 build，另起 vite preview --port 5183，再 node scripts/verify-province-delete.mjs
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

async function openScroll() {
  const rail = page.getByRole('button', { name: /展开挂轴/ })
  if (await rail.count() && await rail.isVisible()) await rail.first().click()
  await page.waitForTimeout(350)
}
const cards = () => page.locator('.scroll-panel [data-side-trip]')

/* 删除：两态都能删，二次确认后走撤销栈 */
await openScroll()
const tripCount = () => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('shicheng:trips') || '{}')
  return Array.isArray(raw.trips) ? raw.trips.length : 0
})
await check('D01 印记态有删除按钮且需二次确认', async () => {
  const before = await cards().count()
  const dataBefore = await tripCount()
  const card = cards().first()
  const del = card.locator('button[title*="删除"]')
  const delCount = await del.count()
  await del.click(); await page.waitForTimeout(150)
  const confirmVisible = await card.getByRole('button', { name: '确认' }).count()
  const mid = await cards().count()
  const dataMid = await tripCount()
  await card.getByRole('button', { name: '确认' }).click(); await page.waitForTimeout(300)
  const after = await cards().count()
  const dataAfter = await tripCount()
  return { ok: delCount >= 1 && confirmVisible === 1 && mid === before && after === before - 1,
    detail: `卡 ${before}/${mid}/${after}, 确认按钮=${confirmVisible}` }
})
await check('D02 删除可一次撤销恢复', async () => {
  const before = await tripCount()
  const undo = page.getByRole('button', { name: '撤销' })
  const n = await undo.count()
  if (n) await undo.first().click()
  await page.waitForTimeout(300)
  return { ok: n >= 1 && await tripCount() === before + 1, detail: `撤销按钮=${n}, 数据 ${before} -> ${await tripCount()}` }
})

await check('D03 印记态可归档（移到行迹且可撤销）', async () => {
  const before = await cards().count()
  const card = cards().first()
  const archiveBtn = card.locator('button[title="归入行迹"]')
  const hasArchive = await archiveBtn.count()
  if (!hasArchive) return { ok: false, detail: '无归档按钮' }
  await archiveBtn.dispatchEvent('click'); await page.waitForTimeout(350)
  const afterMark = await cards().count()
  // 切到行迹态确认归档卷在此
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role=tab]')]
    const t = tabs.find(x => x.textContent.trim() === '行迹')
    if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(400)
  const inTrail = await cards().count()
  // 切回印记态，保持后续省视图测试状态干净
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role=tab]')]
    const t = tabs.find(x => x.textContent.trim() === '印记')
    if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(350)
  return { ok: hasArchive === 1 && afterMark === before - 1 && inTrail >= 1,
    detail: `归档按钮=${hasArchive}, 印记 ${before}→${afterMark}, 行迹卷=${inTrail}` }
})

/* 省视图：下钻后左轴淡出、字号匾额可见、悬浮邻省不再变色 */
let focused = false
await check('V01 点省份下钻进入省视图', async () => {
  const close = page.getByRole('button', { name: '收合' })
  if (await close.count() && await close.isVisible()) { await close.first().click(); await page.waitForTimeout(300) }
  const paths = page.locator('svg path.cursor-pointer')
  const n = await paths.count()
  if (!n) return { ok: false, detail: '无省份可点' }
  await paths.first().dispatchEvent('click'); await page.waitForTimeout(900)
  focused = await page.getByRole('button', { name: /返 · 九州/ }).count() > 0
  return { ok: focused, detail: `返回按钮=${focused ? 1 : 0}` }
})
await check('V02 省视图左轴常显（渐隐浮层覆盖地图，无实底硬切）', async () => {
  const axis = page.locator('div.pointer-events-none.absolute.z-20.left-0.top-0.bottom-0')
  const cls = await axis.getAttribute('class') || ''
  const opacity = await axis.evaluate(el => getComputedStyle(el).opacity)
  const grad = await axis.evaluate(el => getComputedStyle(el).backgroundImage)
  return { ok: opacity === '1' && !cls.includes('bg-paper/97') && cls.includes('from-paper/95') && grad.includes('gradient'),
    detail: `opacity=${opacity}, 实底=${cls.includes('bg-paper/97')}, 强化浮层=${cls.includes('from-paper/95')}, 渐变=${grad.includes('gradient')}` }
})
await check('V03 省名匾额大字可见', async () => {
  const head = page.locator('.font-brush.text-\\[26px\\]')
  const n = await head.count()
  const text = n ? (await head.first().innerText()).trim() : ''
  return { ok: n >= 1 && text.length >= 2, detail: `匾额="${text}"` }
})
await check('V03b 返九州按钮编排在左轴内', async () => {
  const axis = page.locator('div.pointer-events-none.absolute.z-20.left-0.top-0.bottom-0')
  const inAxis = await axis.getByRole('button', { name: /返 · 九州/ }).count()
  const all = await page.getByRole('button', { name: /返 · 九州/ }).count()
  return { ok: inAxis === 1 && all === 1, detail: `左轴内=${inAxis}, 页面总计=${all}` }
})
await check('V04 悬浮背景省份不再变色（pointer-events=none）', async () => {
  const paths = page.locator('svg path[fill-opacity]')
  const n = await paths.count()
  let interactive = 0
  for (let i = 0; i < n; i++) {
    const pe = await paths.nth(i).evaluate(el => el.getAttribute('pointer-events') || getComputedStyle(el).pointerEvents)
    if (pe === 'auto') interactive++
  }
  return { ok: interactive === 0, detail: `可交互省份=${interactive}/${n}` }
})
await check('V05 返回按钮退出省视图', async () => {
  const back = page.getByRole('button', { name: /返 · 九州/ })
  if (!await back.count()) return { ok: false, detail: '无返回按钮' }
  await back.first().click(); await page.waitForTimeout(800)
  const gone = await page.getByRole('button', { name: /返 · 九州/ }).count() === 0
  const axis = page.locator('div.pointer-events-none.absolute.z-20.left-0.top-0.bottom-0')
  const cls = await axis.getAttribute('class') || ''
  return { ok: gone && !cls.includes('from-paper/95') && cls.includes('from-paper/85'), detail: `返回按钮消失=${gone}, 浮层恢复普通态=${cls.includes('from-paper/85')}` }
})
// 重新进入省视图截图
const paths2 = page.locator('svg path.cursor-pointer')
if (await paths2.count()) { await paths2.first().dispatchEvent('click'); await page.waitForTimeout(900) }
await page.screenshot({ path: `${SHOT}/verify-province.png` })

const failed = results.filter(r => !r.ok)
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`)
await browser.close()
process.exit(failed.length || errors.length ? 1 : 0)
