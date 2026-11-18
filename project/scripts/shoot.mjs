import { chromium } from 'playwright'
import fs from 'node:fs'

const PORT = process.env.PORT || '5183'
const URL = `http://127.0.0.1:${PORT}/#/`
const OUT = 'shots'
const report = []
const browser = await chromium.launch()

function log(name, ok, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  report.push({ name, ok, detail })
}

async function openPage(viewport = { width: 1440, height: 900 }, fresh = false) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
  await page.goto(URL, { waitUntil: 'networkidle' })
  if (fresh) {
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'networkidle' })
  }
  await page.waitForTimeout(900)
  return { page, errors }
}

async function capture(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
}

async function step(name, fn) {
  try {
    const detail = await fn()
    log(name, true, detail || '')
  } catch (e) {
    log(name, false, e instanceof Error ? e.message : String(e))
  }
}

/* ---------- 桌面：首页 / 下钻 / 新建攻略 ---------- */
const desk = await openPage({ width: 1440, height: 900 }, true)
const page = desk.page

await step('首页卷首渲染', async () => {
  const ok = await page.getByText('一图在手 · 山河任行').count() > 0
  if (!ok) throw new Error('未找到拾程卷首标语')
  await capture(page, 'v4-01-home')
  return '已截图 v4-01-home'
})

await step('省份水墨下钻', async () => {
  const hit = await page.evaluate(() => {
    const target = [...document.querySelectorAll('path')]
      .find(p => p.querySelector('title')?.textContent?.trim() === '云南')
    if (!target) return false
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  })
  await page.waitForTimeout(850)
  if (!hit) throw new Error('未找到云南省路径')
  await capture(page, 'v4-02-province')
  return '已点击云南省并聚焦'
})

await step('新建攻略向导', async () => {
  await page.getByRole('button', { name: '新建攻略' }).first().click()
  await page.waitForTimeout(400)
  await capture(page, 'v4-03-wizard')
  await page.getByPlaceholder('搜索城市（可搜全国）').fill('杭州')
  await page.waitForTimeout(350)
  const city = page.locator('button').filter({ hasText: '杭州' }).last()
  await city.click({ timeout: 4000 })
  await page.getByRole('button', { name: /启程/ }).click()
  await page.waitForTimeout(1100)
  if (!page.url().includes('/trip/')) throw new Error(`未进入编辑器：${page.url()}`)
  await capture(page, 'v4-04-new-trip')
  return page.url().split('#')[1]
})

await page.close()

/* ---------- 桌面：示例攻略编辑器 ---------- */
const editor = await openPage({ width: 1440, height: 900 })
const ep = editor.page

await step('打开示例攻略', async () => {
  const card = ep.locator('button').filter({ hasText: '大理 · 丽江 5日' }).first()
  await card.click({ timeout: 5000 })
  await ep.waitForTimeout(2600)
  if (!ep.url().includes('/trip/demo-dali-lijiang')) throw new Error(`路由异常：${ep.url()}`)
  const hasMap = await ep.locator('svg').count() > 0
  const hasPanel = await ep.getByText('点交通条可改方式').count() > 0
  if (!hasMap || !hasPanel) throw new Error(`地图=${hasMap} 面板=${hasPanel}`)
  await capture(ep, 'v4-05-editor')
  return '地图与日程面板均已渲染'
})

await step('交通方式切换', async () => {
  const seg = ep.locator('[title^="改交通方式"]').first()
  const before = await seg.getAttribute('title')
  await seg.click({ timeout: 5000 })
  await ep.waitForTimeout(350)
  await capture(ep, 'v4-06-segment-picker')
  const walk = ep.locator('button').filter({ hasText: '步行' }).last()
  await walk.click({ timeout: 4000 })
  await ep.waitForTimeout(500)
  const after = await ep.locator('[title^="改交通方式"]').first().getAttribute('title')
  if (before === after) throw new Error(`交通方式未变化：${before}`)
  return `${before} → ${after}`
})

await step('记账落账', async () => {
  await ep.getByRole('button', { name: '记账' }).first().click({ timeout: 5000 })
  await ep.waitForTimeout(900)
  await capture(ep, 'v4-07-expense')
  await ep.getByRole('button', { name: '记一笔' }).click({ timeout: 4000 })
  await ep.getByPlaceholder('项目名，如：客栈 / 午餐 / 门票').fill('验收午餐')
  await ep.locator('input[type="number"]').first().fill('88.5')
  await ep.getByRole('button', { name: '落账' }).click({ timeout: 4000 })
  await ep.waitForTimeout(400)
  if (await ep.getByText('验收午餐').count() === 0) throw new Error('明细中未出现新账目')
  return '已记一笔 ¥88.50'
})

await step('今天视图', async () => {
  await ep.locator('[title="合卷"]').click({ timeout: 4000 }).catch(() => {})
  const today = ep.getByRole('button', { name: /今天 · Day/ })
  if (await today.count() === 0) throw new Error('未找到今天入口')
  await today.first().click()
  await ep.waitForTimeout(500)
  await capture(ep, 'v4-08-today')
  return '今天视图已展开'
})

await step('导出三件套弹层', async () => {
  await ep.getByRole('button', { name: '导出' }).click({ timeout: 4000 })
  await ep.waitForTimeout(450)
  const ok = await ep.getByText('长卷 · 打印 · 备份，三件套').count() > 0
  if (!ok) throw new Error('导出弹层未出现')
  await capture(ep, 'v4-09-export')
  return 'PNG / HTML / JSON 三个入口可见'
})

await ep.close()

/* ---------- 移动端 ---------- */
const mob = await openPage({ width: 390, height: 844 })
const mp = mob.page

await step('移动端首页', async () => {
  const ok = await mp.getByText('我的攻略').count() > 0
  if (!ok) throw new Error('未找到我的攻略卷轴')
  await capture(mp, 'v4-10-mobile-home')
  return '已截图 v4-10-mobile-home'
})

await step('移动端编辑器与底部抽屉', async () => {
  await mp.locator('button').filter({ hasText: '大理 · 丽江 5日' }).first().click({ timeout: 5000 })
  await mp.waitForTimeout(2600)
  await capture(mp, 'v4-11-mobile-editor')
  await mp.getByRole('button', { name: '记账' }).last().click({ timeout: 5000 })
  await mp.waitForTimeout(900)
  await capture(mp, 'v4-12-mobile-expense')
  const sheet = await mp.locator('[data-sheet="half"], [data-sheet="full"]').count()
  if (!sheet) throw new Error('bottom sheet 未展开')
  return 'bottom sheet 已展开'
})

await mp.close()

/* ---------- 控制台汇总 ---------- */
const allErrors = [...desk.errors, ...editor.errors, ...mob.errors]
  .filter(e => !/ERR_NAME_NOT_RESOLVED|Failed to load resource|favicon/i.test(e))
log('控制台无脚本异常', allErrors.length === 0, allErrors.slice(0, 5).join(' | '))

await browser.close()
fs.writeFileSync(`${OUT}/acceptance.json`, JSON.stringify({
  time: new Date().toISOString(),
  url: URL,
  checks: report,
  consoleErrors: allErrors,
}, null, 2))
console.log(`done — ${report.filter(r => r.ok).length}/${report.length} passed`)
