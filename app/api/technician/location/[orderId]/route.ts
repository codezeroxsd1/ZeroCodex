import { getSessionUser } from '@/lib/session'
import { Pool } from 'pg'
import { NextRequest, NextResponse } from 'next/server'

let dbPool: Pool | null = null

function getDbPool() {
  if (!dbPool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL not set')
    dbPool = new Pool({ connectionString })
  }
  return dbPool
}

// Guardar ubicación del técnico
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== 'tecnico') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { lat, lng } = await request.json()
    
    if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    const { orderId } = await params
    const pool = getDbPool()

    // Guardar en tabla de locations (crear si no existe)
    await pool.query(
      `INSERT INTO technician_locations (order_id, technician_id, lat, lng, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (order_id) DO UPDATE SET
       lat = $3, lng = $4, updated_at = NOW()`,
      [orderId, user.id, lat, lng]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving location:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Obtener ubicación del técnico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params

    const pool = getDbPool()
    const result = await pool.query(
      `SELECT lat, lng, updated_at as timestamp
       FROM technician_locations
       WHERE order_id = $1
       AND updated_at > NOW() - INTERVAL '2 minutes'`,
      [orderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { location: null },
        { status: 200 }
      )
    }

    const location = result.rows[0]
    return NextResponse.json({
      location: {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng),
        timestamp: location.timestamp ? new Date(location.timestamp).getTime() : Date.now(),
      }
    })
  } catch (error) {
    console.error('Error fetching location:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
