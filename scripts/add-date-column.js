const { Pool } = require('pg')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Please set DATABASE_URL in your environment')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: url })
  try {
    console.log('Adding `date` column to `orden` if not exists...')
    await pool.query(`ALTER TABLE orden ADD COLUMN IF NOT EXISTS "date" timestamp;`)
    console.log('Done.')
  } catch (e) {
    console.error('Error adding column:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
