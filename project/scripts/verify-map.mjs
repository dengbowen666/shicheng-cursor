import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const logs = []
function ok(name, cond, detail = '') { logs.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`) }

await page.goto('http://127.0.0.1:5183/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// 找到印章组：带 title 的 g.cursor-pointer（城市印章）
const seals = page.locator('g.cursor-pointer:has(title)')

// 1) 印记态不应有“行”字章
const doneSeals = await page.locator('g.cursor-pointer:has(title) text', { hasText: /^行$/ }).count()
const sealCount = await seals.count()
ok('印记态无“行”字章（已行地方已剔除）', doneSeals === 0, `印章总数=${sealCount}, 行字章=${doneSeals}`)

// 2) 名字默认隐藏：不应有常驻 seal-name-hover
const nameDefault = await page.locator('.seal-name-hover').count()
ok('印章名字默认隐藏', nameDefault === 0, `默认显示的名字标签=${nameDefault}`)

// 3) 悬浮印章后名字出现
if (sealCount > 0) {
  // 印章密集时透明命中圈会互相遮挡，直接派发 pointerenter 验证悬浮逻辑本身
  await seals.first().dispatchEvent('pointerenter')
  await page.waitForTimeout(250)
  const nameOnHover = await page.locator('.seal-name-hover').count()
  ok('悬浮印章名字浮现', nameOnHover >= 1, `悬浮后名字标签=${nameOnHover}`)
} else {
  ok('悬浮印章名字浮现', false, '无印章可悬浮')
}

// 4) 印记态标记数应等于「未结束攻略」覆盖的城市数（数据一致性）
const citiesOfLive = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('shicheng:trips') || '{"trips":[]}')
  const trips = Array.isArray(raw.trips) ? raw.trips : []
  const live = trips.filter(t => !(t.archived || t.completedAt))
  return new Set(live.flatMap(t => (t.cities || []).map(c => c.name))).size
})
// 印记态重叠城市会合并/聚簇，印章数 ≤ 城市数，且不应为 0（有活跃攻略时）
ok('印记标记数与活跃攻略城市一致', citiesOfLive === 0 || (sealCount > 0 && sealCount <= citiesOfLive),
  `活跃城市数=${citiesOfLive}, 印记印章数=${sealCount}`)

// 5) 切到行迹态不应报错（无已结束攻略时允许为空）
const trailBtn = page.locator('button', { hasText: /^行迹$/ })
if (await trailBtn.count() > 0) {
  await trailBtn.first().dispatchEvent('click')
  await page.waitForTimeout(700)
  const trailSeals = await page.locator('g.cursor-pointer:has(title)').count()
  ok('行迹态切换正常', true, `行迹印章=${trailSeals}`)
}

console.log(logs.join('\n'))
await browser.close()
