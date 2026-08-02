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
const res = await client.query(`
  SELECT table_schema, table_name, column_name
  FROM information_schema.columns
  WHERE table_name='user'
  ORDER BY table_schema, table_name, ordinal_position
`)
for (const row of res.rows) {
  console.log(`${row.table_schema}.${row.table_name}.${row.column_name}`)
}
await client.end()
