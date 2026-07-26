import { redirect } from 'next/navigation'
import { TecnicoApp } from '@/components/tecnico/tecnico-app'
import { db, pool } from '@/lib/db'
import { orden } from '@/lib/db/schema'
import { getFriendlyServiceName, normalizeServiceValue } from '@/lib/data'
import { getSessionUser } from '@/lib/session'

const homeByRole = {
  cliente: '/cliente',
  tecnico: '/tecnico',
  admin: '/admin',
} as const

export default async function TecnicoPage() {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    redirect('/sign-in/tecnico')
  }

  if (sessionUser.role !== 'tecnico') {
    redirect(homeByRole[sessionUser.role])
  }

  let orders: any[] = []
  try {
    orders = await db.select().from(orden).limit(100)
  } catch (error) {
    const res = await pool.query('SELECT * FROM orden LIMIT 100')
    orders = res.rows
  }

  const initialOrders = orders.map((o: any) => {
    const rawServiceName = o.categoria || o.service || o.descripcion || 'Servicio'
    const serviceName = getFriendlyServiceName(rawServiceName)
    return {
      id: o.id,
      client: o.clienteNombre,
      clienteNombre: o.clienteNombre,
      service: serviceName,
      serviceId: normalizeServiceValue(rawServiceName),
      categoria: serviceName,
      descripcion: o.descripcion,
      address: o.direccion,
      direccion: o.direccion,
      status: o.estado,
      estado: o.estado,
      price: o.precio,
      precio: o.precio,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      tecnicoId: o.tecnicoId ?? o.tecnicoid ?? null,
      tecnicoNombre: o.tecnicoNombre ?? o.tecniconombre ?? null,
      urgencia: o.urgencia,
      localDate: o.localDate || o.local_date || null,
      localTime: o.localTime || o.local_time || o.time || o.hora || null,
      historial: o.historial,
      technicalEvidence: o.technicalEvidence,
      departureAt: o.departureAt,
      arrivalAt: o.arrivalAt,
      workStartAt: o.workStartAt,
      workEndAt: o.workEndAt,
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <TecnicoApp initialOrders={initialOrders} />
    </div>
  )
}
