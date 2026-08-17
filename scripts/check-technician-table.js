const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function checkTable() {
  try {
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'technician_locations'
    `)
    
    if (result.rows.length > 0) {
      console.log('✅ Table technician_locations exists')
      
      // Also check columns
      const columns = await pool.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'technician_locations'
      `)
      
      console.log('\nColumns:')
      columns.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`)
      })
    } else {
      console.log('❌ Table technician_locations not found')
    }
    
    await pool.end()
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

checkTable()
