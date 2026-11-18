import { chromium } from 'playwright'

const URL = 'http://127.0.0.1:5181/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// 直接用元素 bbox 定位，避免 viewBox 居中留白导致偏移
async function shotEl(sel, name, nth = 0, pad = 20) {
  const loc = page.locator(sel).nth(nth)
  const b = await loc.boundingBox()
  if (!b) { console.log('no box for', sel); return }
  await page.screenshot({
    path: `shots/zoom-${name}.png`,
    clip: {
      x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad),
      width: Math.min(1440, b.width + pad * 2), height: Math.min(900, b.height + pad * 2),
    },
  })
  console.log(name, b)
}

// 南海插图 g（第三个含 translate 的 g? 用 text 定位更稳）
const nanhaiText = page.locator('text', { hasText: '南海诸岛' }).first()
const nb = await nanhaiText.boundingBox()
console.log('nanhai label', nb)
if (nb) {
  await page.screenshot({
    path: 'shots/zoom-nanhai.png',
    clip: { x: Math.max(0, nb.x - 250), y: Math.max(0, nb.y - 380), width: 340, height: 420 },
  })
}

// 台湾
const twText = page.locator('text', { hasText: '台湾' }).first()
const tb = await twText.boundingBox()
console.log('taiwan label', tb)
if (tb) {
  await page.screenshot({
    path: 'shots/zoom-taiwan.png',
    clip: { x: Math.max(0, tb.x - 120), y: Math.max(0, tb.y - 120), width: 260, height: 260 },
  })
}

await browser.close()
console.log('zoom done')
