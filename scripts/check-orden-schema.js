const fs = require('fs');
const { Client } = require('pg');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
(async () => {
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='orden' ORDER BY ordinal_position");
  console.log(JSON.stringify(res.rows, null, 2));
  const pk = await client.query("SELECT a.attname AS column_name FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = 'orden'::regclass AND i.indisprimary;");
  console.log('pk', JSON.stringify(pk.rows, null, 2));
  await client.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});