const fs = require('fs').promises
const path = require('path')
const { Client } = require('pg')

async function waitForDb(client, retries = 10, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await client.connect()
      return
    } catch (err) {
      const message = err && err.message ? err.message : ''
      if (attempt === retries) {
        throw err
      }
      console.log(`DB not ready yet (attempt ${attempt}/${retries}): ${message}`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

async function main() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '20260722_add_missing_order_columns.sql')
  const sql = await fs.readFile(sqlPath, 'utf8')

  const client = new Client(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.PGHOST || 'localhost',
          port: Number(process.env.PGPORT || 5432),
          user: process.env.PGUSER || 'postgres',
          password: process.env.PGPASSWORD || '',
          database: process.env.PGDATABASE || 'zero_db',
        },
  )

  try {
    await waitForDb(client)
    console.log('Connected to DB:', client.database)
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Migration applied successfully')
  } catch (err) {
    console.error('Migration failed:', err)
    try {
      await client.query('ROLLBACK')
      console.log('Rolled back')
    } catch (rbErr) {
      console.error('Rollback error:', rbErr)
    }
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
