import fs from 'fs'
import { Pool } from 'pg'

const envText = fs.readFileSync('./.env.local', 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx), line.slice(idx + 1)]
    }),
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
      `SELECT id, clienteid, categoria, estado, date, "localDate", "localTime", "createdAt"
       FROM orden
       ORDER BY "createdAt" DESC
       LIMIT 50`,
    )
    console.log('rows', res.rows)
  } catch (err) {
    console.error(err)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
