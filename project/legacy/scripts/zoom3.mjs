import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 })
await page.goto('http://127.0.0.1:5181/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByLabel('我的攻略').click().catch(() => {})
await page.waitForTimeout(900)
const card = page.locator('.paper-card').first()
const b = await card.boundingBox()
console.log(b)
if (b) await page.screenshot({ path: 'shots/zoom-card.png', clip: { x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 16 } })
await browser.close()
console.log('ok')
