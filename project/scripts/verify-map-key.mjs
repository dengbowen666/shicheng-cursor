/* 验证地图 Key 优先级修复（全部走真实浏览器 + 真实 localStorage，不造假）：
   前提：用 VITE_TMAP_KEY=BUILD_KEY 构建的 dist。
   1) 残留旧 Key（无 user 标记，模拟历史构建写入）→ 启动时被构建 Key 覆盖；
   2) 用户手填 Key（有 user 标记）→ 始终优先，不被构建 Key 覆盖；
   3) 用户清空 Key → 回落到构建 Key；
   4) 设置面板「恢复默认」→ 清掉手填 Key，换回构建 Key。
   用最小静态服务托管 dist，不依赖外部预览进程。 */
import { chromium } from 'playwright'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const BUILD_KEY = 'BUILD_INJECTED_KEY'
const ROOT = path.resolve('dist')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (p === '/' || p === '') p = '/index.html'
  const file = path.join(ROOT, p)
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('nf'); return }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}/#/`

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? ' · ' + detail : ''}`) }
  else { fail++; console.log(`FAIL ${name}${detail ? ' · ' + detail : ''}`) }
}

const browser = await chromium.launch()

// 打开设置面板，读 Key 输入框的真实值（draftKey = ui.mapKey）
async function openSettings(page) {
  await page.waitForSelector('button', { timeout: 10000 })
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /设置/.test(b.textContent || ''))
    if (btn) btn.click()
  })
  await page.waitForSelector('input[placeholder="留空即用内置水墨底图"]', { timeout: 10000 })
}
async function readKeyInput(page) {
  await openSettings(page)
  return await page.locator('input[placeholder="留空即用内置水墨底图"]').inputValue()
}
async function closeSettings(page) {
  const btn = page.locator('button[title="关闭"]').last()
  if (await btn.count()) await btn.click()
}

async function newPageWith(preset) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.route('**/api/gljs**', r => r.fulfill({ contentType: 'application/javascript', body: 'window.TMap={Map:function(){},LatLng:function(){},service:{}}' }))
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  if (preset) await page.evaluate(o => { for (const [k, v] of Object.entries(o)) v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) }, preset)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  return { ctx, page }
}

// 1) 残留旧 Key（无 user 标记）应被构建 Key 覆盖
{
  const { ctx, page } = await newPageWith({ 'shicheng:key': 'STALE_OLD_KEY', 'shicheng:keySource': null })
  const v = await readKeyInput(page)
  check('残留旧 Key 被构建 Key 覆盖', v === BUILD_KEY, `输入框=${v}`)
  await ctx.close()
}

// 2) 用户手填 Key（user 标记）始终优先
{
  const { ctx, page } = await newPageWith({ 'shicheng:key': 'MY_MANUAL_KEY', 'shicheng:keySource': 'user' })
  const v = await readKeyInput(page)
  check('用户手填 Key 优先保留', v === 'MY_MANUAL_KEY', `输入框=${v}`)
  await ctx.close()
}

// 3) 用户清空 Key → 回落构建 Key（在已有手填 Key 的上下文里操作）
{
  const { ctx, page } = await newPageWith({ 'shicheng:key': 'MY_MANUAL_KEY', 'shicheng:keySource': 'user' })
  await openSettings(page)
  const input = page.locator('input[placeholder="留空即用内置水墨底图"]')
  await input.fill('')
  await page.locator('button', { hasText: /^保存$/ }).click()
  await page.waitForTimeout(300)
  const after = await page.evaluate(() => ({ key: localStorage.getItem('shicheng:key'), src: localStorage.getItem('shicheng:keySource') }))
  check('清空 Key 回落到构建 Key', after.key === BUILD_KEY && after.src == null, `存储=${JSON.stringify(after)}`)
  await ctx.close()
}

// 4) 「恢复默认」按钮清掉手填 Key，换回构建 Key
{
  const { ctx, page } = await newPageWith({ 'shicheng:key': 'MY_MANUAL_KEY', 'shicheng:keySource': 'user' })
  await openSettings(page)
  const restore = page.locator('button', { hasText: '恢复默认' }).first()
  check('设置面板显示「恢复默认」入口', await restore.count() === 1)
  if (await restore.count()) {
    await restore.click()
    await page.waitForTimeout(300)
    const after = await page.evaluate(() => ({ key: localStorage.getItem('shicheng:key'), src: localStorage.getItem('shicheng:keySource') }))
    const shown = await page.locator('input[placeholder="留空即用内置水墨底图"]').inputValue()
    check('恢复默认换回构建 Key', after.key === BUILD_KEY && after.src == null && shown === BUILD_KEY, `存储=${JSON.stringify(after)} 输入框=${shown}`)
  }
  await ctx.close()
}

await browser.close()
server.close()
console.log(`\n结果：${pass}/${pass + fail} 通过`)
process.exit(fail ? 1 : 0)
