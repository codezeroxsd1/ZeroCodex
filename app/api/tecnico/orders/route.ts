import { NextResponse } from 'next/server'
import { db, pool } from '@/lib/db'
import { orden } from '@/lib/db/schema'

export async function GET() {
  try {
    const orders = await db.select().from(orden).limit(200)
    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error fetching tecnico orders with Drizzle:', error)
    const res = await pool.query('SELECT * FROM orden LIMIT 200')
    return NextResponse.json({ orders: res.rows })
  }
}
