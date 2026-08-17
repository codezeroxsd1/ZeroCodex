#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '..', 'migrations', '20260816_add_technician_locations.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    await pool.query(sql)
    console.log('✅ Migration 20260816_add_technician_locations completed successfully')
    
    await pool.end()
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

runMigration()
