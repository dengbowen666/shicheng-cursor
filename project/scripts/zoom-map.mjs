import { chromium } from 'playwright'

const PORT = process.env.PORT || '5183'
const URL = `http://127.0.0.1:${PORT}/#/`
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.locator('button').filter({ hasText: '大理 · 丽江 5日' }).first().click()
await page.waitForTimeout(1200)
const map = page.locator('.map-stage').first()
await map.screenshot({ path: 'shots/_zoom-map.png' })
await browser.close()
console.log('ok')
