/* 拾程 · Service Worker
 * HTML 走 network-first（每次发布后立刻拿到新版本，回访不会白屏）；
 * 静态资源走 stale-while-revalidate（秒开 + 后台更新）；离线时回落到预缓存应用壳。
 */
const CACHE = 'shicheng-shell-v2'
const SHELL = ['./', './index.html', './favicon.svg', './manifest.json']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 导航 / HTML：network-first，失败才用缓存，保证每次部署后拿到最新应用壳
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put('./index.html', res.clone()))
        return res
      }).catch(() => caches.match('./index.html')),
    )
    return
  }

  // 静态资源：stale-while-revalidate
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()))
        return res
      }).catch(() => cached)
      return cached || network
    }),
  )
})
