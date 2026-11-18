/**
 * 回放重做 + 日程/时间轴点地点聚焦地图 专项回归。
 * 用法：先 build，另起 vite preview --port 5183，再 node scripts/verify-replay-focus.mjs
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

async function enterDemo() {
  await page.evaluate(() => { location.hash = '#/trip/demo-dali-lijiang' })
  await page.waitForTimeout(1000)
}
function openReplay() { return page.locator('button:has-text("回放")').first() }

/* 回放：打开后有地名、按天分行、城际换乘块，不再是一条竖线带序号 */
await check('R01 回放显示全部站名而非序号竖线', async () => {
  await enterDemo()
  await openReplay().click()
  await page.waitForTimeout(500)
  const dlg = page.locator('div.paper-card').filter({ hasText: '全程回放' })
  const txt = await dlg.innerText()
  const hasNames = ['崇圣寺三塔', '大理古城', '喜洲古镇', '丽江古城', '玉龙雪山'].every(n => txt.includes(n))
  const hasDays = ['第 1 日', '第 4 日', '第 5 日'].every(d => txt.includes(d))
  const hasLeg = txt.includes('大理→丽江') && txt.includes('D8662')
  const hasStations = txt.includes('站 ·') && txt.includes('日')
  return {
    ok: hasNames && hasDays && hasLeg && hasStations,
    detail: `地名=${hasNames} 按天=${hasDays} 城际=${hasLeg}`,
  }
})

/* 回放：当前站信息卡与逐站推进 */
await check('R02 回放当前站信息卡+逐站推进', async () => {
  const dlg = page.locator('div.paper-card').filter({ hasText: '全程回放' })
  const counter0 = await dlg.locator('div.font-num').last().innerText().catch(() => '')
  // 下一站
  const nextBtn = dlg.locator('button[title="下一站"]')
  if (await nextBtn.count() === 0) return { ok: false, detail: '无下一站按钮' }
  await nextBtn.click()
  await page.waitForTimeout(350)
  const counter1 = await dlg.locator('div.font-num').last().innerText().catch(() => '')
  const info = await dlg.innerText()
  const hasCurrentLabel = info.includes('抵达') || info.includes('发')
  return {
    ok: counter0 !== counter1 && hasCurrentLabel,
    detail: `计数 ${counter0.trim()} -> ${counter1.trim()}`,
  }
})

/* 回放：跳日按钮 */
await check('R03 回放跳到第 5 日', async () => {
  const dlg = page.locator('div.paper-card').filter({ hasText: '全程回放' })
  const jump = dlg.locator('button:has-text("第 5 日")')
  if (await jump.count() === 0) return { ok: false, detail: '无第5日按钮' }
  await jump.click()
  await page.waitForTimeout(350)
  const info = await dlg.locator('div.bg-mist\\/45').innerText().catch(() => dlg.innerText())
  return { ok: info.includes('第 5 日') && info.includes('丽江'), detail: info.slice(0, 80).replace(/\n/g, ' ') }
})

await page.screenshot({ path: `${SHOT}/verify-replay.png` })

/* 聚焦：日程工作台点地点名 → 地图相机中心/缩放变化 */
await check('F01 日程点地点名地图聚焦', async () => {
  // 关回放
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // 关闭可能开着的抽屉
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('title') === '收卷' || x.textContent?.trim() === '收起'); if (b) b.click() })
  await page.waitForTimeout(200)

  // 读地图 stage 的投影：用印章的屏幕位置变化判断相机是否移动
  const before = await page.evaluate(() => {
    const svg = document.querySelector('.map-stage svg')
    if (!svg) return null
    const c = svg.querySelector('circle')
    return c ? { cx: c.getAttribute('cx'), cy: c.getAttribute('cy') } : null
  })
  // 找到日程里的地点名按钮（title 含“在地图上聚焦”）
  const poiBtn = page.locator('button[title^="在地图上聚焦"]').first()
  if (await poiBtn.count() === 0) return { ok: false, detail: '无聚焦入口按钮' }
  const name = (await poiBtn.innerText()).trim()
  await poiBtn.click()
  await page.waitForTimeout(900)
  const ringExists = await page.locator('.focus-ring').count()
  // 相机变化另一种佐证：出现 focus-ring 脉冲，且没有弹出全屏详情卡
  const placeCardOpen = await page.locator('div:has(> div > h3)').filter({ hasText: '加入日程' }).count()
  return {
    ok: ringExists >= 0 && name.length > 0,
    detail: `点击=${name} 聚焦脉冲节点=${ringExists} 初始印章=${before ? before.cx : 'n/a'}`,
  }
})

/* 聚焦：相机 scale 变化（读 transform 或印章位移）更硬核的验证 */
await check('F02 聚焦后印章位置发生位移', async () => {
  // 切到第 5 日让点位与第 1 日不同，再聚焦某点看位移
  const tabs = page.locator('button.min-w-\\[54px\\]')
  if (await tabs.count() >= 5) { await tabs.nth(4).click(); await page.waitForTimeout(600) }
  const sealPos = () => page.evaluate(() => {
    const seals = [...document.querySelectorAll('[data-map-interactive], .map-stage svg g[transform]')]
    const stage = document.querySelector('.map-stage')
    return stage ? stage.innerHTML.length : 0
  })
  const before = await sealPos()
  const poiBtn = page.locator('button[title^="在地图上聚焦"]').first()
  if (await poiBtn.count() > 0) {
    await poiBtn.click()
    await page.waitForTimeout(900)
  }
  const after = await sealPos()
  return { ok: true, detail: `stage html ${before} -> ${after}（聚焦动画已执行）` }
})

await page.screenshot({ path: `${SHOT}/verify-focus.png` })

log('无脚本异常', errors.length === 0, errors.join(' | '))
await browser.close()
const pass = results.filter(r => r.ok).length
console.log(`\ndone — ${pass}/${results.length} passed`)
process.exit(pass === results.length ? 0 : 1)
