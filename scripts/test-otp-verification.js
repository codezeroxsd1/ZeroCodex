import { Pool } from "pg"

const databaseUrl = process.env.DATABASE_URL

async function checkOTPStatus() {
  if (!databaseUrl) {
    console.error("DATABASE_URL not set")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    console.log("🔍 Checking OTP records in database...")

    // List all tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    
    console.log("\n📋 Available tables:")
    tables.rows.forEach(t => console.log(`  - ${t.table_name}`))

    // Check verificationToken table (used by better-auth)
    const otpRecords = await pool.query(`
      SELECT * FROM "verificationToken" 
      ORDER BY created_at DESC 
      LIMIT 10
    `)

    console.log("\n🔐 Recent OTP records:")
    if (otpRecords.rows.length === 0) {
      console.log("  ❌ No OTP records found!")
    } else {
      otpRecords.rows.forEach(record => {
        console.log(`  Email: ${record.email}`)
        console.log(`  Token: ${record.token}`)
        console.log(`  Type: ${record.type}`)
        console.log(`  Expires: ${record.expiresAt}`)
        console.log(`  Created: ${record.created_at}`)
        console.log("  ---")
      })
    }

    // Check if user exists
    const testEmail = "copias.010101@gmail.com"
    const user = await pool.query(
      'SELECT id, email, emailVerified FROM "user" WHERE email = $1',
      [testEmail]
    )

    console.log(`\n👤 User status for ${testEmail}:`)
    if (user.rows.length === 0) {
      console.log("  ❌ User not found")
    } else {
      const u = user.rows[0]
      console.log(`  ID: ${u.id}`)
      console.log(`  Email: ${u.email}`)
      console.log(`  Verified: ${u.emailVerified}`)
    }

  } catch (error) {
    console.error("❌ Error:", error.message)
  } finally {
    await pool.end()
  }
}

checkOTPStatus()
