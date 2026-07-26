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

async function check() {
  const client = await pool.connect()
  try {
    const resOrden = await client.query(
      `select table_schema, table_name from information_schema.tables where table_name = 'orden'`,
    )
    const resUser = await client.query(
      `select table_schema, table_name from information_schema.tables where table_name = 'user'`,
    )
    console.log('orden table rows:', resOrden.rows.length)
    if (resOrden.rows.length) console.log(resOrden.rows)
    console.log('user table rows:', resUser.rows.length)
    if (resUser.rows.length) console.log(resUser.rows)
  } catch (err) {
    console.error('Error checking tables:', err)
    process.exit(2)
  } finally {
    client.release()
    await pool.end()
  }
}

check()
