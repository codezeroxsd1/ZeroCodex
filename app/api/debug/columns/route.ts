import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  const client = await pool.connect()
  try {
    const cols = await client.query(`
      select column_name
      from information_schema.columns
      where table_name = 'orden'
      order by ordinal_position
    `)
    const rows = await client.query(`
      select id, clienteid, date, "localDate", "localTime", estado, "createdAt"
      from orden
      order by "createdAt" desc
      limit 20
    `)
    return NextResponse.json({
      success: true,
      columns: cols.rows.map((r) => r.column_name),
      rows: rows.rows,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  } finally {
    client.release()
  }
}
