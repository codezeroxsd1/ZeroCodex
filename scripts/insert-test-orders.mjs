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
    const date = '2026-07-21T23:00:00.000Z' // corresponds to 19:00 America/Santiago (UTC-4)
    for (let i = 0; i < 3; i++) {
      const res = await client.query(
        `insert into orden (clienteid, clientenombre, clientetelefono, categoria, descripcion, direccion, urgencia, estado, precio, date, createdat, updatedat)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now()) returning id`,
        [
          `test-block-${Date.now()}-${i}`,
          'Test Block',
          '+56 9 0000 0000',
          'reparaciones',
          'Test bloque',
          'Calle Test 1',
          'normal',
          'pendiente',
          0,
          date,
        ],
      )
      console.log('Inserted id', res.rows[0].id)
    }
  } catch (err) {
    console.error('Error inserting test orders', err)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
