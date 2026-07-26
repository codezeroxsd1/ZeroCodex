// Reset ordenes to prepare for fresh seed
const { Pool } = require('pg')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Please set DATABASE_URL in your environment')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: url })
  try {
    console.log('Deleting all ordenes...')
    const res = await pool.query(`DELETE FROM orden`)
    console.log(`✓ Deleted ${res.rowCount} orders`)
    console.log('Run "npm run seed" to create new orders with July dates')
  } catch (e) {
    console.error('Error:', e.message)
  } finally {
    await pool.end()
  }
}

main()
