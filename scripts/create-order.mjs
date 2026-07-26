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
      `insert into orden (clienteId, clienteNombre, clienteTelefono, categoria, descripcion, direccion, urgencia, estado, tecnicoId, tecnicoNombre, precio, notasTecnico)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [
        'manual-cli',
        'Orden Demo',
        '+56 9 0000 0000',
        'reparaciones',
        'Prueba de creación de orden desde script',
        'Calle Demo 123',
        'normal',
        'pendiente',
        null,
        null,
        null,
        null,
      ]
    )
    console.log('Created orden id:', res.rows[0].id)
  } catch (err) {
    console.error('Error creating orden:', err)
    process.exit(2)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
