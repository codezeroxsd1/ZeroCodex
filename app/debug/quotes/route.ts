import { NextResponse } from 'next/server'
import { db, pool } from '@/lib/db'

export async function GET() {
  try {
    let orders: any[] = []
    try {
      orders = await db.select().from('orden').limit(200) as any[]
    } catch (e) {
      try {
        const res = await (pool as any).query('SELECT * FROM orden LIMIT 200')
        orders = res.rows
      } catch (err) {
        orders = []
      }
    }

    const quotes = (orders || [])
      .filter((o: any) => Number(o.precio ?? 0) > 0)
      .map((o: any) => ({
        id: o.id,
        client: o.clienteNombre || o.client || 'Cliente',
        service: o.categoria || o.service || o.descripcion || 'Servicio',
        date: o.date || o.createdAt || o.created_at || null,
        total: Number(o.precio ?? o.price ?? o.total ?? 0),
        status: o.status || o.estado || 'Enviada',
      }))

    return NextResponse.json({ success: true, quotes })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
