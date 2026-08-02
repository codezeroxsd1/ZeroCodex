import fs from 'fs'
import { Client } from 'pg'

const envText = await fs.promises.readFile(new URL('../.env.local', import.meta.url), 'utf8')
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
  throw new Error('DATABASE_URL not found in .env.local')
}

const client = new Client({ connectionString: env.DATABASE_URL })
await client.connect()
const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='user' ORDER BY ordinal_position")
console.log(res.rows.map((r) => r.column_name).join('|'))
await client.end()
