import fs from 'fs'
import { Pool } from 'pg'

const HOURS = ['09:00', '11:00', '13:00', '15:30', '17:00', '19:00']

const envText = fs.readFileSync('./.env.local', 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx), line.slice(idx + 1)]
    })
)

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const pool = new Pool({ connectionString: env.DATABASE_URL })

async function run(dateStr) {
  const client = await pool.connect()
  try {
    const start = new Date(dateStr)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 1)

    const res = await client.query('SELECT date, estado FROM orden WHERE date IS NOT NULL AND date >= $1 AND date < $2', [start.toISOString(), end.toISOString()])
    const counts = {}
    for (const h of HOURS) counts[h] = 0

    for (const row of res.rows) {
      const d = new Date(row.date)
      const hh = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })
      const estado = String(row.estado ?? '').toLowerCase()
      if (HOURS.includes(hh) && estado !== 'finalizado' && estado !== 'rechazado') counts[hh] = (counts[hh] || 0) + 1
    }

    console.log('Availability for', dateStr)
    console.log(counts)
  } catch (e) {
    console.error('Error', e.message)
  } finally {
    await pool.end()
  }
}

const dateArg = process.argv[2] || new Date().toISOString().split('T')[0]
run(dateArg)
