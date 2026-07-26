const { Pool } = require('pg')

;(async () => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS escalations (
        id serial PRIMARY KEY,
        name text,
        email text,
        phone text,
        order_id integer,
        role text,
        message text,
        created_at timestamptz DEFAULT now()
      );
    `)
    console.log('escalations table ensured')
  } catch (err) {
    console.error('error creating escalations table', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
    process.exit(0)
  }
})()
