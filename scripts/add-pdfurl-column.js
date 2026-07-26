const { Pool } = require('pg')
const fs = require('fs')

async function main() {
  let url = process.env.DATABASE_URL
  if (!url) {
    try {
      const envText = fs.readFileSync('.env.local', 'utf8')
      const match = envText.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
      if (match) {
        const idx = match.indexOf('=')
        url = match.slice(idx + 1)
      }
    } catch (e) {
      // ignore
    }
  }

  if (!url) {
    console.error('Please set DATABASE_URL in your environment')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: url })
  try {
    console.log('Adding `pdfUrl` column to `orden` if not exists...')
    await pool.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "pdfUrl" text;')
    console.log('Done.')
  } catch (e) {
    console.error('Error adding column:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
