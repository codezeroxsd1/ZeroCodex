import { Pool } from 'pg'
import fs from 'fs'

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
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "localDate" text')
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "localTime" text')
    console.log('Added columns localDate, localTime (if they did not exist)')
  } catch (err) {
    console.error('Error altering table:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
