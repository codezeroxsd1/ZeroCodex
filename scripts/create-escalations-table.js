const { pool } = require('../lib/db')

;(async () => {
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
    console.error(err)
    process.exit(1)
  } finally {
    client.release()
    process.exit(0)
  }
})()
