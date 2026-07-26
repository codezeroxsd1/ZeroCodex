import fs from 'fs'
import { Pool } from 'pg'
import crypto from 'crypto'
import { hashPassword as betterHashPassword } from '@better-auth/utils/password'

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

// Use better-auth scrypt-based hasher
async function hashPassword(password) {
  return await betterHashPassword(password)
}

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // create orden table
    await client.query(`
      create table if not exists orden (
        id serial primary key,
        clienteId text not null,
        clienteNombre text not null,
        clienteTelefono text,
        categoria text not null,
        descripcion text not null,
        direccion text not null,
        urgencia text not null default 'normal',
        estado text not null default 'pendiente',
        tecnicoId text,
        tecnicoNombre text,
        precio integer,
        notasTecnico text,
        "createdAt" timestamptz not null default now(),
        "updatedAt" timestamptz not null default now()
      );
    `)

    console.log('✅ Table orden ensured')

    // ensure tecnico user exists
    const tecnicoEmail = 'tecnico@test.com'
    const res = await client.query('select id from "user" where email = $1 limit 1', [tecnicoEmail])
    if (res.rows.length === 0) {
      const userId = crypto.randomUUID()
      await client.query(
        `insert into "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt") values ($1,$2,$3,$4,$5,now(),now())`,
        [userId, 'Técnico Test', tecnicoEmail, true, 'tecnico'],
      )
      const hashed = await hashPassword('Test1234')
      await client.query(
        `insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") values ($1,$2,$3,$4,$5,now(),now())`,
        [crypto.randomUUID(), crypto.randomUUID(), 'credential', userId, hashed],
      )
      console.log('✅ Tecnico user created')
    } else {
      console.log('✓ Tecnico user already exists')
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error creating table or seeding user:', err)
    process.exit(2)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
