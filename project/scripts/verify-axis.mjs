/**
 * 卷首左轴专项回归：左轴元素齐全 + 两态气韵切换 + 年次联动挂轴 + 小屏题签保留。
 * 用法：先 build，另起 vite preview --port 5183，再 node scripts/verify-axis.mjs
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
// 注入跨年份跨状态数据，让年次与气韵都有内容
await page.evaluate(() => {
  const mk = (id, title, sd, archived) => ({
    id, title, sealText: title.slice(0, 2), startDate: sd, archived,
    cities: [{ id: 'c-dali', name: '大理', province: '云南', center: { lng: 100.267, lat: 25.606 } }],
    days: [{ dayIndex: 1, city: '大理', poiIds: [], segmentIds: [], legIds: [] }],
    pois: {}, segments: {}, legs: {}, expenses: [], annotations: [], wishlist: [],
    completedAt: archived && sd ? Date.parse(`${sd}T10:00:00`) : undefined,
    updatedAt: sd ? Date.parse(`${sd}T09:00:00`) : Date.now(), createdAt: Date.now(),
  })
  localStorage.setItem('shicheng:trips', JSON.stringify({ schema: 1, trips: [
    mk('a', '二六秋行', '2026-11-16', false),
    mk('b', '二五春游', '2025-05-01', false),
    mk('c', '二四旧旅', '2024-08-01', true),
  ] }))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)

// 左轴容器：桌面宽 130px、含分界线与题签
const axis = page.locator('div.pointer-events-none.absolute.z-20.left-0.top-0.bottom-0')
await check('A01 桌面卷首左轴存在且有分界线', async () => {
  const n = await axis.count()
  const lines = await axis.locator('span.absolute[class*="right-"]').count()
  return { ok: n === 1 && lines >= 2, detail: `左轴=${n}, 分界线=${lines}` }
})
await check('A02 左轴元素齐全（题签/态铭/气韵/印谱/年次）', async () => {
  const txt = await axis.innerText()
  const ok = ['拾程', '当前卷帙', '印记', '印谱', '朱印 · 将行', '行印 · 已钤', '虚边 · 未至', '墨线 · 城际', '年次'].every(s => txt.includes(s))
  return { ok, detail: txt.replace(/\s+/g, ' ').slice(0, 90) }
})
await check('A03 印记态气韵数字为 2 卷 / 1 城 / 0 章', async () => {
  const nums = await axis.locator('.tabular-nums').allInnerTexts()
  return { ok: nums.join(',') === '2,1,0', detail: nums.join(',') }
})

/* 年次联动：点 2025 年 → 挂轴展开且滚到该年分组 */
await check('A04 年次按钮联动挂轴展开并定位', async () => {
  const btn = axis.getByRole('button', { name: '2025' })
  await btn.click(); await page.waitForTimeout(600)
  const open = await page.locator('.scroll-panel').getAttribute('aria-hidden')
  const target = page.locator('#year-mark-2025')
  const count = await target.count()
  const inView = count ? await target.evaluate(el => {
    const r = el.getBoundingClientRect(); const p = el.closest('.overflow-y-auto')?.getBoundingClientRect()
    return !!p && r.top >= p.top - 4 && r.top <= p.bottom
  }) : false
  return { ok: open === 'false' && count === 1 && inView, detail: `挂轴aria-hidden=${open}, 目标=${count}, 在视野=${inView}` }
})

/* 切行迹态：态铭与气韵切换（1 城 / 1 日 / 0 章，因已行卷无盖章） */
await page.evaluate(() => {
  const t = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === '行迹')
  if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(500)
await check('A05 行迹态态铭与气韵切换', async () => {
  const txt = await axis.innerText()
  const nums = await axis.locator('.tabular-nums').allInnerTexts()
  return { ok: txt.includes('行迹') && !txt.includes('印记') && nums.join(',') === '1,1,0',
    detail: `态=${txt.includes('行迹') ? '行迹' : '印记'}, 数字=${nums.join(',')}` }
})
await page.screenshot({ path: `${SHOT}/verify-axis-trail.png` })

/* 小屏：桌面左轴隐藏，压边题签保留 */
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(400)
await check('A06 小屏保留压边题签', async () => {
  const desktopAxisVisible = await axis.isVisible()
  const matches = await page.locator('.md\\:hidden .vertical-text').allInnerTexts()
  return { ok: !desktopAxisVisible && matches.some(t => t.includes('拾程')),
    detail: `桌面左轴可见=${desktopAxisVisible}, 小屏题签=${matches.join('|')}` }
})

const failed = results.filter(r => !r.ok)
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`)
await browser.close()
process.exit(failed.length || errors.length ? 1 : 0)
