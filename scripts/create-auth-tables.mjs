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
  throw new Error('DATABASE_URL not found in .env.local')
}

const pool = new Pool({ connectionString: env.DATABASE_URL })
const client = await pool.connect()

try {
  await client.query('BEGIN')

  const stmts = [
    `create table if not exists "user" (
      id text primary key,
      name text not null,
      email text not null unique,
      "emailVerified" boolean not null default false,
      image text,
      role text not null default 'cliente',
      phone text,
      "clientType" text not null default 'particular',
      "companyName" text,
      "companyRut" text,
      "companyEmail" text,
      "companyPhone" text,
      "companyAddress" text,
      "isApproved" boolean not null default false,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now()
    );`,
    `create table if not exists session (
      id text primary key,
      "expiresAt" timestamptz not null,
      token text not null unique,
      "createdAt" timestamptz not null,
      "updatedAt" timestamptz not null,
      "ipAddress" text,
      "userAgent" text,
      "userId" text not null references "user"("id") on delete cascade
    );`,
    `create table if not exists account (
      id text primary key,
      "accountId" text not null,
      "providerId" text not null,
      "userId" text not null references "user"("id") on delete cascade,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamptz,
      "refreshTokenExpiresAt" timestamptz,
      scope text,
      password text,
      "createdAt" timestamptz not null,
      "updatedAt" timestamptz not null
    );`,
    `create table if not exists verification (
      id text primary key,
      identifier text not null,
      value text not null,
      "expiresAt" timestamptz not null,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now()
    );`
  ]

  for (const stmt of stmts) {
    await client.query(stmt)
  }

  await client.query('COMMIT')
  console.log('✅ Auth tables created or already exist')
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error)
  throw error
} finally {
  client.release()
  await pool.end()
}
