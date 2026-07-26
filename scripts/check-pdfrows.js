const fs = require('fs')
const { Pool } = require('pg')

async function main() {
  const envText = fs.readFileSync('.env.local', 'utf8')
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
    console.error('Please set DATABASE_URL in .env.local')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL })
  const client = await pool.connect()
  try {
    const res = await client.query('SELECT count(*) as c FROM orden WHERE "pdfUrl" IS NOT NULL')
    console.log('rows with pdfUrl:', res.rows[0].c)
  } catch (e) {
    console.error('Error:', e.message)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
