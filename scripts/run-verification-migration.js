import { Pool } from "pg"
import { readFileSync } from "fs"
import { resolve } from "path"

const databaseUrl = process.env.DATABASE_URL

async function runMigration() {
  if (!databaseUrl) {
    console.error("DATABASE_URL not set")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const migrationFile = resolve(process.cwd(), "migrations/20260817_create_verification_token_table.sql")
    const sql = readFileSync(migrationFile, "utf-8")

    console.log("🔄 Running migration: 20260817_create_verification_token_table.sql")
    await pool.query(sql)
    console.log("✅ Migration completed successfully!")

    // Verify table was created
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'verificationToken'
      )
    `)

    if (tableCheck.rows[0].exists) {
      console.log("✅ verificationToken table verified!")
    } else {
      console.log("❌ verificationToken table NOT found!")
    }
  } catch (error) {
    console.error("❌ Migration failed:", error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigration()
