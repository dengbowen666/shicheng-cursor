import { chromium } from 'playwright'

const PORT = process.env.PORT || '5183'
const URL = `http://127.0.0.1:${PORT}/#/`
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const hits = []
page.on('request', r => { if (r.url().includes('apis.map.qq.com')) hits.push(r.url().split('?')[0]) })
const errs = []
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.locator('button').filter({ hasText: '大理 · 丽江 5日' }).first().click()
await page.waitForTimeout(6000)

const segs = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('shicheng:trips') || '{}')
  const list = raw.trips || raw
  const t = list.find(x => x.id === 'demo-dali-lijiang') || list[0]
  return Object.values(t.segments).map(s => ({
    mode: s.mode,
    km: s.distanceKm,
    min: s.durationMin,
    estimated: s.estimated,
    points: s.path ? s.path.length : 0,
  }))
})
const key = await page.evaluate(() => localStorage.getItem('shicheng:key'))
console.log('key 已生效:', key)
console.log('路线请求:', hits.length, [...new Set(hits)].map(u => u.split('/').pop()).join(', '))
console.log('交通段:', JSON.stringify(segs, null, 1))
console.log('控制台错误:', errs.slice(0, 3))
await page.locator('.map-stage').first().screenshot({ path: 'shots/_zoom-route.png' })
await browser.close()
