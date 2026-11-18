import type { Trip } from '../types'
import { MODE_LABEL } from '../types'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function yuan(cents: number) { return (cents / 100).toFixed(2) }
function esc(s: string) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)) }

function tripSummary(trip: Trip) {
  const spent = trip.expenses.reduce((s, e) => s + e.amount, 0)
  const visited = Object.values(trip.pois).filter(p => p.visitedAt).length
  const travel = Object.values(trip.segments).reduce((s, x) => s + x.durationMin, 0)
  return { spent, visited, travel, spots: Object.keys(trip.pois).length }
}

/** 国风长卷 PNG：1080px 宽竖版，自绘 canvas；不含个人记账明细。 */
export async function exportScrollPng(trip: Trip) {
  const W = 1080
  const rowH = 68
  const headerH = 300
  const footerH = 220
  const dayCount = trip.days.length
  const itemCount = trip.days.reduce((s, d) => s + d.poiIds.length, 0)
  const H = headerH + dayCount * 120 + itemCount * rowH + footerH
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = Math.min(16000, H)
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#F2ECE0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // 宣纸噪点
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(110,106,98,${Math.random() * 0.025})`
    ctx.fillRect(Math.random() * W, Math.random() * canvas.height, 1.2, 1.2)
  }
  ctx.strokeStyle = 'rgba(44,42,38,.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(36, 36, W - 72, canvas.height - 72)
  ctx.strokeStyle = 'rgba(44,42,38,.16)'
  ctx.lineWidth = 1
  ctx.strokeRect(46, 46, W - 92, canvas.height - 92)

  ctx.fillStyle = '#A64834'
  ctx.fillRect(92, 88, 92, 92)
  ctx.fillStyle = '#F7EFE0'
  ctx.font = '38px "Ma Shan Zheng", "Noto Serif SC", serif'
  ctx.textAlign = 'center'
  ctx.fillText('拾程', 138, 120)
  ctx.fillText('行旅', 138, 162)

  ctx.fillStyle = '#2C2A26'
  ctx.textAlign = 'left'
  ctx.font = '600 62px "Noto Serif SC", serif'
  ctx.fillText(trip.title, 218, 132)
  ctx.font = '24px "Noto Serif SC", serif'
  ctx.fillStyle = '#6E6A62'
  ctx.fillText(`${trip.cities.map(c => c.name).join(' · ')}  ·  ${trip.days.length} 日  ·  自刻闲章「${trip.sealText}」`, 220, 176)
  if (trip.startDate) ctx.fillText(`启程 ${trip.startDate}`, 220, 214)

  // 淡墨远山
  ctx.fillStyle = 'rgba(185,198,196,.35)'
  ctx.beginPath()
  ctx.moveTo(80, 260)
  ctx.bezierCurveTo(260, 190, 400, 260, 560, 220)
  ctx.bezierCurveTo(760, 170, 880, 240, 1000, 200)
  ctx.lineTo(1000, 292); ctx.lineTo(80, 292); ctx.fill()

  let y = headerH + 20
  for (const day of trip.days) {
    ctx.fillStyle = '#F8F2E4'
    ctx.fillRect(84, y - 34, W - 168, 76)
    ctx.fillStyle = '#A64834'
    ctx.fillRect(84, y - 34, 6, 76)
    ctx.fillStyle = '#2C2A26'
    ctx.font = '600 30px "Noto Serif SC", serif'
    ctx.fillText(day.title, 112, y + 4)
    const weather = day.weather
    if (weather) {
      ctx.fillStyle = '#6E8B88'
      ctx.font = '20px "Noto Serif SC", serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${weather.text} ${weather.tempMin}°–${weather.tempMax}°  ${weather.poem || ''}`, W - 118, y + 2)
      ctx.textAlign = 'left'
    }
    y += 70
    const stops = day.poiIds.filter(id => trip.pois[id]?.role !== 'base')
    stops.forEach((id, i) => {
      const poi = trip.pois[id]
      if (!poi) return
      ctx.fillStyle = i % 2 ? 'rgba(250,246,237,.5)' : 'rgba(255,255,255,.22)'
      ctx.fillRect(84, y - 34, W - 168, rowH)
      ctx.fillStyle = '#A64834'
      ctx.beginPath(); ctx.arc(124, y, 15, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#F7EFE0'
      ctx.font = '18px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(i + 1), 124, y + 6)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#2C2A26'
      ctx.font = '23px "Noto Serif SC", serif'
      ctx.fillText(poi.name, 160, y + 2)
      ctx.fillStyle = '#6E6A62'
      ctx.font = '17px "Noto Serif SC", serif'
      ctx.fillText((poi.address || '').slice(0, 34), 160, y + 26)
      if (poi.note) {
        ctx.fillStyle = '#8E6E52'
        ctx.font = 'italic 17px "Noto Serif SC", serif'
        ctx.textAlign = 'right'
        ctx.fillText(poi.note.slice(0, 24), W - 118, y + 4)
        ctx.textAlign = 'left'
      }
      y += rowH
      if (i < stops.length - 1) {
        const seg = trip.segments[day.segmentIds[i]]
        if (seg) {
          ctx.fillStyle = '#6E6A62'
          ctx.font = '15px "Noto Serif SC", serif'
          ctx.fillText(`　└ ${MODE_LABEL[seg.mode]} ${seg.durationMin} 分${seg.estimated ? ' · 估' : ''}`, 160, y - 14)
        }
      }
    })
    if (day.basePoiId && trip.pois[day.basePoiId]) {
      ctx.fillStyle = '#6E8B88'
      ctx.font = '18px "Noto Serif SC", serif'
      ctx.fillText(`　宿 · ${trip.pois[day.basePoiId].name}`, 160, y - 6)
    }
    y += 46
  }

  const s = tripSummary(trip)
  ctx.fillStyle = '#2C2A26'
  ctx.font = '22px "Noto Serif SC", serif'
  ctx.fillText(`行程小结：${s.visited} 处已至 · 交通 ${s.travel} 分`, 110, canvas.height - 122)
  if (trip.totalBudget) ctx.fillText(`预算执行 ¥${yuan(s.spent)} / ¥${yuan(trip.totalBudget)}`, 110, canvas.height - 86)
  ctx.fillStyle = '#A64834'
  ctx.fillRect(W - 220, canvas.height - 170, 80, 80)
  ctx.fillStyle = '#F7EFE0'
  ctx.font = '30px "Ma Shan Zheng", serif'
  ctx.textAlign = 'center'
  ctx.fillText(trip.sealText.slice(0, 1), W - 180, canvas.height - 138)
  ctx.fillText(trip.sealText.slice(1, 2) || '程', W - 180, canvas.height - 104)
  ctx.fillStyle = '#6E6A62'
  ctx.font = '17px "Noto Serif SC", serif'
  ctx.fillText('拾程 · 丙午年冬', W - 180, canvas.height - 70)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (blob) download(blob, `${trip.title}-长卷.png`)
}

