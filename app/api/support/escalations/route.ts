import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import fs from 'fs/promises'
import path from 'path'
import { requireRole } from '@/lib/session'

export async function GET() {
  try {
    await requireRole('admin')
    // Try DB first
    try {
      const client = await pool.connect()
      try {
        const res = await client.query('SELECT id, name, email, phone, order_id as "orderId", role, message, created_at as "createdAt" FROM escalations ORDER BY created_at DESC LIMIT 200')
        return NextResponse.json({ ok: true, source: 'db', items: res.rows })
      } finally {
        client.release()
      }
    } catch (dbErr) {
      console.warn('Escalations DB read failed, falling back to file:', dbErr)
    }

    // Fallback: read file
    const file = path.join(process.cwd(), 'app', 'data', 'escalations.jsonl')
    try {
      const raw = await fs.readFile(file, 'utf-8')
      const items = raw
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
        .reverse()
        .slice(0, 200)
      return NextResponse.json({ ok: true, source: 'file', items })
    } catch (fileErr) {
      console.warn('Escalations file read failed:', fileErr)
      return NextResponse.json({ ok: false, error: 'No escalations available' }, { status: 404 })
    }
  } catch (err) {
    console.error(err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
