// 中国省级 GeoJSON → 可交互 SVG 路径
// 主图聚焦大陆（含海南/台湾），南海诸岛单独出插图数据（制图惯例）
// 运行：node scripts/build-china-paths.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const geo = JSON.parse(fs.readFileSync(path.join(root, 'src/data/china.json'), 'utf8'))

// ---- 主图投影 ----
const W = 1000, H = 800
const mainBounds = { minLng: 73, maxLng: 135.5, minLat: 17.2, maxLat: 53.8 }

// ---- 南海诸岛插图投影 ----
const INSET = { w: 210, h: 280 }
const insetBounds = { minLng: 105, maxLng: 123, minLat: 3.2, maxLat: 22 }
const INSET_SPLIT_LAT = 18.2 // 低于此纬度的环归入插图

function projector(b, w, h) {
  return (lng, lat) => [
    ((lng - b.minLng) / (b.maxLng - b.minLng)) * w,
    ((b.maxLat - lat) / (b.maxLat - b.minLat)) * h,
  ]
}

function radialSimplify(points, tol) {
  if (points.length <= 3) return points
  const out = [points[0]]
  let lastKept = points[0]
  for (let i = 1; i < points.length - 1; i++) {
    if (Math.hypot(points[i][0] - lastKept[0], points[i][1] - lastKept[1]) >= tol) {
      out.push(points[i]); lastKept = points[i]
    }
  }
  out.push(points[points.length - 1])
  return out
}

function ringToPath(ring, project, minSpanPx) {
  const pts = ring.map(([lng, lat]) => project(lng, lat))
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  const span = Math.max(maxX - minX, maxY - minY)
  if (span < minSpanPx) return ''
  const tol = span > 120 ? 2.2 : span > 40 ? 1.4 : span > 12 ? 0.9 : 0.5
  const simp = radialSimplify(pts, tol)
  if (simp.length < 3) return ''
  let d = 'M' + simp[0][0].toFixed(1) + ',' + simp[0][1].toFixed(1)
  for (let i = 1; i < simp.length; i++) d += 'L' + simp[i][0].toFixed(1) + ',' + simp[i][1].toFixed(1)
  return d + 'Z'
}

const mainProject = projector(mainBounds, W, H)
const insetProject = projector(insetBounds, INSET.w, INSET.h)

const provinces = []
const insetRings = []

for (const f of geo.features) {
  const name = f.properties.name
  if (!name) continue
  const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]
  const paths = []
  for (const poly of polys) {
    for (const ring of poly) {
      if (ring.length < 4) continue
      const maxLat = Math.max(...ring.map(p => p[1]))
      if (maxLat < INSET_SPLIT_LAT) {
        // 归入南海诸岛插图
        const ip = ringToPath(ring, insetProject, 0.4)
        if (ip) insetRings.push(ip)
        continue
      }
      const p = ringToPath(ring, mainProject, 1.2)
      if (p) paths.push(p)
    }
  }
  if (!paths.length) continue
  const [cx, cy] = mainProject(f.properties.center[0], f.properties.center[1])
  provinces.push({
    name, adcode: f.properties.adcode,
    cx: +cx.toFixed(1), cy: +cy.toFixed(1),
    center: f.properties.center,
    d: paths.join(' '),
  })
}

const out = {
  viewBox: `0 0 ${W} ${H}`,
  insetViewBox: `0 0 ${INSET.w} ${INSET.h}`,
  provinces,
  nanhai: insetRings.join(' '),
}
const outPath = path.join(root, 'src/data/china-paths.json')
fs.writeFileSync(outPath, JSON.stringify(out))
console.log('provinces:', provinces.length, '| inset rings:', insetRings.length)
console.log('size:', (fs.statSync(outPath).size / 1024).toFixed(1), 'KB')
