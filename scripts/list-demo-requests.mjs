import fs from 'fs'
import { Pool } from 'pg'

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

async function run() {
  const client = await pool.connect()
  try {
    const res = await client.query(
      `SELECT id, clienteid, date, estado, "createdAt" as createdat FROM orden WHERE clienteid LIKE $1 ORDER BY date DESC NULLS LAST LIMIT 50`,
      ['cliente-demo-%'],
    )
    console.log('Found', res.rows.length, 'demo orders')
    for (const r of res.rows) {
      console.log(r.id, r.clienteid, r.date ? new Date(r.date).toISOString() : null, r.estado, r.createdat)
    }
  } catch (err) {
    console.error('Error querying orders:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
