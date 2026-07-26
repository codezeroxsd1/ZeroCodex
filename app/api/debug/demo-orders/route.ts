import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  try {
    const res = await pool.query(`SELECT id, clienteid, date, estado, "createdAt" FROM orden WHERE clienteid LIKE 'cliente-demo-%' ORDER BY date DESC NULLS LAST LIMIT 200`)
    const rows = res.rows?.map((r: any) => ({
      id: r.id,
      clienteid: r.clienteid,
      date: r.date ? new Date(r.date).toISOString() : null,
      estado: r.estado,
      createdAt: r.createdAt,
    }))
    return NextResponse.json({ success: true, rows })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
