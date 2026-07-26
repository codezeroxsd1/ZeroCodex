const tz = 'America/Santiago'
const data = { date: '2026-07-21', time: '19:00' }
const [y, m, day] = data.date.split('-').map((s) => Number(s))
const [hh, mm] = data.time.split(':').map((s) => Number(s))
const target = `${data.date} ${data.time}`
let found = null
for (let off = -12 * 60; off <= 14 * 60; off++) {
  const candidate = Date.UTC(y, m - 1, day, hh, mm) - off * 60 * 1000
  const fmt = new Date(candidate).toLocaleString('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const norm = fmt.replace(',', '').replace(/\u200E/g, '').replace(/\s+/g, ' ').trim()
  if (norm === target) {
    found = candidate
    break
  }
}
console.log('found', found, found ? new Date(found).toISOString() : null)
