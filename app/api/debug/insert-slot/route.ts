import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function GET() {
  const client = await pool.connect()
  try {
    const date = '2026-07-21T23:00:00.000Z'
    const ids: number[] = []
    for (let i = 0; i < 3; i++) {
      const res = await client.query(
        `insert into orden (clienteid, clientenombre, clientetelefono, categoria, descripcion, direccion, urgencia, estado, precio, date, "localDate", "localTime", "createdAt", "updatedAt")
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now()) returning id`,
        [`debug-insert-${Date.now()}-${i}`, 'Debug Insert', '+56 9 0000 0000', 'reparaciones', 'Debug insert', 'Calle Debug', 'normal', 'pendiente', 0, date, '2026-07-21', '19:00'],
      )
      ids.push(res.rows[0].id)
    }
    return NextResponse.json({ success: true, ids })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  } finally {
    client.release()
  }
}
