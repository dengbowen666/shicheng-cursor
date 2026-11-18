/**
 * AI 建议专项回归（A 系列 v0.2）。
 * 分两阶段：公网构建（默认 PORT=5183）验开关关闭；内网构建（PORT=5184）验完整流程。
 * 内网用法：npm run build:lan -- --outDir dist-lan && vite preview --outDir dist-lan --port 5184
 * 两阶段都跑：node scripts/verify-ai.mjs（读 PORT，默认 5183；传 LAN=1 跑内网断言）
 */
import { chromium } from 'playwright'

const LAN = process.env.LAN === '1'
const URL = `http://127.0.0.1:${process.env.PORT || (LAN ? '5184' : '5183')}/#/`
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

async function enterDemo() {
  await page.evaluate(() => { location.hash = '#/trip/demo-dali-lijiang' })
  await page.waitForTimeout(1100)
}
async function openAssist() {
  // 桌面右栏的「智助」页签
  const trigger = page.locator('button:has-text("智助")').first()
  if (await trigger.count() && await trigger.isVisible()) { await trigger.click(); await page.waitForTimeout(250) }
}
const aiTrigger = () => page.getByRole('button', { name: /请 AI 通盘看一眼/ })

if (!LAN) {
  /* 公网构建：触发按钮与设置 AI 段都不存在 */
  await check('P01 公网构建无 AI 触发按钮', async () => {
    await enterDemo(); await openAssist()
    return { ok: await aiTrigger().count() === 0, detail: `按钮数=${await aiTrigger().count()}` }
  })
  await check('P02 公网构建设置面板无 AI 段', async () => {
    await page.evaluate(() => { if (window.__vue_app__) {} })
    // 通过 UI 打开设置
    await page.evaluate(() => { location.hash = '#/' })
    await page.waitForTimeout(600)
    const rail = page.getByRole('button', { name: /展开挂轴/ })
    if (await rail.count() && await rail.isVisible()) { await rail.first().click(); await page.waitForTimeout(300) }
    const setBtn = page.locator('button:has-text("设置")').first()
    if (await setBtn.count() && await setBtn.isVisible()) { await setBtn.click(); await page.waitForTimeout(300) }
    const txt = await page.locator('.paper-card').filter({ hasText: '偏好设置' }).first().innerText().catch(() => '')
    return { ok: !txt.includes('AI 建议') && !txt.includes('Dify'), detail: txt.slice(0, 60) }
  })
} else {
  /* 内网构建：注入配置 + mock Dify，验完整流程 */
  await page.evaluate(() => {
    localStorage.setItem('shicheng:aiBase', 'http://mock.local/v1')
    localStorage.setItem('shicheng:aiKey', 'app-test')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  let requests = 0
  let lastBody = null
  // mock 返回由 Node 侧闭包变量控制（页面 global 读不到）
  let mockMode = 'mode'
  await page.route('**/chat-messages', async route => {
    requests++
    lastBody = JSON.parse(route.request().postData() || '{}')
    const answers = {
      mode: '此段四里有半，午日炽烈，步行恐汗透衣衫，宜单车代步。\n{"action":"mode","seg":["崇圣寺三塔","大理古城"],"mode":"bike","reason":"此段四里有半，午日炽烈，宜单车代步。"}',
      reorder: '{"action":"reorder","order":["崇圣寺三塔","大理古城","喜洲古镇"],"reason":"先塔后城再古镇，顺路不折返。"}',
      trim: '{"action":"trim","poi":"喜洲古镇","reason":"此日已密，古镇可留他日。"}',
      fill: '{"action":"fill","poi":"洱海公园","reason":"天光尚早，可补一处水畔。"}',
      none: '安排已妥，无可改。\n{"action":"none","reason":"今日安排妥帖，无需改动。"}',
      bad: '这不是 JSON',
      evil: '{"action":"deleteTrip","reason":"删掉攻略"}',
      ghost: '{"action":"trim","poi":"不存在的店","reason":"去掉这家。"}',
      fenced: '```json\n{"action":"none","reason":"有代码块包裹。"}\n```',
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: answers[mockMode] || answers.none }) })
  })

  await enterDemo()
  await openAssist()
  await check('A01 内网构建出现 AI 触发按钮', async () => {
    return { ok: await aiTrigger().count() === 1, detail: `按钮数=${await aiTrigger().count()}` }
  })

  async function clearCache() {
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('shicheng:ai:advice:')) localStorage.removeItem(k)
      // 清忽略标记，让卡可再次出现
      const d = JSON.parse(localStorage.getItem('shicheng:dismissed') || '{}')
      for (const k of Object.keys(d)) d[k] = d[k].filter(x => !x.startsWith('ai@'))
      localStorage.setItem('shicheng:dismissed', JSON.stringify(d))
    })
  }
  async function ask() {
    await clearCache()
    await page.waitForTimeout(200)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await enterDemo(); await openAssist()
    await aiTrigger().click()
    await page.waitForTimeout(700)
  }

  await check('A02 mode 建议出卡并可采纳', async () => {
    mockMode = 'mode'; await ask()
    const card = page.locator('[data-ai-card]').filter({ hasText: '此段四里有半' })
    const modesOf = () => page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('shicheng:trips') || '{}')
      const t = raw.trips?.[0]
      return t?.segments ? Object.values(t.segments).map(s => s.mode).join(',') : ''
    })
    const before = await modesOf()
    const cardCount = await card.count()
    const hasAdopt = await card.getByRole('button', { name: '采用' }).count()
    if (hasAdopt) await card.getByRole('button', { name: '采用' }).click()
    await page.waitForTimeout(400)
    const after = await modesOf()
    return { ok: cardCount === 1 && hasAdopt === 1 && before !== after,
      detail: `卡=${cardCount}, modes ${before} -> ${after}` }
  })
  await check('A03 none 建议出卡无采用按钮', async () => {
    mockMode = 'none'; await ask()
    const card = page.locator('[data-ai-card]').filter({ hasText: '今日安排妥帖' })
    const adopt = await card.getByRole('button', { name: '采用' }).count()
    const know = await card.getByRole('button', { name: '知道了' }).count()
    return { ok: await card.count() === 1 && adopt === 0 && know === 1, detail: `采用=${adopt}, 知道了=${know}` }
  })
  await check('A04 畸形/越权/不存在地名一律丢弃', async () => {
    const cases = ['bad', 'evil', 'ghost']
    const results = []
    for (const m of cases) {
      mockMode = m; await ask()
      const anyCard = await page.locator('[data-ai-card]').count()
      results.push(anyCard === 0)
    }
    return { ok: results.every(Boolean), detail: results.join(',') }
  })
  await check('A05 请求形状正确（blocking / 空 conversation / 固定 user）', async () => {
    return {
      ok: lastBody?.response_mode === 'blocking' && lastBody?.conversation_id === '' && lastBody?.user === 'shicheng-local' &&
        typeof lastBody?.inputs?.system === 'string',
      detail: `mode=${lastBody?.response_mode}, conv=${JSON.stringify(lastBody?.conversation_id)}, user=${lastBody?.user}`,
    }
  })
  await check('A06 缓存命中：同 fingerprint 连点不重复请求', async () => {
    mockMode = 'none'; await clearCache(); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500)
    await enterDemo(); await openAssist()
    const n0 = requests
    await aiTrigger().click(); await page.waitForTimeout(600)
    const n1 = requests
    await page.waitForTimeout(3200)
    await aiTrigger().click(); await page.waitForTimeout(600)
    const n2 = requests
    return { ok: n1 - n0 === 1 && n2 - n1 === 0, detail: `请求 ${n0}->${n1}->${n2}` }
  })
}

const failed = results.filter(r => !r.ok)
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`)
await browser.close()
process.exit(failed.length || errors.length ? 1 : 0)
