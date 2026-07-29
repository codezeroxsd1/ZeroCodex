const { Pool } = require('pg');
const url = 'postgresql://neondb_owner:npg_TJ35AgBesNKm@ep-hidden-salad-avjeuokn-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const pool = new Pool({ connectionString: url });
pool.query('select now() as ts')
  .then((res) => {
    console.log(JSON.stringify(res.rows[0]));
    return pool.end();
  })
  .catch((err) => {
    console.error(err.message);
    pool.end();
    process.exit(1);
  });
