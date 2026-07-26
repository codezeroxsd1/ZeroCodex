import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  const client = await pool.connect()
  try {
    const res = await client.query(`SELECT id, date, estado FROM orden WHERE date >= $1 AND date < $2 ORDER BY date`, ['2026-07-21T00:00:00.000Z', '2026-07-22T00:00:00.000Z'])
    const rows = res.rows.map((r: any) => {
      const d = r.date ? new Date(r.date) : null
      return {
        id: r.id,
        raw: r.date,
        localDate: d ? d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }) : null,
        localTime: d ? d.toLocaleTimeString('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }) : null,
        estado: r.estado,
      }
    })
    return NextResponse.json({ success: true, rows })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  } finally {
    client.release()
  }
}
