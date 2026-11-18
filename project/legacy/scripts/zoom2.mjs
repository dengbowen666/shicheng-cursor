import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 })
await page.goto('http://127.0.0.1:5181/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.getByText('我的攻略').click({ timeout: 3000 }).catch(() => {})
await page.waitForTimeout(600)
await page.getByText('继续编辑').first().click({ timeout: 3000 }).catch(() => {})
await page.waitForTimeout(1200)

const texts = await page.locator('svg text').evaluateAll(els =>
  els.map(e => ({ t: e.textContent.trim(), b: e.getBoundingClientRect().toJSON() }))
    .filter(o => /′/.test(o.t))
)
console.log(JSON.stringify(texts, null, 1))

if (texts.length) {
  const b = texts[0].b
  await page.screenshot({
    path: 'shots/zoom-badge.png',
    clip: { x: b.x - 60, y: b.y - 26, width: 200, height: 70 },
  })
}
await browser.close()
console.log('ok')
