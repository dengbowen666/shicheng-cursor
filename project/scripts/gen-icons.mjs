/**
 * 纯 Node 生成印章形 PNG（192 / 512），不依赖 Playwright / 高版本 Node。
 * npm run icons
 */
import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'icons')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const crcBuf = Buffer.alloc(4)
  const crc = crc32(Buffer.concat([typeBuf, data]))
  crcBuf.writeUInt32BE(crc)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function writePng(size, rgbaFn) {
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    row[0] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = rgbaFn(x, y, size)
      const i = 1 + x * 4
      row[i] = r; row[i + 1] = g; row[i + 2] = b; row[i + 3] = a
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const idat = deflateSync(Buffer.concat(rows), { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 朱砂方印在宣纸底上 */
function sealRgba(x, y, size) {
  const paper = [239, 229, 210, 255]
  const cin = [166, 72, 52, 255]
  const mist = [247, 239, 224, 255]
  const m = size * 0.14
  const inset = size * 0.18
  if (x < m || y < m || x >= size - m || y >= size - m) return paper
  if (x < inset || y < inset || x >= size - inset || y >= size - inset) return cin
  // 内框
  const t = size * 0.035
  if (
    (x >= inset && x < inset + t) || (x >= size - inset - t && x < size - inset)
    || (y >= inset && y < inset + t) || (y >= size - inset - t && y < size - inset)
  ) return mist
  return cin
}

await mkdir(outDir, { recursive: true })
for (const size of [192, 512]) {
  const buf = writePng(size, sealRgba)
  await writeFile(path.join(outDir, `seal-${size}.png`), buf)
  console.log('wrote', `seal-${size}.png`, buf.length, 'bytes')
}
console.log('icons ok')
