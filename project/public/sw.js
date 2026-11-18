/* 拾程 · 最小 Service Worker：预缓存应用壳，运行时 stale-while-revalidate */
const CACHE = 'shicheng-shell-v1'
const SHELL = ['./', './index.html', './favicon.svg', './manifest.json']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
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