/** 打印自用版 HTML：离线自包含，含明细与预算执行。 */
export function exportPrintHtml(trip: Trip) {
  const s = tripSummary(trip)
  const days = trip.days.map(day => {
    const stops = day.poiIds.map(id => trip.pois[id]).filter(Boolean)
    const list = stops.map((p, i) => {
      const seg = i < day.segmentIds.length ? trip.segments[day.segmentIds[i]] : null
      return `<li><b>${i + 1}. ${esc(p.name)}</b><span>${esc(p.address || '')}</span>${p.note ? `<em>题跋：${esc(p.note)}</em>` : ''}${seg ? `<small>↓ ${MODE_LABEL[seg.mode]} · ${seg.durationMin} 分${seg.estimated ? '（估）' : ''}</small>` : ''}</li>`
    }).join('')
    const w = day.weather
    return `<section><h3>${esc(day.title)} ${w ? `<span>${w.text} ${w.tempMin}°–${w.tempMax}° · ${esc(w.poem || '')}</span>` : ''}</h3><ol>${list}</ol></section>`
  }).join('')
  const expenses = trip.expenses.map(e => `<tr><td>${esc(e.title)}</td><td>${e.category}</td><td>Day ${e.dayIndex}</td><td>¥${yuan(e.amount)}</td></tr>`).join('')
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(trip.title)} · 拾程打印版</title><style>
    body{font-family:"Noto Serif SC","Songti SC",serif;background:#F2ECE0;color:#2C2A26;margin:40px;line-height:1.7}
    header{border-bottom:2px solid #2C2A26;padding-bottom:18px;margin-bottom:24px}
    h1{font-size:32px;margin:0 0 8px} h2{font-size:20px;margin-top:28px;border-left:5px solid #A64834;padding-left:12px}
    h3 span{font-size:13px;color:#6E6A62;font-weight:normal;margin-left:16px}
    ol{list-style:none;padding:0} li{border-bottom:1px dashed #B08D70;padding:9px 0;display:flex;flex-wrap:wrap;gap:12px}
    li span,li small,li em{color:#6E6A62;font-size:13px;width:100%} li em{color:#8E6E52}
    table{border-collapse:collapse;width:100%;font-size:13px} td,th{border-bottom:1px solid #D9CFC0;padding:7px;text-align:left}
    .seal{display:inline-block;background:#A64834;color:#FAF6ED;padding:5px 10px;margin-left:12px}
    @media print{body{background:#fff;margin:12mm}}
  </style></head><body><header><h1>${esc(trip.title)}<span class="seal">拾程</span></h1>
  <div>${trip.cities.map(c => esc(c.name)).join(' · ')} · ${trip.days.length} 日 · 自刻闲章「${esc(trip.sealText)}」${trip.startDate ? ` · 启程 ${trip.startDate}` : ''}</div>
  <div>小结：${s.visited} 处已至 · ${s.spots} 处收录 · 交通 ${s.travel} 分 · 总支出 ¥${yuan(s.spent)}${trip.totalBudget ? ` / 预算 ¥${yuan(trip.totalBudget)}` : ''}</div></header>
  ${days}<h2>记账明细</h2><table><tr><th>项目</th><th>分类</th><th>日期</th><th>金额</th></tr>${expenses}</table>
  <footer style="margin-top:40px;color:#6E6A62;font-size:12px">拾程 · 自刻闲章「${esc(trip.sealText)}」 · 本机生成，仅供自用</footer></body></html>`
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), `${trip.title}-打印版.html`)
}

export function exportJson(data: string) {
  download(new Blob([data], { type: 'application/json;charset=utf-8' }), `shicheng-backup-${new Date().toISOString().slice(0, 10)}.json`)
}
