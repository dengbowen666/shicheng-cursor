/* 验证：景/食/宿 唯一一组、位于地图右侧 +/- 下方、同时控制自有印章与底图原生 POI 显隐。
   全部走真实 DOM 事件；腾讯 GL 用可观测 stub（记录 setStyles 调用），不再用 emit 造假。 */
import { chromium } from 'playwright'

const PORT = process.env.PORT || '5185'
const URL = `http://127.0.0.1:${PORT}/#/`
let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? ' · ' + detail : ''}`) }
  else { fail++; console.log(`FAIL ${name}${detail ? ' · ' + detail : ''}`) }
}

// 腾讯 GL stub：canvas 上挂 click；记录每次 setStyles 的 mix，供断言图层规则
const STUB = `(function(){
window.__styles=[];
class LatLng{constructor(a,b){this.lat=a;this.lng=b}getLat(){return this.lat}getLng(){return this.lng}}
class Map{constructor(el,o){this.el=el;this.opts=o;this.center=o.center;this.zoom=o.zoom;this.h={};window.__tmap=this;
  const c=document.createElement('canvas');c.width=64;c.height=64;c.style.cssText='width:100%;height:100%';el.appendChild(c);this.canvas=c;
  this.styles=[];setTimeout(()=>this.emit('tilesloaded',{}),40)}
  on(n,f){(this.h[n]||(this.h[n]=[])).push(f)}emit(n,e){(this.h[n]||[]).forEach(f=>f(e))}
  setCenter(c){this.center=c}setZoom(z){this.zoom=z}getCenter(){return this.center}getZoom(){return this.zoom}
  getBounds(){const c=this.center||new LatLng(26.87,100.23);return{getNorthEast:()=>new LatLng(c.getLat()+0.01,c.getLng()+0.015),getSouthWest:()=>new LatLng(c.getLat()-0.01,c.getLng()-0.015)}}
  getStyles(){return this.styles}setStyles(list){this.styles=list;window.__styles=JSON.parse(JSON.stringify(list))}
  setStyle(id){this.styleId=id}setMapStyleId(id){this.mapStyleId=id}setMapStyle(o){this.mapStyle=o}
  resize(){}destroy(){}}
window.TMap={Map,LatLng,service:{}}})()`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', e => console.log('PAGEERR', e.message))
await page.route('**/api/gljs**', r => r.fulfill({ contentType: 'application/javascript', body: STUB }))
await page.route('**/ws/place/v1/suggestion**', r => {
  const cb = new URL(r.request().url()).searchParams.get('callback') || '_'
  r.fulfill({ contentType: 'application/javascript', body: `${cb}({status:0,data:[]})` })
})
await page.route('**/ws/geocoder/v1**', r => {
  const cb = new URL(r.request().url()).searchParams.get('callback') || '_'
  r.fulfill({ contentType: 'application/javascript', body: `${cb}({status:0,result:{address:'测试地址'}})` })
})
await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('shicheng:key', 'TESTKEY') })
await page.reload({ waitUntil: 'networkidle' })
await page.evaluate(() => { location.hash = '#/trip/demo-dali-lijiang' })
await page.waitForTimeout(1100)
await page.waitForFunction(() => !!window.__tmap, null, { timeout: 5000 }).catch(() => {})

// 1. 全页只有一组 aria-label=图层开关
const groups = await page.locator('[role="group"][aria-label="图层开关"]').count()
check('全页仅一组景/食/宿', groups === 1, `组数=${groups}`)

// 2. 顶部工具条不再有 景点层/美食层/住宿层 按钮
const topBtns = await page.locator('button[title="景点层"], button[title="美食层"], button[title="住宿层"]').count()
check('顶部工具条已无重复图层按钮', topBtns === 0, `残留=${topBtns}`)

// 3. 图层组位于右侧缩放控件同一容器内、且在 +/− 之后
const layoutOk = await page.evaluate(() => {
  const group = document.querySelector('[role="group"][aria-label="图层开关"]')
  if (!group) return { ok: false, why: '无图层组' }
  const zoomRoot = group.parentElement?.parentElement
  const plus = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '+')
  if (!plus || !zoomRoot) return { ok: false, why: '找不到缩放控件' }
  const inside = zoomRoot.contains(plus) && zoomRoot.contains(group)
  const gr = group.getBoundingClientRect(), pr = plus.getBoundingClientRect()
  const below = gr.top >= pr.bottom - 2
  const right = gr.right > window.innerWidth * 0.7
  return { ok: inside && below && right, inside, below, right, grTop: Math.round(gr.top), prBottom: Math.round(pr.bottom) }
})
check('图层组位于右侧 +/− 下方', layoutOk.ok, JSON.stringify(layoutOk))

// 4. 关掉「食」→ 自有印章过滤 + 底图样式出现 poi 餐饮 visibility off
const foodSeal = page.locator('[role="group"][aria-label="图层开关"] button[title*="食"]').first()
const beforeStyles = await page.evaluate(() => JSON.stringify(window.__styles || []))
await foodSeal.click()
await page.waitForTimeout(250)
const after = await page.evaluate(() => {
  const presses = [...document.querySelectorAll('[role="group"][aria-label="图层开关"] button')]
    .map(b => ({ t: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') }))
  return { presses, styles: JSON.stringify(window.__styles || []), styleId: window.__tmap?.styleId }
})
const foodOff = after.presses.find(p => p.t === '食')?.pressed === 'false'
check('自有印章图层开关aria-pressed=false', foodOff, JSON.stringify(after.presses))
const hasFoodVisibility = /"(visibility":"off")/.test(after.styles) && /poi\.(catering|food|restaurant)/.test(after.styles)
check('底图样式含餐饮 POI 隐藏规则', hasFoodVisibility, `styleId=${after.styleId} 变化=${beforeStyles !== after.styles}`)

// 5. 再点一次恢复 → 样式不再含餐饮 off
await foodSeal.click()
await page.waitForTimeout(250)
const restored = await page.evaluate(() => ({
  pressed: [...document.querySelectorAll('[role="group"][aria-label="图层开关"] button')]
    .find(b => b.textContent.trim() === '食')?.getAttribute('aria-pressed'),
  styles: JSON.stringify(window.__styles || []),
}))
const noFoodOff = !/poi\.(catering|food|restaurant)","stylers":\{"visibility":"off"\}\}/.test(restored.styles)
check('再次点击恢复且样式撤销隐藏', restored.pressed === 'true' && noFoodOff, `pressed=${restored.pressed}`)

// 6. 自有印章随图层隐藏：关「景」后地图印章数量应减少
const beforePois = await page.locator('g.poi-marker').count()
const sightSeal = page.locator('[role="group"][aria-label="图层开关"] button[title*="景"]').first()
await sightSeal.click()
await page.waitForTimeout(200)
const afterPois = await page.locator('g.poi-marker').count()
check('自有印章随图层过滤减少', afterPois < beforePois, `${beforePois} → ${afterPois}`)

console.log(`\nDONE pass=${pass} fail=${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
