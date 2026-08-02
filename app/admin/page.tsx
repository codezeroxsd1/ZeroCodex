import { redirect } from 'next/navigation'
import { AdminPanel } from "@/components/admin/admin-panel"
import { db, pool } from '@/lib/db'

export const dynamic = 'force-dynamic'
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
    const res = await pool.query('SELECT id, name, email, role, phone, "createdAt" FROM "user" LIMIT 100')
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
    .map((u: any) => {
      const clientType = String(u.clientType ?? 'particular').toLowerCase().trim() === 'empresa' ? 'empresa' : 'particular'
      return {
        id: u.id,
        name: u.name || u.email || 'usuario',
        clientType,
        type: clientType === 'empresa' ? 'Empresa' : 'Particular',
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
        rating: 0,
      }
    })

  const technicians = users
    .filter((u: any) => normalizeRole(u.role) === 'tecnico')
    .map((t: any) => ({
      id: t.id,
      name: t.name || t.email,
      rating: 0,
      specialty: '',
      status: 'Disponible',
      isApproved: Boolean(t.isApproved),
    }))

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

  // compute average ratings for technicians and clients from order feedback
  const parseMaybeJson = (value: any) => {
    if (!value) return null
    if (typeof value === 'object') return value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    }
    return null
  }

  const techRatings: Record<string, { total: number; count: number }> = {}
  const clientRatings: Record<string, { total: number; count: number }> = {}

  for (const o of orders) {
    const parsed = parseMaybeJson(o.notasTecnico ?? o.notastecnico ?? o.feedback ?? null)

    // client's rating of the technician (submitted from client UI)
    const clientGaveRating = parsed?.rating ?? (typeof parsed?.rating === 'number' ? parsed.rating : undefined)
    // technician's rating of client (submitted from technician UI) usually stored as clientRating.score
    const techGaveClientRating = parsed?.clientRating?.score ?? (typeof parsed?.clientRating === 'number' ? parsed.clientRating : undefined)

    const techId = o.tecnicoId ?? o.tecnicoid ?? null
    const clientId = o.clienteId ?? o.clienteid ?? o.cliente ?? null

    if (techId && (clientGaveRating !== undefined && clientGaveRating !== null)) {
      const key = String(techId)
      techRatings[key] = techRatings[key] ?? { total: 0, count: 0 }
      techRatings[key].total += Number(clientGaveRating) || 0
      techRatings[key].count += 1
    }

    if (clientId && (techGaveClientRating !== undefined && techGaveClientRating !== null)) {
      const key = String(clientId)
      clientRatings[key] = clientRatings[key] ?? { total: 0, count: 0 }
      clientRatings[key].total += Number(techGaveClientRating) || 0
      clientRatings[key].count += 1
    }
  }

  const techniciansWithRatings = technicians.map((t) => {
    const agg = techRatings[String(t.id)]
    const avg = agg && agg.count > 0 ? Math.round((agg.total / agg.count) * 10) / 10 : 0
    return { ...t, rating: avg }
  })

  const clientsWithRatings = clients.map((c) => {
    const agg = clientRatings[String(c.id)]
    const avg = agg && agg.count > 0 ? Math.round((agg.total / agg.count) * 10) / 10 : 0
    return { ...c, rating: avg }
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
    clients={clientsWithRatings}
    technicians={techniciansWithRatings}
    quotes={quotes}
    orders={workOrders}
    initialView={resolvedSearchParams.view === 'solicitudes' ? 'solicitudes' : undefined}
  />
}
