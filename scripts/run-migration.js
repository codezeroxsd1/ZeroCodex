const fs = require('fs').promises
const path = require('path')
const { Client } = require('pg')

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local')
  return fs.readFile(envPath, 'utf8').catch(() => '').then((content) => {
    const values = {}
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue
      const idx = line.indexOf('=')
      if (idx > -1) {
        const key = line.slice(0, idx).trim()
        const value = line.slice(idx + 1).trim()
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
    return values
  })
}

async function waitForDb(connectionConfig, retries = 10, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const client = new Client(connectionConfig)
    try {
      await client.connect()
      return client
    } catch (err) {
      const message = err && err.message ? err.message : ''
      await client.end().catch(() => {})
      if (attempt === retries) {
        throw err
      }
      console.log(`DB not ready yet (attempt ${attempt}/${retries}): ${message}`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

async function main() {
  await loadEnvFile()

  const migrationFile = process.argv[2] || process.env.MIGRATION_FILE || '20260722_add_missing_order_columns.sql'
  const sqlPath = path.join(__dirname, '..', 'migrations', migrationFile)
  const sql = await fs.readFile(sqlPath, 'utf8')

  const connectionConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || '',
        database: process.env.PGDATABASE || 'zero_db',
      }

  let client
  try {
    client = await waitForDb(connectionConfig)
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
