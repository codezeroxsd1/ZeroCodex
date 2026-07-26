import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

const HOURS = ['09:00', '11:00', '13:00', '15:30', '17:00', '19:00']

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    if (!dateParam) return NextResponse.json({ error: 'date required' }, { status: 400 })

    const counts: Record<string, number> = {}
    for (const h of HOURS) counts[h] = 0

    try {
      // Fetch all scheduled rows and filter by local date in America/Santiago
      const res = await pool.query('SELECT date, estado, "localDate", "localTime" FROM orden WHERE date IS NOT NULL')

      for (const row of res.rows) {
        try {
          const localDateField = row.localDate
          const localTimeField = row.localTime
          const estado = String(row.estado ?? '').toLowerCase()
          if (localDateField && localTimeField) {
            if (localDateField !== dateParam) continue
            if (HOURS.includes(localTimeField) && estado !== 'finalizado' && estado !== 'rechazado') {
              counts[localTimeField] = (counts[localTimeField] || 0) + 1
            }
            continue
          }

          const d = new Date(row.date)
          const localDate = d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }) // YYYY-MM-DD
          if (localDate !== dateParam) continue
          const hh = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })
          if (hh && HOURS.includes(hh) && estado !== 'finalizado' && estado !== 'rechazado') {
            counts[hh] = (counts[hh] || 0) + 1
          }
        } catch {
          continue
        }
      }
    } catch {
      // Fall back to empty availability if the database is unavailable.
    }

    return NextResponse.json({ success: true, counts })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
