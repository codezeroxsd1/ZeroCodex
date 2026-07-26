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
    const res = await client.query('select id, clienteNombre, categoria, descripcion, direccion, estado, tecnicoNombre, "createdAt" from orden order by "createdAt" desc limit 20')
    console.log('ordenes:', res.rows.length)
    console.table(res.rows)
  } catch (err) {
    console.error('Error listing ordenes:', err)
    process.exit(2)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
