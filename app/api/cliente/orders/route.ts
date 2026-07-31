import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { orden } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/session'

export async function GET() {
  try {
    const user = await requireRole('cliente')

    // Use a raw fallback query to avoid Drizzle selecting columns that may not exist
    try {
      const orders = await db
        .select()
        .from(orden)
        .where(eq(orden.clienteId, user.id))
        .orderBy(desc(orden.createdAt))

      return NextResponse.json({ orders })
    } catch (e) {
      const res = await (global as any).pool.query('SELECT id, clienteid, clientenombre, clienteTelefono, categoria, descripcion, direccion, urgencia, estado, tecnicoid, tecniconombre, precio, pdfUrl, date, localDate, localTime, notastecnico, historial, departureAt, arrivalAt, workStartAt, workEndAt, createdAt, updatedAt FROM orden WHERE clienteid = $1 ORDER BY createdAt DESC', [user.id])
      return NextResponse.json({ orders: res.rows })
    }
  } catch (error) {
    console.error('Error fetching cliente orders:', error)
    return NextResponse.json({ orders: [] })
  }
}
