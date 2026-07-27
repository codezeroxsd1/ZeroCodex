import { redirect } from 'next/navigation'
import { AdminPanel } from "@/components/admin/admin-panel"
import { db, pool } from '@/lib/db'
import { user, orden } from '@/lib/db/schema'
import { getFriendlyServiceName } from '@/lib/data'
import { getSessionUser } from '@/lib/session'

export const metadata = {
  title: 'Zero Industries · Panel Administrador',
}

const homeByRole = {
  cliente: '/cliente',
  tecnico: '/tecnico',
  admin: '/admin',
} as const

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    redirect('/sign-in/admin')
  }

  if (sessionUser.role !== 'admin') {
    redirect(homeByRole[sessionUser.role])
  }

  const resolvedSearchParams = await searchParams

  // fetch users and orders from DB
  let users: any[] = []
  let orders: any[] = []
  try {
    users = await db.select().from(user).limit(100)
  } catch (e) {
    const res = await pool.query('SELECT id, name, email, role, phone, createdAt FROM "user" LIMIT 100')
    users = res.rows
  }

  try {
    orders = await db.select().from(orden).limit(100)
  } catch (e) {
    const res = await pool.query('SELECT * FROM orden LIMIT 100')
    orders = res.rows
  }

  const normalizeRole = (value: unknown) => String(value ?? '').toLowerCase().trim()

  // map to plain objects for client
  const clients = users
    .filter((u: any) => normalizeRole(u.role) === 'cliente')
    .map((u: any) => ({
      id: u.id,
      name: u.name || u.email || 'usuario',
      type: 'Cliente',
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    }))

  const technicians = users
    .filter((u: any) => normalizeRole(u.role) === 'tecnico')
    .map((t: any) => ({ id: t.id, name: t.name || t.email, rating: 0, specialty: '', status: 'Disponible' }))

  const workOrders = orders.map((o: any) => {
    const estado = o.estado || o.status || 'pendiente'
    const clientName = o.client || o.clienteNombre || o.cliente || o.client_name || o.clientname || 'Cliente'
    const rawServiceName = o.categoria || o.service || o.descripcion || o.description || 'Servicio'
    const serviceName = getFriendlyServiceName(rawServiceName)
    const dateValue = o.date || o.localDate || o.local_date || o.createdAt || o.createdat || o.created_at

    const localDate = o.localDate || o.local_date || null
    const localTime = o.localTime || o.local_time || o.time || o.hora || null
    const pdfUrl = o.pdfUrl || o.pdf || null
    return {
      id: o.id,
      date: dateValue ? new Date(dateValue).toISOString() : undefined,
      localDate,
      localTime,
      requestedTime: localTime,
      clienteNombre: clientName,
      clienteTelefono: o.clienteTelefono || o.client_phone || o.cliente_telefono || '',
      categoria: serviceName,
      descripcion: o.descripcion || o.service || '',
      direccion: o.direccion || o.address || '',
      estado,
      precio: Number(o.precio ?? o.price ?? o.total ?? 0),
      service: serviceName,
      status: estado,
      client: clientName,
      tecnicoId: o.tecnicoId ?? o.tecnicoid ?? null,
      tecnicoNombre: o.tecnicoNombre ?? o.tecniconombre ?? null,
      notasTecnico: o.notasTecnico ?? o.notastecnico ?? o.feedback ?? null,
      technicalEvidence: o.technicalEvidence ?? null,
      historial: o.historial ?? null,
      pdfUrl,
    }
  })

  // If there's no dedicated quotes table, derive simple quote records from orders
  // This recovers the 'Cotizaciones' view when the backend/table isn't present.
  const quotes: any[] = (orders || [])
    .filter((o: any) => Number(o.precio ?? 0) > 0)
    .map((o: any) => ({
      id: o.id,
      client: o.clienteNombre || o.client || 'Cliente',
      service: getFriendlyServiceName(o.categoria || o.service || o.descripcion || 'Servicio'),
      date: o.date || o.createdAt || o.created_at || undefined,
      total: Number(o.precio ?? o.price ?? o.total ?? 0),
      status: (o.status || o.estado || 'Enviada'),
    }))


  return <AdminPanel
    clients={clients}
    technicians={technicians}
    quotes={quotes}
    orders={workOrders}
    initialView={resolvedSearchParams.view === 'solicitudes' ? 'solicitudes' : undefined}
  />
}
