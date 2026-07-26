import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  const client = await pool.connect()
  try {
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "localDate" text')
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "localTime" text')
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "pdfUrl" text')
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "historial" text')
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "technicalEvidence" text')
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "departureAt" timestamp')
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "arrivalAt" timestamp')
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "workStartAt" timestamp')
    await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "workEndAt" timestamp')
    return NextResponse.json({ success: true, message: 'Columns added' })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  } finally {
    client.release()
  }
}
