'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  HardHat,
  CalendarDays,
  FileText,
  Receipt,
  BarChart3,
  DollarSign,
  Wrench,
  Star,
  Search,
  Home,
  Check,
  ClipboardList,
  User,
  LogIn,
  Settings,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/logo'
import { StatusBadge } from '@/components/status-badge'
import { RevenueChart, JobsChart, SegmentsChart } from './charts'
import { formatCLP, getFriendlyServiceName, serviceChecklists } from '@/lib/data'
import { updateOrdenStatus, asignarOrdenATecnico } from '@/app/actions/orden'
import { useSession, signOut } from '@/lib/auth-client'

type View =
  | 'dashboard'
  | 'clientes'
  | 'tecnicos'
  | 'solicitudes'
  | 'agenda'
  | 'cotizaciones'
  | 'facturacion'
  | 'reportes'
  | 'promociones'
  | 'configuraciones'

const requestStatuses = ['pendiente', 'en camino', 'en proceso', 'finalizado', 'rechazado', 'en revision'] as const

type RequestStatus = (typeof requestStatuses)[number]

function normalizeRequestStatus(value: unknown): RequestStatus {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw.includes('revision') || raw.includes('revisión')) return 'en revision'
  if (raw.includes('rechaz')) return 'rechazado'
  if (raw.includes('camino')) return 'en camino'
  if (raw.includes('proceso') || raw.includes('progreso')) return 'en proceso'
  if (raw.includes('final')) return 'finalizado'
  return 'pendiente'
}

function formatRequestDate(value: unknown): string {
  if (!value) return 'Fecha desconocida'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseHistory(raw: any): any[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return raw.trim() ? [{ title: raw.trim() }] : []
    }
  }
  if (Array.isArray(raw)) return raw
  return []
}

function getOrderFeedback(order: any): any {
  const directFeedback = order?.notasTecnico ?? order?.notastecnico ?? order?.feedback
  if (directFeedback) return directFeedback

  const reviewEntry = parseHistory(order?.historial).find((entry: any) => {
    const title = String(entry?.title ?? '').toLowerCase()
    return title.includes('revisión') || title.includes('revision')
  })

  return reviewEntry?.details ?? null
}

const nav: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'tecnicos', label: 'Técnicos', icon: HardHat },
  { id: 'solicitudes', label: 'Solicitudes', icon: ClipboardList },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
  { id: 'facturacion', label: 'Facturación', icon: Receipt },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'configuraciones', label: 'Configuraciones', icon: Settings },
]

export function AdminPanel({
  clients = [],
  technicians = [],
  quotes = [],
  orders = [],
  initialView,
}: {
  clients?: any[]
  technicians?: any[]
  quotes?: any[]
  orders?: any[]
  initialView?: View
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const adminProfileUser = {
    name: String((session?.user as any)?.name ?? 'Admin'),
    email: String((session?.user as any)?.email ?? 'admin@empresa.com'),
    role: String((session?.user as any)?.role ?? 'admin'),
  }
  const safeOrders = orders ?? []
  const safeClients = clients ?? []
  const safeTechnicians = technicians ?? []
  const safeQuotes = quotes ?? []
  const [showProfile, setShowProfile] = useState(false)
  const [view, setView] = useState<View>(initialView ?? 'dashboard')
  const openOrders = safeOrders.filter((o) => String(o.status ?? o.estado ?? '').toLowerCase() !== 'finalizado').length

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh()
    }, 8000)

    return () => window.clearInterval(interval)
  }, [router])
  const onlineTechnicians = safeTechnicians.filter((t) => String(t.status ?? '').toLowerCase() === 'disponible').length
  const [updatingOrden, setUpdatingOrden] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [requestFilter, setRequestFilter] = useState<'all' | RequestStatus>('all')
  const [billingFilter, setBillingFilter] = useState<'all' | 'pagada' | 'pendiente' | 'cancelada'>('all')

  const refreshSolicitudes = () => {
    setView('solicitudes')
    router.refresh()
  }

  const searchTerm = search.trim().toLowerCase()
  const filteredClients = clients.filter((c) => {
    if (!searchTerm) return true
    return [c.name, c.type, c.lastService].filter(Boolean).join(' ').toLowerCase().includes(searchTerm)
  })

  const filteredTechnicians = technicians.filter((t) => {
    if (!searchTerm) return true
    return [t.name, t.specialty, t.status].filter(Boolean).join(' ').toLowerCase().includes(searchTerm)
  })

  const filteredOrders = orders.filter((o) => {
    if (!searchTerm) return true
    return [o.clienteNombre, o.client, o.categoria, o.service, o.estado, o.status, o.direccion]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(searchTerm)
  })
  
  // dynamic KPIs computed from real data
  const ingresosMesValue = (() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let total = 0

    if (orders && Array.isArray(orders)) {
      for (const o of orders) {
        const status = String(o.estado || o.status || '').toLowerCase()
        if (status !== 'finalizado' && status !== 'pagada' && status !== 'pagado') continue

        const dateValue = o.date || o.createdAt || o.localDate || o.local_date || o.created_at
        if (!dateValue) continue

        const oDate = new Date(dateValue)
        if (oDate.getFullYear() === currentYear && oDate.getMonth() === currentMonth) {
          total += Number(o.precio ?? o.price ?? o.total ?? o.amount ?? 0) || 0
        }
      }
    }

    return total
  })()

  const trabajosActivos = orders.filter((o) => (o.status ?? 'pendiente') !== 'finalizado').length
  const clientesTotales = clients.length
  const satisfaccion = Math.round(
    (technicians.reduce((a, t) => a + (t.rating || 0), 0) / Math.max(1, technicians.length)) * 10,
  ) / 10

  const kpis = [
    { label: 'Ingresos del mes', value: formatCLP(ingresosMesValue), delta: '+0%', icon: DollarSign },
    { label: 'Trabajos activos', value: String(trabajosActivos), delta: '+0', icon: Wrench },
    { label: 'Clientes totales', value: String(clientesTotales), delta: '+0', icon: Users },
    { label: 'Satisfacción', value: String(satisfaccion), delta: '+0.0', icon: Star },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      {/* sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="border-b border-border p-4">
          <Logo size={34} withText />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                view === n.id
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <n.icon className="size-4" />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
          >
            <Home className="size-4" /> Volver al inicio
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="lg:hidden">
            <Logo size={30} />
          </div>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clientes, órdenes, técnicos..."
              className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-3 relative">
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-medium leading-tight">{adminProfileUser.name}</span>
              <span className="block text-xs text-muted-foreground">{adminProfileUser.email}</span>
            </span>
            <button
              onClick={() => setShowProfile((prev) => !prev)}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent/10"
              aria-label="Perfil admin"
            >
              <User className="size-4" />
            </button>
          </div>
        </header>

        {showProfile && (
          <AdminProfilePanel
            user={adminProfileUser}
            stats={{
              openOrders,
              activeClients: clients.length,
              onlineTechnicians,
            }}
            onClose={() => setShowProfile(false)}
            onLogout={async () => {
              try {
                await signOut()
              } catch (error) {
                console.error('Error during sign out:', error)
              }
              router.push('/sign-in/admin')
            }}
          />
        )}

        {/* mobile nav */}
        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 lg:hidden">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                view === n.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
              )}
            >
              <n.icon className="size-3.5" />
              {n.label}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {view === 'dashboard' && (
            <Dashboard
              orders={safeOrders}
              clients={safeClients}
              quotes={safeQuotes}
              updatingOrden={updatingOrden}
              setUpdatingOrden={setUpdatingOrden}
            />
          )}
          {view === 'clientes' && <Clientes clients={filteredClients} orders={filteredOrders} />}
          {view === 'tecnicos' && <Tecnicos technicians={filteredTechnicians} />}
          {view === 'solicitudes' && (
            <Solicitudes
              orders={filteredOrders}
              technicians={technicians}
              search={searchTerm}
              filter={requestFilter}
              onFilterChange={setRequestFilter}
              adminName={session?.user?.name || 'Admin'}
              refreshSolicitudes={refreshSolicitudes}
            />
          )}
          {view === 'agenda' && <Agenda orders={orders} technicians={technicians} />}
          {view === 'cotizaciones' && <Cotizaciones quotes={safeQuotes} />}
          {view === 'facturacion' && (
            <Facturacion
              quotes={quotes}
              orders={orders}
              search={searchTerm}
              filter={billingFilter}
              onFilterChange={setBillingFilter}
            />
          )}
          {view === 'reportes' && <Reportes orders={orders} />}
          {view === 'promociones' && <Configuraciones initialTab="promociones" />}
          {view === 'configuraciones' && <Configuraciones />}
        </main>
      </div>
    </div>
  )
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function Dashboard({
  orders,
  clients,
  quotes,
  updatingOrden,
  setUpdatingOrden,
}: {
  orders?: any[]
  clients?: any[]
  quotes?: any[]
  updatingOrden?: string | null
  setUpdatingOrden?: (id: string | null) => void
}) {
  const [period, setPeriod] = useState<'30d' | 'ytd' | 'all'>('30d')

  const { periodOrders, totalOrders, completedOrders, totalRevenue, averageTicket, activeClients, newClientsThisMonth, topClients, topTechnicians, recentOrders } = useMemo(() => {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const cutoff30d = new Date(now)
    cutoff30d.setDate(cutoff30d.getDate() - 30)

    const isPaidStatus = (status: string) => {
      const normalized = status.toLowerCase().trim()
      return ['finalizado', 'pagada', 'pagado', 'completado'].includes(normalized)
    }

    const clientsById: Record<string, any> = {}
    for (const c of clients ?? []) {
      if (c?.id) clientsById[c.id] = c
    }

    const allOrders = orders ?? []
    const distinctClients = new Set(allOrders.map((o) => o.clienteId || o.clienteid || o.clienteNombre || o.client || o.cliente || 'Anónimo')).size

    const newClientsThisMonth = (clients ?? []).filter((c) => {
      if (!c?.createdAt) return false
      const createdDate = new Date(c.createdAt)
      return createdDate.getFullYear() === now.getFullYear() && createdDate.getMonth() === now.getMonth()
    }).length

    const clientStats: Record<string, { id: string; name: string; total: number; count: number }> = {}
    const technicianStats: Record<string, { name: string; total: number; count: number; completed: number }> = {}
    const enrichedOrders = allOrders
      .map((o) => {
        const dateValue = o.date || o.localDate || o.local_date || o.createdAt || o.created_at
        return {
          ...o,
          parsedDate: dateValue ? new Date(dateValue) : null,
          amount: Number(o.precio ?? o.price ?? o.total ?? o.amount ?? 0),
          statusNormalized: String(o.status ?? o.estado ?? '').toLowerCase(),
          clientId: o.clienteId || o.clienteid || o.clienteNombre || o.client || 'Cliente',
          clientName: o.clienteNombre || o.client || 'Cliente',
          technicianName: o.tecnicoNombre || o.tecniconombre || o.tecnico || 'Sin técnico',
        }
      })
      .filter((o) => o.parsedDate && !Number.isNaN(o.parsedDate.getTime()))

    const paidOrders = enrichedOrders.filter((o) => isPaidStatus(o.statusNormalized))
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number.isNaN(o.amount) ? 0 : o.amount), 0)
    const completedOrders = paidOrders.length
    const averageTicket = completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0

    for (const o of enrichedOrders) {
      const clientKey = o.clientId
      if (!clientStats[clientKey]) {
        clientStats[clientKey] = { id: clientKey, name: o.clientName, total: 0, count: 0 }
      }
      clientStats[clientKey].total += o.amount
      clientStats[clientKey].count += 1

      const techKey = o.technicianName
      if (!technicianStats[techKey]) {
        technicianStats[techKey] = { name: techKey, total: 0, count: 0, completed: 0 }
      }
      technicianStats[techKey].total += o.amount
      technicianStats[techKey].count += 1
      if (o.statusNormalized === 'finalizado') {
        technicianStats[techKey].completed += 1
      }
    }

    const topClients = Object.values(clientStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const topTechnicians = Object.values(technicianStats)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5)

    const sortedRecentOrders = enrichedOrders
      .sort((a, b) => Number(b.parsedDate) - Number(a.parsedDate))
      .slice(0, 6)

    const periodOrders = allOrders.filter((o) => {
      const dateValue = o.date || o.localDate || o.local_date || o.createdAt || o.created_at
      const parsed = dateValue ? new Date(dateValue) : null
      if (!parsed || Number.isNaN(parsed.getTime())) return false
      if (period === '30d') return parsed >= cutoff30d
      if (period === 'ytd') return parsed >= startOfYear
      return true
    })

    return {
      periodOrders,
      totalOrders: allOrders.length,
      completedOrders,
      totalRevenue,
      averageTicket,
      activeClients: distinctClients,
      newClientsThisMonth,
      topClients,
      topTechnicians,
      recentOrders: sortedRecentOrders,
    }
  }, [orders, clients, period])

  const periodCards = [
    { id: '30d', label: 'Últimos 30 días' },
    { id: 'ytd', label: 'Año actual' },
    { id: 'all', label: 'Todo' },
  ] as const

  const kpis = [
    { label: 'Ingresos del mes', value: formatCLP(totalRevenue), delta: '+0%', icon: DollarSign },
    { label: 'Órdenes completadas', value: String(completedOrders), delta: '+0%', icon: Check },
    { label: 'Ticket promedio', value: formatCLP(averageTicket), delta: '+0%', icon: Receipt },
    { label: 'Clientes activos', value: String(activeClients), delta: '+0%', icon: Users },
  ]

  return (
    <div>
      <PageTitle title="Dashboard" subtitle="Resumen general del negocio · Julio 2026" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {periodCards.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setPeriod(option.id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition',
              period === option.id
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <k.icon className="size-4" />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-bold">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 xl:col-span-2">
          <p className="mb-4 font-semibold">Gráfico de ingresos</p>
          <RevenueChart orders={orders} quotes={quotes} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-semibold">Estado de facturación</p>
          <SegmentsChart orders={orders} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-semibold">Trabajos por tipo</p>
          <JobsChart orders={orders} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-semibold">Top clientes</p>
          <div className="space-y-3">
            {topClients.map((client) => (
              <div key={client.id} className="rounded-2xl border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.count} órdenes</p>
                  </div>
                  <p className="font-semibold">{formatCLP(client.total)}</p>
                </div>
              </div>
            ))}
            {topClients.length === 0 && <p className="text-xs text-muted-foreground">No hay datos de clientes.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-semibold">Top técnicos</p>
          <div className="space-y-3">
            {topTechnicians.map((tech) => (
              <div key={tech.name} className="rounded-2xl border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{tech.name}</p>
                    <p className="text-xs text-muted-foreground">{tech.completed} completadas · {tech.count} asignadas</p>
                  </div>
                  <p className="font-semibold">{formatCLP(tech.total)}</p>
                </div>
              </div>
            ))}
            {topTechnicians.length === 0 && <p className="text-xs text-muted-foreground">No hay datos de técnicos.</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-semibold">Órdenes recientes</p>
          <div className="space-y-3">
            {recentOrders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-border bg-background/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{o.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {getFriendlyServiceName(o.service ?? o.categoria ?? o.descripcion ?? 'Servicio')} • {o.parsedDate?.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <p className="font-semibold">{formatCLP(o.amount)}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={o.statusNormalized || o.estado || 'pendiente'} />
                  <span>{o.technicianName}</span>
                  {o.amount > 0 && <span>{formatCLP(o.amount)}</span>}
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && <p className="text-xs text-muted-foreground">No hay órdenes recientes.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-semibold">Resumen rápido</p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Órdenes totales</span>
              <span>{totalOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Órdenes activas</span>
              <span>{totalOrders - completedOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Clientes nuevos este mes</span>
              <span>{newClientsThisMonth}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ingresos totales</span>
              <span>{formatCLP(totalRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Promedio ticket</span>
              <span>{formatCLP(averageTicket)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Clientes({ clients = [], orders = [] }: { clients: any[]; orders: any[] }) {
  const clientStats = useMemo(() => {
    const stats: Record<string, { jobs: number; spent: number; lastService: string }> = {}
    for (const c of clients) {
      stats[c.id] = { jobs: 0, spent: 0, lastService: 'Sin registro' }
    }

    for (const o of orders ?? []) {
      const clientId = o.clientId || o.clienteId || o.clienteid || o.clienteNombre || o.client || o.cliente || 'unknown'
      const amount = Number(o.precio ?? o.price ?? o.total ?? o.amount ?? 0)
      const parsedDate = o.date || o.localDate || o.local_date || o.createdAt || o.created_at ? new Date(o.date || o.localDate || o.local_date || o.createdAt || o.created_at) : null
      const clientKey = stats[clientId] ? clientId : Object.keys(stats).find((key) => {
        const client = clients?.find((c) => c.id === key)
        return client && (client.name === o.clienteNombre || client.name === o.client || client.name === o.cliente)
      })

      if (!clientKey) continue
      const current = stats[clientKey]
      current.jobs += 1
      current.spent += Number.isNaN(amount) ? 0 : amount
      if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
        const currentLast = new Date(current.lastService === 'Sin registro' ? 0 : current.lastService)
        if (parsedDate > currentLast) {
          current.lastService = parsedDate.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        }
      }
    }

    return stats
  }, [clients, orders])

  return (
    <div>
      <PageTitle title="Clientes" subtitle="Gestión de clientes y su historial" />
      {clients.length === 0 && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No hay clientes que coincidan con la búsqueda.
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Trabajos</th>
              <th className="px-4 py-3 font-medium">Facturado</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Último</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const stats = clientStats[c.id] ?? { jobs: 0, spent: 0, lastService: 'Sin registro' }
              return (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                        {c.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{c.type}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{stats.jobs}</td>
                  <td className="px-4 py-3 font-medium">{formatCLP(stats.spent)}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{stats.lastService}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Tecnicos({ technicians = [] }: { technicians: any[] }) {
  const statusColor: Record<string, string> = {
    Disponible: 'text-primary',
    'En terreno': 'text-warning',
    Descanso: 'text-muted-foreground',
  }
  return (
    <div>
      <PageTitle title="Técnicos" subtitle="Equipo en terreno y disponibilidad" />
      {technicians.length === 0 && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No hay técnicos que coincidan con la búsqueda.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {technicians.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/15 font-display font-bold text-primary">
                {t.name.split(' ').map((n: string) => n[0]).join('')}
              </span>
              <div className="flex-1">
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.specialty}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className={cn('flex items-center gap-1.5 font-medium', statusColor[t.status])}>
                <span className="size-2 rounded-full bg-current" /> {t.status}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Star className="size-3.5 fill-warning text-warning" /> {t.rating}
              </span>
            </div>
            <div className="mt-3 rounded-xl bg-secondary px-3 py-2 text-center text-xs">
              <span className="font-bold text-foreground">{t.jobsToday}</span>{' '}
              <span className="text-muted-foreground">trabajos hoy</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Solicitudes({
  orders = [],
  technicians = [],
  search = '',
  filter = 'all',
  onFilterChange,
  adminName = 'Admin',
  refreshSolicitudes,
}: {
  orders?: any[]
  technicians?: any[]
  search?: string
  filter?: 'all' | RequestStatus
  onFilterChange?: (value: 'all' | RequestStatus) => void
  adminName?: string
  refreshSolicitudes?: () => void
}) {
  const [selectedOrden, setSelectedOrden] = useState<string | null>(null)
  const [selectedTecnico, setSelectedTecnico] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ ordenId: string; motivo: string } | null>(null)
  const [feedbackModal, setFeedbackModal] = useState<{ ordenId: string; motivo: string; technicalEvidence?: unknown } | null>(null)
  const [historyModal, setHistoryModal] = useState<{ ordenId: string; historyEntries: any[] } | null>(null)

  const getOrderService = (order: any) =>
    getFriendlyServiceName(order.service ?? order.categoria ?? order.descripcion ?? order.description ?? 'Servicio')

  const getEffectiveRequestStatus = (order: any): RequestStatus => {
    const normalized = normalizeRequestStatus(order?.estado || order?.status || 'pendiente')
    if (normalized !== 'finalizado') return normalized

    const feedbackText = [order?.notasTecnico, order?.notastecnico, order?.feedback]
      .filter(Boolean)
      .map((value) => String(value))
      .join(' ')

    const historyEntries = parseHistory(order?.historial)
    const historyText = historyEntries
      .map((entry: any) => `${entry?.title ?? ''} ${entry?.details ?? ''}`)
      .join(' ')

    const reviewSignals = [feedbackText, historyText].some((value) => {
      const text = String(value ?? '').toLowerCase()
      return text.includes('rejection_report') || text.includes('revisión') || text.includes('revision') || text.includes('orden en revisión')
    })

    return reviewSignals ? 'en revision' : normalized
  }

  const solicitudes = orders.filter((o) => {
    const estado = getEffectiveRequestStatus(o)
    const matchesStatus = filter === 'all' || estado === filter
    const haystack = [
      o.clienteNombre,
      o.client,
      o.categoria,
      o.service,
      getOrderService(o),
      o.direccion,
      o.estado,
      o.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const matchesSearch = !search || haystack.includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const reviewOrders = solicitudes.filter((solicitud) => getEffectiveRequestStatus(solicitud) === 'en revision')

  const handleAsignar = async (ordenId: string) => {
    const tecnicoId = selectedTecnico[ordenId]
    if (!tecnicoId) {
      alert('Selecciona un técnico')
      return
    }
    setAssigning(ordenId)
    try {
      const tecnico = technicians.find((t) => t.id === tecnicoId)
      if (tecnico) {
        const result = await asignarOrdenATecnico(ordenId, tecnico.id, tecnico.name)
        if (result.success) {
          alert(`✓ Orden asignada a ${tecnico.name}`)
          setSelectedOrden(null)
          setSelectedTecnico((prev) => ({ ...prev, [ordenId]: '' }))
          refreshSolicitudes?.()
        } else {
          alert(`❌ Error: ${result.error}`)
        }
      }
    } catch (error) {
      alert(`❌ Error: ${String(error)}`)
    } finally {
      setAssigning(null)
    }
  }

  const handleReject = (ordenId: string) => {
    setRejectModal({ ordenId, motivo: '' })
  }

  const confirmReject = async () => {
    if (!rejectModal?.motivo?.trim()) {
      alert('Debes indicar un motivo de rechazo.')
      return
    }

    const ordenId = rejectModal.ordenId
    setUpdating(ordenId)
    try {
      const result = await updateOrdenStatus(ordenId, 'rechazado', {
        feedback: `Rechazado por ${adminName}: ${rejectModal.motivo.trim()}`,
        resetAssignment: true,
      })
      if (result.success) {
        setRejectModal(null)
        refreshSolicitudes?.()
      } else {
        alert(`❌ Error: ${result.error}`)
      }
    } catch (error) {
      alert(`❌ Error: ${String(error)}`)
    } finally {
      setUpdating(null)
    }
  }

  const openFeedbackModal = (ordenId: string, motivo: string, technicalEvidence?: unknown) => {
    setFeedbackModal({ ordenId, motivo, technicalEvidence })
  }

  const openHistoryModal = (ordenId: string, historial: any) => {
    setHistoryModal({ ordenId, historyEntries: parseHistory(historial) })
  }

  const parseFeedback = (raw: any) => {
    if (!raw) return null
    if (typeof raw !== 'string') return raw
    try {
      return JSON.parse(raw)
    } catch {
      const trimmed = raw.trim()
      if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
        try {
          return JSON.parse(trimmed)
        } catch {
          return raw
        }
      }
      return raw
    }
  }

  const handleResume = async (ordenId: string) => {
    setUpdating(ordenId)
    try {
      const result = await updateOrdenStatus(ordenId, 'pendiente', {
        resetAssignment: true,
      })
      if (result.success) {
        refreshSolicitudes?.()
      } else {
        alert(`❌ Error: ${result.error}`)
      }
    } catch (error) {
      alert(`❌ Error: ${String(error)}`)
    } finally {
      setUpdating(null)
    }
  }

  const statusLabel = (status: RequestStatus) => {
    if (status === 'en proceso') return 'En proceso'
    if (status === 'en camino') return 'En camino'
    if (status === 'finalizado') return 'Finalizado'
    if (status === 'rechazado') return 'Rechazado'
    if (status === 'en revision') return 'En revisión'
    return 'Pendiente'
  }

  return (
    <div>
      <PageTitle
        title="Solicitudes de Clientes"
        subtitle="Asigna técnicos y gestiona el avance de cada solicitud"
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', ...requestStatuses] as const).map((value) => (
          <button
            key={value}
            onClick={() => onFilterChange?.(value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium',
              filter === value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
            )}
          >
            {value === 'all' ? 'Todas' : value}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {reviewOrders.length > 0 && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-700">Órdenes en revisión</p>
                <p className="text-xs text-muted-foreground">{reviewOrders.length} solicitud{reviewOrders.length !== 1 ? 'es' : ''} pendiente{reviewOrders.length !== 1 ? 's' : ''} de evaluación</p>
              </div>
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700">Revisión</span>
            </div>
          </div>
        )}
        {solicitudes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <ClipboardList className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">No hay solicitudes con esos filtros</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(filter === 'all' ? requestStatuses : [filter]).map((statusKey) => {
              const grouped = solicitudes.filter((solicitud) => getEffectiveRequestStatus(solicitud) === statusKey)
              if (grouped.length === 0) return null

              return (
                <div key={statusKey} className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{statusLabel(statusKey)}</h3>
                      <p className="text-xs text-muted-foreground">{grouped.length} solicitud{grouped.length !== 1 ? 'es' : ''}</p>
                    </div>
                    <StatusBadge status={statusKey} />
                  </div>
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col className="w-[18%]" />
                        <col className="w-[42%]" />
                        <col className="w-[14%]" />
                        <col className="w-[12%]" />
                        <col className="w-[14%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Cliente</th>
                          <th className="px-4 py-3 font-medium">Servicio</th>
                          <th className="px-4 py-3 font-medium">Estado</th>
                          <th className="px-4 py-3 font-medium">Monto</th>
                          <th className="px-4 py-3 font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped.map((solicitud) => (
                          <tr key={solicitud.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 min-w-0">
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{solicitud.clienteNombre || solicitud.client}</p>
                                <p className="text-xs text-muted-foreground break-words">{solicitud.direccion}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 min-w-0">
                              <div className="min-w-0">
                                <p className="font-medium">{getOrderService(solicitud)}</p>
                                <p className="mt-1 text-xs text-muted-foreground break-words">{solicitud.descripcion}</p>
                                <p className="mt-2 text-xs text-muted-foreground break-words">Dirección: {solicitud.direccion || 'No especificada'}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Solicitada: {formatRequestDate(solicitud.date || solicitud.createdAt || solicitud.createdat || solicitud.created_at)}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {getOrderFeedback(solicitud) && (
                                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                                      Feedback disponible
                                    </span>
                                  )}
                                  {(() => {
                                    const historyEntries = parseHistory(solicitud.historial)
                                    return historyEntries.length > 0 ? (
                                      <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                                        Historial: {historyEntries.length}
                                      </span>
                                    ) : null
                                  })()}
                                  {getOrderFeedback(solicitud) && (
                                    <button
                                      type="button"
                                      onClick={() => openFeedbackModal(solicitud.id, getOrderFeedback(solicitud), solicitud.technicalEvidence)}
                                      className="text-xs font-semibold underline"
                                    >
                                      Ver detalle
                                    </button>
                                  )}
                                  {(() => {
                                    const historyEntries = parseHistory(solicitud.historial)
                                    return historyEntries.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => openHistoryModal(solicitud.id, solicitud.historial)}
                                        className="text-xs font-semibold underline"
                                      >
                                        Ver historial completo
                                      </button>
                                    ) : null
                                  })()}
                                </div>
                                {(() => {
                                  const historyEntries = parseHistory(solicitud.historial)
                                  return historyEntries.length > 0 ? (
                                    <div className="mt-2 rounded-xl border border-border/70 bg-background/70 p-2">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Últimos eventos</p>
                                      <div className="mt-2 space-y-1">
                                        {historyEntries.slice(0, 2).map((entry: any, index: number) => (
                                          <div key={`${entry.title ?? 'event'}-${index}`} className="text-[11px] text-muted-foreground">
                                            <p className="font-medium text-foreground">{entry.title || 'Evento'}</p>
                                            {entry.details ? <p className="truncate">{entry.details}</p> : null}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null
                                })()}
                              </div>
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={getEffectiveRequestStatus(solicitud)} /></td>
                            <td className="px-4 py-3">{formatCLP(Number(solicitud.precio || 0))}</td>
                            <td className="px-4 py-3">
                            {statusKey === 'pendiente' ? (
                              <div className="flex flex-wrap gap-2">
                                <select
                                  value={selectedTecnico[solicitud.id] || ''}
                                  onChange={(e) => setSelectedTecnico((prev) => ({ ...prev, [solicitud.id]: e.target.value }))}
                                  className="rounded border border-border bg-background px-2 py-1 text-xs"
                                >
                                  <option value="">Asignar técnico</option>
                                  {technicians.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAsignar(solicitud.id)}
                                  disabled={assigning === solicitud.id}
                                  className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                                >
                                  {assigning === solicitud.id ? 'Asignando...' : 'Asignar'}
                                </button>
                                <button
                                  onClick={() => handleReject(solicitud.id)}
                                  disabled={updating === solicitud.id}
                                  className="rounded border border-destructive px-2 py-1 text-xs text-destructive"
                                >
                                  Rechazar
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1 text-xs">
                                {statusKey === 'rechazado' ? (
                                  <>
                                    <p className="font-medium">Rechazado por</p>
                                    <p className="text-muted-foreground">
                                      { String(solicitud.notasTecnico || solicitud.feedback || 'Desconocido') }
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="font-medium">Técnico asignado</p>
                                    <p className="text-muted-foreground">
                                      {solicitud.tecnicoNombre || solicitud.tecnico || 'Sin técnico asignado'}
                                    </p>
                                  </>
                                )}
                                {(statusKey === 'finalizado' || statusKey === 'rechazado' || statusKey === 'en revision') && (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => handleResume(solicitud.id)}
                                      disabled={updating === solicitud.id}
                                      className="rounded border border-primary px-2 py-1 text-xs text-primary"
                                    >
                                      {updating === solicitud.id ? '...' : 'Retomar'}
                                    </button>
                                    {statusKey === 'en revision' && (
                                      <button
                                        className="rounded border border-amber-500 px-2 py-1 text-xs text-amber-600"
                                        type="button"
                                      >
                                        Cotizar extra
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 lg:hidden">
                    {grouped.map((solicitud) => (
                      <div key={solicitud.id} className="rounded-2xl border border-border bg-background/60 p-3">
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="min-w-0">
                            <p className="font-semibold">{solicitud.clienteNombre || solicitud.client}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{getOrderService(solicitud)}</p>
                          </div>
                          <StatusBadge status={getEffectiveRequestStatus(solicitud)} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground break-words">{solicitud.descripcion}</p>
                        <p className="mt-2 text-xs text-muted-foreground break-words">Dirección: {solicitud.direccion || 'No especificada'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Solicitada: {formatRequestDate(solicitud.date || solicitud.createdAt || solicitud.createdat || solicitud.created_at)}</p>
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
                          <span className="text-xs text-muted-foreground">Monto</span>
                          <span className="font-semibold">{formatCLP(Number(solicitud.precio || 0))}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-primary">
                          {getOrderFeedback(solicitud) && (
                            <span>Feedback disponible</span>
                          )}
                          {(() => {
                            const historyEntries = parseHistory(solicitud.historial)
                            return historyEntries.length > 0 ? (
                              <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                                Historial: {historyEntries.length}
                              </span>
                            ) : null
                          })()}
                          {getOrderFeedback(solicitud) && (
                            <button
                              type="button"
                              onClick={() => openFeedbackModal(solicitud.id, getOrderFeedback(solicitud), solicitud.technicalEvidence)}
                              className="text-xs font-semibold underline"
                            >
                              Ver detalle
                            </button>
                          )}
                          {(() => {
                            const historyEntries = parseHistory(solicitud.historial)
                            return historyEntries.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => openHistoryModal(solicitud.id, solicitud.historial)}
                                className="text-xs font-semibold underline"
                              >
                                Ver historial completo
                              </button>
                            ) : null
                          })()}
                        </div>
                        {(() => {
                          const historyEntries = parseHistory(solicitud.historial)
                          return historyEntries.length > 0 ? (
                            <div className="mt-2 rounded-xl border border-border/70 bg-background/70 p-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Últimos eventos</p>
                              <div className="mt-2 space-y-1">
                                {historyEntries.slice(0, 2).map((entry: any, index: number) => (
                                  <div key={`${entry.title ?? 'event'}-${index}`} className="text-[11px] text-muted-foreground">
                                    <p className="font-medium text-foreground">{entry.title || 'Evento'}</p>
                                    {entry.details ? <p className="truncate">{entry.details}</p> : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null
                        })()}
                        <div className="mt-3 flex flex-col gap-2">
                          {getEffectiveRequestStatus(solicitud) === 'pendiente' ? (
                            <>
                              <select
                                value={selectedTecnico[solicitud.id] || ''}
                                onChange={(e) => setSelectedTecnico((prev) => ({ ...prev, [solicitud.id]: e.target.value }))}
                                className="flex-1 rounded border border-border bg-background px-2 py-2 text-xs"
                              >
                                <option value="">Asignar técnico</option>
                                {technicians.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => handleAsignar(solicitud.id)}
                                  disabled={assigning === solicitud.id}
                                  className="rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                                >
                                  {assigning === solicitud.id ? '...' : 'Asignar'}
                                </button>
                                <button
                                  onClick={() => handleReject(solicitud.id)}
                                  disabled={updating === solicitud.id}
                                  className="rounded border border-destructive px-3 py-2 text-xs text-destructive"
                                >
                                  {updating === solicitud.id ? '...' : 'Rechazar'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="rounded-2xl border border-border bg-secondary/50 px-3 py-2 text-xs">
                              {getEffectiveRequestStatus(solicitud) === 'rechazado' ? (
                                <>
                                  <p className="font-medium">Rechazado por</p>
                                  <p className="text-muted-foreground">
                                    {String(solicitud.notasTecnico || solicitud.feedback || 'Desconocido')}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="font-medium">Técnico asignado</p>
                                  <p className="text-muted-foreground">
                                    {solicitud.tecnicoNombre || solicitud.tecnico || 'Sin técnico asignado'}
                                  </p>
                                </>
                              )}
                              {getEffectiveRequestStatus(solicitud) === 'finalizado' || getEffectiveRequestStatus(solicitud) === 'rechazado' || getEffectiveRequestStatus(solicitud) === 'en revision' ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handleResume(solicitud.id)}
                                    disabled={updating === solicitud.id}
                                    className="inline-flex rounded border border-primary px-3 py-2 text-xs text-primary"
                                  >
                                    {updating === solicitud.id ? '...' : 'Retomar'}
                                  </button>
                                  {getEffectiveRequestStatus(solicitud) === 'en revision' ? (
                                    <button
                                      className="inline-flex rounded border border-amber-500 px-3 py-2 text-xs text-amber-600"
                                      type="button"
                                    >
                                      Cotizar extra
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Rechazar solicitud</h2>
            <p className="mt-2 text-sm text-muted-foreground">Especifica el motivo por el cual se rechaza esta solicitud.</p>
            <textarea
              value={rejectModal.motivo}
              onChange={(e) => setRejectModal((prev) => prev && ({ ...prev, motivo: e.target.value }))}
              rows={5}
              className="mt-4 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              placeholder="Motivo del rechazo..."
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={confirmReject}
                disabled={updating === rejectModal.ordenId}
                className="inline-flex items-center justify-center rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
              >
                {updating === rejectModal.ordenId ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
              <button
                onClick={() => setRejectModal(null)}
                disabled={updating === rejectModal.ordenId}
                className="inline-flex items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Historial completo - Orden {historyModal.ordenId}</h2>
            <div className="mt-4 space-y-3">
              {historyModal.historyEntries.length > 0 ? (
                historyModal.historyEntries.map((entry: any, index: number) => (
                  <div key={`${entry.title ?? 'event'}-${index}`} className="rounded-2xl border border-border bg-background p-3">
                    <p className="text-sm font-semibold text-foreground">{entry.title || 'Evento'}</p>
                    {entry.details ? <p className="mt-1 text-sm text-muted-foreground">{entry.details}</p> : null}
                    {entry.timestamp ? (
                      <p className="mt-2 text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString('es-CL')}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                  No hay eventos registrados en el historial.
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => setHistoryModal(null)}
                className="inline-flex items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Detalle del Feedback - Orden {feedbackModal.ordenId}</h2>
            
            {(() => {
              try {
                const feedbackBase = parseFeedback(feedbackModal.motivo)
                const evidenceBase = parseFeedback(feedbackModal.technicalEvidence)
                const feedback =
                  typeof feedbackBase === 'object' && feedbackBase !== null
                    ? {
                        ...feedbackBase,
                        ...(typeof evidenceBase === 'object' && evidenceBase !== null ? evidenceBase : {}),
                      }
                    : typeof evidenceBase === 'object' && evidenceBase !== null
                      ? evidenceBase
                      : null

                const rejectionFeedback = feedback?.type === 'rejection_report'
                  ? feedback
                  : feedback?.completionFeedback?.type === 'rejection_report'
                    ? feedback.completionFeedback
                    : null
                const isRejectionReport = Boolean(rejectionFeedback)

                if (isRejectionReport) {
                  return (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                        <h3 className="text-sm font-semibold text-destructive">Reporte de rechazo técnico</h3>
                        <p className="mt-2 text-sm text-foreground">{rejectionFeedback.technician || 'Técnico'}</p>
                        {rejectionFeedback.reasons?.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {rejectionFeedback.reasons.map((reason: string, index: number) => (
                              <span key={`${reason}-${index}`} className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                                {reason === 'sin_materiales' ? 'No tenía todos los materiales' : reason === 'falla_incoherente' ? 'La falla no era coherente con la solicitud' : reason === 'cliente_no_responde' ? 'El cliente no respondió' : reason}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {rejectionFeedback.missingMaterials?.length > 0 ? (
                          <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Materiales faltantes</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {rejectionFeedback.missingMaterials.map((material: any, index: number) => (
                                <span key={`${material?.id ?? material?.name ?? 'material'}-${index}`} className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                  {material?.name ?? material} · Cantidad: {Number(material?.quantity ?? 1)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {rejectionFeedback.details ? (
                          <div className="mt-3 rounded-2xl border border-destructive/20 bg-background/80 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Detalle</p>
                            <p className="mt-1 text-sm text-foreground">{rejectionFeedback.details}</p>
                          </div>
                        ) : null}
                        {rejectionFeedback.timestamp ? (
                          <p className="mt-3 text-xs text-muted-foreground">{new Date(rejectionFeedback.timestamp).toLocaleString('es-CL')}</p>
                        ) : null}
                      </div>
                    </div>
                  )
                }

                // Si es un JSON válido con estructura de feedback
                if (feedback && (feedback.materials || feedback.checklist || feedback.photos || feedback.signature || feedback.voltage || feedback.current || feedback.earthResistance || feedback.continuity || feedback.observations)) {
                  return (
                    <div className="mt-4 space-y-6">
                      {/* Técnico */}
                      <div className="rounded-2xl border border-border bg-background p-4">
                        <h3 className="text-sm font-semibold">Técnico Responsable</h3>
                        <p className="mt-2 text-sm text-foreground">{feedback.technician}</p>
                      </div>

                      {/* Materiales */}
                      {feedback.materials && (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <h3 className="text-sm font-semibold mb-3">Materiales Utilizados</h3>
                          
                          {feedback.materials.description && (
                            <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Descripción:</p>
                              <p className="text-sm">{feedback.materials.description}</p>
                            </div>
                          )}

                          {feedback.materials.items && feedback.materials.items.length > 0 && (
                            <div className="space-y-2">
                              {feedback.materials.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-secondary/20 rounded">
                                  <div>
                                    <p className="text-sm font-medium">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatCLP(item.price)} x {item.quantity}</p>
                                  </div>
                                  <p className="text-sm font-semibold">{formatCLP(item.subtotal)}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {feedback.materials.total !== undefined && (
                            <div className="mt-3 pt-3 border-t border-border flex justify-between items-center font-semibold">
                              <span>Total Materiales</span>
                              <span>{formatCLP(feedback.materials.total)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {feedback.departureAt || feedback.arrivalAt || feedback.workStartAt || feedback.workEndAt ? (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <h3 className="text-sm font-semibold mb-3">Tiempos de trabajo</h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {feedback.departureAt && (
                              <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                                <p className="text-xs text-muted-foreground">Salida</p>
                                <p className="mt-1 text-sm font-semibold">{new Date(feedback.departureAt).toLocaleString('es-CL')}</p>
                              </div>
                            )}
                            {feedback.arrivalAt && (
                              <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                                <p className="text-xs text-muted-foreground">Llegada / Inicio</p>
                                <p className="mt-1 text-sm font-semibold">{new Date(feedback.arrivalAt).toLocaleString('es-CL')}</p>
                              </div>
                            )}
                            {feedback.workStartAt && (
                              <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                                <p className="text-xs text-muted-foreground">Trabajo iniciado</p>
                                <p className="mt-1 text-sm font-semibold">{new Date(feedback.workStartAt).toLocaleString('es-CL')}</p>
                              </div>
                            )}
                            {feedback.workEndAt && (
                              <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                                <p className="text-xs text-muted-foreground">Fin de trabajo</p>
                                <p className="mt-1 text-sm font-semibold">{new Date(feedback.workEndAt).toLocaleString('es-CL')}</p>
                              </div>
                            )}
                          </div>
                          {feedback.workDuration && (
                            <div className="mt-3 rounded-2xl border border-border bg-secondary/10 p-3">
                              <p className="text-xs text-muted-foreground">Trabajo efectivo</p>
                              <p className="mt-1 text-sm font-semibold">{feedback.workDuration}</p>
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* Evidencia técnica */}
                      {feedback.voltage || feedback.current || feedback.earthResistance || feedback.continuity || feedback.observations ? (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <h3 className="text-sm font-semibold mb-3">Evidencia Técnica</h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {feedback.voltage && (
                              <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                                <p className="text-xs text-muted-foreground">Voltaje</p>
                                <p className="mt-1 text-sm font-semibold">{feedback.voltage}</p>
                              </div>
                            )}
                            {feedback.current && (
                              <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                                <p className="text-xs text-muted-foreground">Corriente</p>
                                <p className="mt-1 text-sm font-semibold">{feedback.current}</p>
                              </div>
                            )}
                            {feedback.earthResistance && (
                              <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                                <p className="text-xs text-muted-foreground">Resistencia de tierra</p>
                                <p className="mt-1 text-sm font-semibold">{feedback.earthResistance}</p>
                              </div>
                            )}
                            {feedback.continuity && (
                              <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                                <p className="text-xs text-muted-foreground">Continuidad</p>
                                <p className="mt-1 text-sm font-semibold">{feedback.continuity}</p>
                              </div>
                            )}
                          </div>
                          {feedback.observations && (
                            <div className="mt-3 rounded-2xl border border-border bg-secondary/10 p-3">
                              <p className="text-xs text-muted-foreground">Observaciones técnicas</p>
                              <p className="mt-1 text-sm">{feedback.observations}</p>
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* Checklist */}
                      {feedback.checklist && (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <h3 className="text-sm font-semibold mb-3">Checklist - {feedback.checklist.service}</h3>
                          <div className="space-y-2">
                            {feedback.checklist.items && feedback.checklist.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <span className={`mt-0.5 text-lg ${item.completed ? 'text-green-500' : 'text-muted-foreground'}`}>
                                  {item.completed ? '✓' : '○'}
                                </span>
                                <span className={item.completed ? 'text-foreground' : 'text-muted-foreground line-through'}>
                                  {item.text}
                                </span>
                                {item.required && (
                                  <span className="text-xs bg-red-500/20 text-red-600 px-2 py-0.5 rounded">
                                    Requerido
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fotos */}
                      {feedback.photos && (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <h3 className="text-sm font-semibold mb-3">Fotografías</h3>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                              <p className="text-xs text-muted-foreground">Antes</p>
                              <p className="mt-2 text-lg font-semibold">{feedback.photos.before}</p>
                              {feedback.photos.beforeUrls?.length > 0 ? (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  {feedback.photos.beforeUrls.map((url: string, index: number) => (
                                    <a key={index} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-border bg-background">
                                      <img src={url} alt={`Foto antes ${index + 1}`} className="h-28 w-full object-cover" />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-muted-foreground">No hay fotos antes disponibles.</p>
                              )}
                            </div>
                            <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                              <p className="text-xs text-muted-foreground">Después</p>
                              <p className="mt-2 text-lg font-semibold">{feedback.photos.after}</p>
                              {feedback.photos.afterUrls?.length > 0 ? (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  {feedback.photos.afterUrls.map((url: string, index: number) => (
                                    <a key={index} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-border bg-background">
                                      <img src={url} alt={`Foto despues ${index + 1}`} className="h-28 w-full object-cover" />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-muted-foreground">No hay fotos después disponibles.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Firma */}
                      {feedback.signature !== undefined && (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <h3 className="text-sm font-semibold mb-3">Estado de Firma</h3>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg ${feedback.signature ? 'text-green-500' : 'text-muted-foreground'}`}>
                              {feedback.signature ? '✓' : '○'}
                            </span>
                            <span className="text-sm">
                              {feedback.signature ? 'Firmado por cliente' : 'Sin firma'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Fecha */}
                      {feedback.timestamp && (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <p className="text-xs text-muted-foreground">Completado</p>
                          <p className="text-sm">{new Date(feedback.timestamp).toLocaleString('es-CL')}</p>
                        </div>
                      )}
                    </div>
                  )
                }
              } catch (e) {
                // Si no es JSON, mostrar como texto plano
              }
              
              // Fallback a mostrar como texto plano
              return (
                <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                  {feedbackModal.motivo}
                </div>
              )
            })()}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => setFeedbackModal(null)}
                className="inline-flex items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Agenda({ orders, technicians }: { orders?: any[]; technicians?: any[] }) {
  const [agendaView, setAgendaView] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  const timeBlocks = ['09:00', '11:00', '13:00', '15:30', '17:00', '19:00']

  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)

  const parseDateKey = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map((part) => Number(part))
    return new Date(Date.UTC(year, month - 1, day))
  }

  const selectedDate = parseDateKey(selectedDateKey)
  const selectedDateLabel = selectedDate.toLocaleDateString('es-CL', {
    timeZone: 'America/Santiago',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const changeSelectedDate = (delta: number) => {
    const nextDate = new Date(selectedDate)
    nextDate.setUTCDate(selectedDate.getUTCDate() + delta)
    setSelectedDateKey(nextDate.toISOString().slice(0, 10))
  }

  const getScheduleInfo = (order: any) => {
    const localDate = order.localDate || order.local_date
    const localTime = order.localTime || order.local_time
    if (localDate && localTime) {
      const [year, month, day] = localDate.split('-').map((value: string) => Number(value))
      const [hours, minutes] = localTime.split(':').map((value: string) => Number(value))
      const scheduleDate =
        Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) && Number.isFinite(hours) && Number.isFinite(minutes)
          ? new Date(Date.UTC(year, month - 1, day, hours, minutes))
          : null
      const scheduleDateLabel = scheduleDate
        ? scheduleDate.toLocaleDateString('es-CL', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            timeZone: 'UTC',
          })
        : localDate
      return {
        scheduleDate,
        scheduleDateKey: localDate,
        scheduleDateLabel,
        scheduleTime: localTime,
      }
    }

    const dateValue = order.date || order.createdAt || order.createdat || order.created_at
    if (!dateValue) return { scheduleDate: null, scheduleDateKey: null, scheduleDateLabel: null, scheduleTime: null }
    const date = new Date(String(dateValue))
    const scheduleDateKey = date.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
    const scheduleDateLabel = date.toLocaleDateString('es-CL', {
      timeZone: 'America/Santiago',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    })
    const scheduleTime = date.toLocaleTimeString('es-CL', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
    })
    return { scheduleDate: date, scheduleDateKey, scheduleDateLabel, scheduleTime }
  }

  const normalizedOrders = (orders || []).map((o) => {
    const scheduleInfo = getScheduleInfo(o)
    return {
      ...o,
      ...scheduleInfo,
      status: String(o.status ?? o.estado ?? 'pendiente').toLowerCase(),
    }
  })

  const activeOrders = normalizedOrders.filter((o) => o.status !== 'finalizado' && o.status !== 'rechazado')

  const getDateRange = (dateKey: string, days: number) => {
    const dt = parseDateKey(dateKey)
    const result: string[] = []
    for (let i = 0; i < days; i += 1) {
      const current = new Date(dt)
      current.setUTCDate(dt.getUTCDate() + i)
      const key = current.toISOString().slice(0, 10)
      result.push(key)
    }
    return result
  }

  const weekKeys = getDateRange(todayKey, 7)
  const monthDays = new Date(Number(todayKey.slice(0, 4)), Number(todayKey.slice(5, 7)), 0).getDate()
  const monthKeys = getDateRange(`${todayKey.slice(0, 7)}-01`, monthDays)

  const dailyOrders = activeOrders.filter((o) => o.scheduleDateKey === selectedDateKey)
  const weeklyOrders = activeOrders.filter((o) => o.scheduleDateKey && weekKeys.includes(o.scheduleDateKey))
  const monthlyOrders = activeOrders.filter((o) => o.scheduleDateKey && o.scheduleDateKey.startsWith(todayKey.slice(0, 7)))

  const viewOrders = agendaView === 'daily' ? dailyOrders : agendaView === 'weekly' ? weeklyOrders : monthlyOrders

  const blockCounts = timeBlocks.reduce((acc: Record<string, number>, block) => {
    acc[block] = viewOrders.filter((order) => order.scheduleTime === block).length
    return acc
  }, {})

  const assignedByTech = (technicians || []).reduce((acc: Record<string, number>, tech) => {
    const count = activeOrders.filter((o) => {
      const techId = String(o.tecnicoId ?? o.tecnicoid ?? '').toLowerCase()
      const techName = String(o.tecnicoNombre ?? o.tecniconombre ?? '').toLowerCase()
      return techId === String(tech.id ?? '').toLowerCase() || techName === String(tech.name ?? '').toLowerCase()
    }).length
    acc[tech.name] = count
    return acc
  }, {})

  const getWeekDay = (date: Date) =>
    date.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: '2-digit' })

  const parseTimeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map((value: string) => Number(value))
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return 24 * 60
    return hours * 60 + minutes
  }

  const getOrderTimeMinutes = (order: any) => {
    if (order.scheduleTime) return parseTimeToMinutes(order.scheduleTime)
    if (order.scheduleDate) {
      const [hours, minutes] = order.scheduleDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }).split(':')
      return parseTimeToMinutes(`${Number(hours).toString().padStart(2, '0')}:${Number(minutes).toString().padStart(2, '0')}`)
    }
    return 24 * 60
  }

  const formatOrderTime = (order: any) => {
    if (order.scheduleTime) {
      const [hours, minutes] = order.scheduleTime.split(':').map((value: string) => Number(value))
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      }
      return order.scheduleTime
    }
    if (order.scheduleDate) {
      return order.scheduleDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    }
    return 'Hora indefinida'
  }

  const sortByTime = (ordersList: any[]) =>
    [...ordersList].sort((a, b) => getOrderTimeMinutes(a) - getOrderTimeMinutes(b))

  const groupByDay = (list: any[]) => {
    const grouped: Record<string, any[]> = {}
    list.forEach((order) => {
      const key = order.scheduleDate ? getWeekDay(order.scheduleDate) : 'Sin fecha'
      grouped[key] = grouped[key] || []
      grouped[key].push(order)
    })
    Object.keys(grouped).forEach((key) => {
      grouped[key] = sortByTime(grouped[key])
    })
    return grouped
  }

  const dailyGrouped = groupByDay(dailyOrders)
  const weeklyGrouped = groupByDay(weeklyOrders)
  const monthlyGrouped = groupByDay(monthlyOrders)

  const displayGroups = agendaView === 'daily' ? dailyGrouped : agendaView === 'weekly' ? weeklyGrouped : monthlyGrouped

  return (
    <div>
      <PageTitle title="Agenda" subtitle="Coordinación de técnicos y visitas" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { id: 'daily', label: 'Diaria' },
          { id: 'weekly', label: 'Semanal' },
          { id: 'monthly', label: 'Mensual' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAgendaView(tab.id as 'daily' | 'weekly' | 'monthly')}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              agendaView === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {agendaView === 'daily' && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => changeSelectedDate(-1)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-background"
          >
            Día anterior
          </button>
          <div className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold">
            {selectedDateLabel}
          </div>
          <input
            type="date"
            value={selectedDateKey}
            onChange={(event) => setSelectedDateKey(event.target.value)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => changeSelectedDate(1)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-background"
          >
            Siguiente día
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">Resumen de agenda</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Órdenes en vista</p>
                <p className="mt-2 text-2xl font-bold">{viewOrders.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Técnicos</p>
                <p className="mt-2 text-2xl font-bold">{technicians?.length || 0}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Órdenes sin asignar</p>
                <p className="mt-2 text-2xl font-bold">
                  {(orders || []).filter((o) => !o.tecnicoId && !o.tecnicoid).length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">Agenda {agendaView === 'daily' ? 'diaria' : agendaView === 'weekly' ? 'semanal' : 'mensual'}</p>
            <div className="mt-4 space-y-4">
              {Object.keys(displayGroups).length > 0 ? (
                Object.entries(displayGroups).map(([group, items]) => (
                  <div key={group} className="rounded-2xl border border-border bg-background p-4">
                    <p className="mb-3 text-sm font-semibold">{group}</p>
                    <div className="space-y-3">
                      {items.map((order) => {
                        const techName = order.tecnicoNombre || order.tecniconombre || 'Sin asignar'
                        const timeLabel = formatOrderTime(order)
                        return (
                          <div key={order.id} className="flex flex-col rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium">{order.clienteNombre || order.client || 'Cliente'}</p>
                              <p className="text-xs text-muted-foreground">{getFriendlyServiceName(order.service || order.categoria || order.descripcion)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Hora reservada: {timeLabel}</p>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:mt-0">
                              <span>{timeLabel}</span>
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{techName}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No hay órdenes para esta vista.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">Cargas por técnico</p>
            <div className="mt-4 space-y-3">
              {technicians?.map((tech) => (
                <div key={tech.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{tech.name}</p>
                      <p className="text-xs text-muted-foreground">{tech.specialty || 'General'}</p>
                    </div>
                    <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary">
                      {assignedByTech[tech.name] || 0} tareas
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-semibold">Resumen temporal</p>
            <div className="mt-4 space-y-2">
              {timeBlocks.map((time) => {
                const count = blockCounts[time] || 0
                return (
                  <div key={time} className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                    <div>
                      <p className="font-medium">{time}</p>
                      <p className="text-xs text-muted-foreground">Bloque</p>
                    </div>
                    <span className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium',
                      count >= 3 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
                    )}>
                      {count > 0 ? `${count} solicitudes` : 'Libre'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Cotizaciones(props: { quotes?: any[] }) {
  const safeQuotes = Array.isArray(props.quotes) ? props.quotes : []
  const styles: Record<string, string> = {
    Enviada: 'bg-warning/15 text-warning',
    Aprobada: 'bg-primary/15 text-primary',
    Rechazada: 'bg-destructive/15 text-destructive',
  }
  return (
    <div>
      <PageTitle title="Cotizaciones" subtitle="Propuestas enviadas a clientes" />
      <div className="grid gap-3 md:grid-cols-2">
        {safeQuotes.map((q) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{q.id} · {q.date}</p>
                <p className="mt-0.5 font-semibold">{q.client}</p>
                <p className="text-sm text-muted-foreground">{q.service}</p>
              </div>
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', styles[q.status])}>
                {q.status}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="font-display text-lg font-bold text-primary">
                {formatCLP(q.total)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function normalizeBillingStatus(rawValue: unknown) {
  const value = String(rawValue || '').toLowerCase().trim()
  if (value === 'rechazado' || value === 'cancelado') return 'cancelada'
  if (value === 'finalizado' || value === 'pagada' || value === 'pagado' || value === 'completado') return 'pagada'
  return 'pendiente'
}

function parseOrderDate(order: any) {
  const dateValue = order.date || order.createdAt || order.localDate || order.local_date || order.created_at
  if (!dateValue) return null
  const date = new Date(dateValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function Facturacion({
  quotes = [],
  orders = [],
  search = '',
  filter = 'all',
  onFilterChange,
}: {
  quotes?: any[]
  orders?: any[]
  search?: string
  filter?: 'all' | 'pagada' | 'pendiente' | 'cancelada'
  onFilterChange?: (value: 'all' | 'pagada' | 'pendiente' | 'cancelada') => void
}) {
  const [uploadingOrderId, setUploadingOrderId] = useState<number | string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  const handleUploadClick = (orderId: number | string) => {
    setUploadError(null)
    setUploadingOrderId(orderId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || uploadingOrderId == null) return

    const formData = new FormData()
    formData.append('orderId', String(uploadingOrderId))
    formData.append('file', file)

    try {
      setUploading(true)
      setUploadError(null)
      const response = await fetch('/api/admin/orden-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Error subiendo el PDF')
      }

      setUploadingOrderId(null)
      if (event.target) event.target.value = ''
      router.refresh()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error))
    } finally {
      setUploading(false)
    }
  }

  const billingEntries = (orders || []).map((o) => {
    const status = normalizeBillingStatus(o.estado || o.status)
    const date = parseOrderDate(o)

    return {
      id: o.id,
      client: o.clienteNombre || o.client,
      total: Number(o.precio || 0),
      status,
      date,
      service: getFriendlyServiceName(o.categoria || o.service || o.descripcion || 'Servicio'),
      pdfUrl: o.pdfUrl || o.pdf || null,
    }
  })

  const currentMonthPaid = billingEntries.reduce((sum, entry) => {
    if (entry.status !== 'pagada' || !entry.date) return sum
    const now = new Date()
    if (entry.date.getFullYear() === now.getFullYear() && entry.date.getMonth() === now.getMonth()) {
      return sum + entry.total
    }
    return sum
  }, 0)

  const visibleEntries = billingEntries.filter((entry) => {
    const matchesFilter = filter === 'all' || entry.status === filter
    const haystack = [entry.client, entry.service, entry.status].filter(Boolean).join(' ').toLowerCase()
    const matchesSearch = !search || haystack.includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const paid = visibleEntries.filter((entry) => entry.status === 'pagada')
  const pending = visibleEntries.filter((entry) => entry.status === 'pendiente')
  const canceled = visibleEntries.filter((entry) => entry.status === 'cancelada')
  const total = paid.reduce((a, entry) => a + entry.total, 0)

  return (
    <div>
      <PageTitle title="Facturación" subtitle="Órdenes cerradas y estado de pago" />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      {uploadError ? (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {uploadError}
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'pagada', 'pendiente', 'cancelada'] as const).map((value) => (
          <button
            key={value}
            onClick={() => onFilterChange?.(value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium',
              filter === value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
            )}
          >
            {value === 'all'
              ? 'Todas'
              : value === 'pagada'
              ? 'Pagadas'
              : value === 'pendiente'
              ? 'Pendientes'
              : 'Canceladas'}
          </button>
        ))}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Facturado mes</p>
          <p className="mt-1 font-display text-xl font-bold text-primary">{formatCLP(currentMonthPaid)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pagadas</p>
          <p className="mt-1 font-display text-xl font-bold">{paid.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pendientes</p>
          <p className="mt-1 font-display text-xl font-bold text-warning">{pending.length}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Documento</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => (
              <tr key={entry.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">F-{String(entry.id).slice(0, 4)}</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.client}</td>
                <td className="px-4 py-3 font-medium">{formatCLP(entry.total)}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    entry.status === 'pagada'
                      ? 'bg-primary/15 text-primary'
                      : entry.status === 'pendiente'
                      ? 'bg-warning/15 text-warning'
                      : 'bg-destructive/15 text-destructive',
                  )}>
                    {entry.status === 'pagada'
                      ? 'Pagada'
                      : entry.status === 'pendiente'
                      ? 'Pendiente'
                      : 'Cancelada'}
                  </span>
                </td>
                <td className="px-4 py-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleUploadClick(entry.id)}
                    className={cn(
                      'rounded border border-border px-2 py-1 text-xs text-muted-foreground',
                      uploading && uploadingOrderId === entry.id ? 'opacity-80' : '',
                    )}
                    disabled={uploading && uploadingOrderId === entry.id}
                  >
                    {uploading && uploadingOrderId === entry.id ? 'Subiendo...' : 'Subir PDF'}
                  </button>
                  {entry.pdfUrl ? (
                    <a
                      href={entry.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                    >
                      Ver PDF
                    </a>
                  ) : (
                    <span className="inline-flex rounded border border-border px-2 py-1 text-xs text-muted-foreground opacity-40">
                      Ver PDF
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Reportes({ orders = [] }: { orders?: any[] }) {
  const [reportFilter, setReportFilter] = useState<'all' | 'pagada' | 'pendiente' | 'cancelada'>('all')

  const visibleOrders = useMemo(() => {
    return orders.filter((o) => {
      const status = normalizeBillingStatus(o.estado || o.status)
      return reportFilter === 'all' || status === reportFilter
    })
  }, [orders, reportFilter])

  const paidOrders = visibleOrders.filter((o) => {
    const status = String(o.estado || o.status || '').toLowerCase()
    return ['finalizado', 'pagada', 'pagado', 'completado'].includes(status)
  })

  const totalRevenue = paidOrders.reduce((sum, o) => {
    const amount = Number(o.precio ?? o.price ?? o.total ?? o.amount ?? 0)
    return sum + (Number.isNaN(amount) ? 0 : amount)
  }, 0)

  const completedJobs = paidOrders.length
  const nonCanceledOrders = visibleOrders.filter((o) => normalizeBillingStatus(o.estado || o.status) !== 'cancelada')
  const totalOrders = nonCanceledOrders.length
  const paymentRate = totalOrders ? Math.round((completedJobs / totalOrders) * 100) : 0
  const averageTicket = completedJobs ? formatCLP(totalRevenue / completedJobs) : formatCLP(0)

  const stats = [
    { label: 'Ingresos pagados', value: formatCLP(totalRevenue) },
    { label: 'Trabajos facturados', value: String(completedJobs) },
    { label: 'Ticket promedio', value: averageTicket },
    { label: 'Tasa de pago', value: `${paymentRate}%` },
  ]

  return (
    <div>
      <PageTitle title="Reportes y estadísticas" subtitle="Rendimiento operativo del período" />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'pagada', 'pendiente', 'cancelada'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setReportFilter(value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium',
              reportFilter === value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
            )}
          >
            {value === 'all'
              ? 'Todas'
              : value === 'pagada'
              ? 'Pagadas'
              : value === 'pendiente'
              ? 'Pendientes'
              : 'Canceladas'}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <p className="mb-4 font-semibold">Evolución de ingresos</p>
          <RevenueChart orders={visibleOrders} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-semibold">Trabajos por tipo</p>
          <JobsChart orders={visibleOrders} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-semibold">Órdenes por estado</p>
          <SegmentsChart orders={visibleOrders} />
        </div>
      </div>
    </div>
  )
}

function Configuraciones({ initialTab }: { initialTab?: 'agenda' | 'servicios' | 'checklists' | 'materiales' | 'promociones' }) {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingChecklistServiceId, setEditingChecklistServiceId] = useState<string | null>(null)
  const [configTab, setConfigTab] = useState<'agenda' | 'servicios' | 'checklists' | 'materiales' | 'promociones'>(initialTab ?? 'agenda')
  const [materialCategory, setMaterialCategory] = useState('Todos')
  const [showGlobalMarkup, setShowGlobalMarkup] = useState(false)
  const [globalMarkup, setGlobalMarkup] = useState('0')

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings')
      const json = await res.json()
      setSettings(json?.settings ?? null)
    } catch {
      setMessage('No se pudieron cargar las configuraciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'No se pudo guardar')
      setSettings(json.settings)
      setMessage('Configuraciones guardadas correctamente.')
    } catch (error) {
      setMessage(String(error))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="space-y-6">
        <PageTitle title="Configuraciones" subtitle="Bloquea horarios, gestiona servicios y materiales" />
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Cargando configuraciones…</div>
      </div>
    )
  }

  const updateBlockedDay = (day: string) => {
    const blockedDays = new Set(settings.blockedDays ?? [])
    if (blockedDays.has(day)) blockedDays.delete(day)
    else blockedDays.add(day)
    setSettings({ ...settings, blockedDays: Array.from(blockedDays) })
  }

  const updateBlockedHour = (hour: string) => {
    const blockedHours = new Set(settings.blockedHours ?? [])
    if (blockedHours.has(hour)) blockedHours.delete(hour)
    else blockedHours.add(hour)
    setSettings({ ...settings, blockedHours: Array.from(blockedHours) })
  }

  const updateMaxRequestsPerSlot = (value: number) => {
    const nextValue = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
    setSettings({ ...settings, maxRequestsPerSlot: nextValue })
  }

  const updateMaxAdvanceDays = (value: number) => {
    const nextValue = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
    setSettings({ ...settings, maxAdvanceDays: nextValue })
  }

  const updateMinAdvanceDays = (value: number) => {
    const nextValue = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
    setSettings({ ...settings, minAdvanceDays: nextValue })
  }

  const updateServiceField = (index: number, field: string, value: string | number | boolean) => {
    const services = [...(settings.services ?? [])]
    services[index] = { ...services[index], [field]: value }
    setSettings({ ...settings, services })
  }

  const addService = () => {
    setSettings({
      ...settings,
      services: [...(settings.services ?? []), { id: `nuevo-${Date.now()}`, name: 'Nuevo servicio', short: 'Nuevo', description: '', from: 0, visitPrice: 12000, hours: 1, markupPercent: 0, ivaPercent: 19, emergency: false }],
    })
  }

  const removeService = (index: number) => {
    const services = [...(settings.services ?? [])]
    services.splice(index, 1)
    setSettings({ ...settings, services })
  }

  const updateMaterialField = (index: number, field: string, value: string | number) => {
    const materials = [...(settings.materials ?? [])]
    materials[index] = { ...materials[index], [field]: value }
    setSettings({ ...settings, materials })
  }

  const applyGlobalMarkup = () => {
    const nextMarkup = Number(globalMarkup)
    if (!Number.isFinite(nextMarkup) || nextMarkup < 0) {
      setMessage('Ingresa una ganancia válida igual o mayor a 0%.')
      return
    }

    const materials = (settings.materials ?? []).map((material: any) => ({
      ...material,
      markupPercent: nextMarkup,
    }))
    setSettings({ ...settings, materials })
    setShowGlobalMarkup(false)
    setMessage(`Ganancia actualizada en ${materials.length} materiales. Guarda la configuración para confirmar.`)
  }

  const addMaterial = () => {
    const usedCodes = new Set((settings.materials ?? []).map((material: any) => String(material.internalCode ?? '').toUpperCase()))
    let nextCodeNumber = (settings.materials ?? []).length + 1
    let internalCode = `MAT-${String(nextCodeNumber).padStart(4, '0')}`
    while (usedCodes.has(internalCode)) {
      nextCodeNumber += 1
      internalCode = `MAT-${String(nextCodeNumber).padStart(4, '0')}`
    }

    setSettings({
      ...settings,
      materials: [...(settings.materials ?? []), { id: `material-${Date.now()}`, name: 'Nuevo material', category: 'Otros', price: 0, stock: 0, markupPercent: 0, ivaPercent: 19, provider: '', internalCode, purchaseUrl: '' }],
    })
  }

  const removeMaterial = (index: number) => {
    const materials = [...(settings.materials ?? [])]
    materials.splice(index, 1)
    setSettings({ ...settings, materials })
  }

  const materialCategories = Array.from(new Set((settings?.materials ?? []).map((material: any) => material.category || 'Otros'))).sort()
  const visibleMaterials = (settings?.materials ?? [])
    .map((material: any, index: number) => ({ material, index }))
    .filter(({ material }: { material: any }) => materialCategory === 'Todos' || (material.category || 'Otros') === materialCategory)

  const updatePromotionField = (index: number, field: string, value: string | number | boolean | string[]) => {
    const promotions = [...(settings.promotions ?? [])]
    promotions[index] = { ...promotions[index], [field]: value }
    setSettings({ ...settings, promotions })
  }

  const togglePromotionService = (index: number, serviceId: string) => {
    const promotions = [...(settings.promotions ?? [])]
    const promotion = promotions[index] || { serviceIds: [] }
    const serviceIds = new Set(promotion.serviceIds ?? [])
    if (serviceIds.has(serviceId)) serviceIds.delete(serviceId)
    else serviceIds.add(serviceId)
    promotions[index] = { ...promotion, serviceIds: Array.from(serviceIds) }
    setSettings({ ...settings, promotions })
  }

  const addPromotion = () => {
    setSettings({
      ...settings,
      promotions: [
        ...(settings.promotions ?? []),
        {
          id: `promo-${Date.now()}`,
          name: 'Nueva campaña',
          description: '',
          active: true,
          applyTo: 'total',
          discountType: 'percent',
          discountValue: 10,
          serviceIds: [],
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      ],
    })
  }

  const removePromotion = (index: number) => {
    const promotions = [...(settings.promotions ?? [])]
    promotions.splice(index, 1)
    setSettings({ ...settings, promotions })
  }

  const ORDER_CHECKLIST_ID = '__order__'

  const updateChecklist = (serviceId: string, items: any[]) => {
    const checklists = { ...(settings.checklists ?? {}) }
    checklists[serviceId] = items
    setSettings({ ...settings, checklists })
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Configuraciones" subtitle="Bloquea horarios, gestiona servicios y materiales" />
      {message ? <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">{message}</div> : null}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'agenda', label: 'Agenda' },
            { id: 'servicios', label: 'Servicios' },
            { id: 'checklists', label: 'Checklists' },
            { id: 'materiales', label: 'Materiales' },
            { id: 'promociones', label: 'Promociones' },
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setConfigTab(tabItem.id as typeof configTab)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                configTab === tabItem.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-background text-muted-foreground hover:bg-secondary/80',
              )}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
        <div className="space-y-6">
          {configTab === 'agenda' && (
            <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Bloqueo de agenda</h2>
                <p className="text-sm text-muted-foreground">Marca días y horas que no estarán disponibles para clientes y ajusta la capacidad por franja horaria.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Días bloqueados</p>
                <div className="flex flex-wrap gap-2">
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => {
                    const active = (settings.blockedDays ?? []).includes(day)
                    return (
                      <button key={day} onClick={() => updateBlockedDay(day)} className={cn('rounded-full border px-3 py-1.5 text-sm', active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Horas bloqueadas</p>
                <div className="flex flex-wrap gap-2">
                  {['09:00', '11:00', '13:00', '15:30', '17:00', '19:00'].map((hour) => {
                    const active = (settings.blockedHours ?? []).includes(hour)
                    return (
                      <button key={hour} onClick={() => updateBlockedHour(hour)} className={cn('rounded-full border px-3 py-1.5 text-sm', active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                        {hour}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-background/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Capacidad máxima por franja</p>
                    <p className="text-xs text-muted-foreground">Número de solicitudes permitidas en un mismo día y hora.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateMaxRequestsPerSlot((Number(settings.maxRequestsPerSlot ?? 3)) - 1)} className="rounded-lg border border-border px-2 py-1 text-sm">−</button>
                    <input type="number" min={1} value={Number(settings.maxRequestsPerSlot ?? 3)} onChange={(e) => updateMaxRequestsPerSlot(Number(e.target.value))} className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <button type="button" onClick={() => updateMaxRequestsPerSlot((Number(settings.maxRequestsPerSlot ?? 3)) + 1)} className="rounded-lg border border-border px-2 py-1 text-sm">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Antelación máxima</p>
                    <p className="text-xs text-muted-foreground">Cuántos días hacia adelante pueden agendarse solicitudes.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateMaxAdvanceDays((Number(settings.maxAdvanceDays ?? 3)) - 1)} className="rounded-lg border border-border px-2 py-1 text-sm">−</button>
                    <input type="number" min={0} value={Number(settings.maxAdvanceDays ?? 3)} onChange={(e) => updateMaxAdvanceDays(Number(e.target.value))} className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <button type="button" onClick={() => updateMaxAdvanceDays((Number(settings.maxAdvanceDays ?? 3)) + 1)} className="rounded-lg border border-border px-2 py-1 text-sm">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Antelación mínima</p>
                    <p className="text-xs text-muted-foreground">Días mínimos de anticipación para que el cliente pueda reservar.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateMinAdvanceDays((Number(settings.minAdvanceDays ?? 1)) - 1)} className="rounded-lg border border-border px-2 py-1 text-sm">−</button>
                    <input type="number" min={0} value={Number(settings.minAdvanceDays ?? 1)} onChange={(e) => updateMinAdvanceDays(Number(e.target.value))} className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <button type="button" onClick={() => updateMinAdvanceDays((Number(settings.minAdvanceDays ?? 1)) + 1)} className="rounded-lg border border-border px-2 py-1 text-sm">+</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          )}

          {configTab === 'servicios' && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Servicios</h2>
                <p className="text-sm text-muted-foreground">Modifica nombre, precio base y descripción de cada servicio.</p>
              </div>
              <button onClick={addService} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
                <Plus className="size-4" /> Agregar
              </button>
            </div>
            <div className="space-y-3">
              {(settings.services ?? []).map((service: any, index: number) => (
                <div key={service.id || index} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input value={service.name || ''} onChange={(e) => updateServiceField(index, 'name', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <button onClick={() => removeService(index)} className="rounded-lg border border-destructive/20 p-2 text-destructive"><Trash2 className="size-4" /></button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-5">
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Nombre corto</span>
                      <input value={service.short || ''} onChange={(e) => updateServiceField(index, 'short', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Precio base</span>
                      <input type="number" value={service.from ?? 0} onChange={(e) => updateServiceField(index, 'from', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Precio visita</span>
                      <input type="number" value={service.visitPrice ?? 12000} onChange={(e) => updateServiceField(index, 'visitPrice', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Horas</span>
                      <input type="number" step="0.5" value={service.hours ?? 1} onChange={(e) => updateServiceField(index, 'hours', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Ganancia %</span>
                      <input type="number" value={service.markupPercent ?? 0} onChange={(e) => updateServiceField(index, 'markupPercent', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">IVA %</span>
                      <input type="number" step="0.1" value={service.ivaPercent ?? 19} onChange={(e) => updateServiceField(index, 'ivaPercent', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                  </div>
                  <label className="mt-3 block text-sm">
                    <span className="mb-1 block text-muted-foreground">Descripción</span>
                    <textarea value={service.description || ''} onChange={(e) => updateServiceField(index, 'description', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} />
                  </label>
                  <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={!!service.emergency} onChange={(e) => updateServiceField(index, 'emergency', e.target.checked)} />
                    Disponible como emergencia
                  </label>
                </div>
              ))}
            </div>
          </section>
          )}
          {configTab === 'checklists' && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Checklists</h2>
                <p className="text-sm text-muted-foreground">Administra el checklist global de orden y los checklists específicos de cada servicio desde un mismo lugar.</p>
              </div>
            </div>
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Checklist de orden general</p>
                    <p className="mt-1 text-sm text-muted-foreground">Items que aplican a todas las órdenes, además del checklist específico por servicio.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingChecklistServiceId(ORDER_CHECKLIST_ID)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80"
                  >
                    Editar checklist
                  </button>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{(settings.orderChecklist ?? []).length} item(s) configurados.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                  {(settings.services ?? []).map((service: any) => {
                    const rawChecklist = settings.checklists?.[service.id]
                    const serviceChecklistItems = Array.isArray(rawChecklist)
                      ? rawChecklist
                      : rawChecklist?.checklist ?? rawChecklist?.verifications ?? []
                  return (
                    <div key={service.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{service.name || service.short || service.id}</p>
                          <p className="text-xs text-muted-foreground">{service.short || service.description || 'Servicio sin descripción'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingChecklistServiceId(service.id)}
                          className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          Editar checklist
                        </button>
                      </div>
                      <div className="mt-4 rounded-2xl border border-border bg-card p-3">
                        <p className="text-xs font-semibold text-muted-foreground">Checklist configurado</p>
                        {serviceChecklistItems.length ? (
                          <div className="mt-2 space-y-1 text-sm text-foreground">
                            {serviceChecklistItems.slice(0, 3).map((item: any, idx: number) => (
                              <p key={item.id || idx} className="truncate text-sm">• {item.text || 'Item sin texto'}</p>
                            ))}
                            {serviceChecklistItems.length > 3 && (
                              <p className="text-xs text-muted-foreground">...y {serviceChecklistItems.length - 3} más</p>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">No hay checklist configurado para este servicio.</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
          )}
        </div>

        {configTab === 'materiales' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Materiales</h2>
                <p className="text-sm text-muted-foreground">Administra catálogo de materiales y stock disponible.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGlobalMarkup((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
                >
                  <DollarSign className="size-4" /> Ganancia general
                </button>
                <button onClick={addMaterial} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
                  <Plus className="size-4" /> Agregar
                </button>
              </div>
            </div>
            {showGlobalMarkup && (
              <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Modificar ganancia de todos los materiales</p>
                  <p className="mt-1 text-xs text-muted-foreground">Este porcentaje reemplazará la ganancia individual del catálogo completo.</p>
                </div>
                <div className="flex items-end gap-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-muted-foreground">Ganancia %</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={globalMarkup}
                      onChange={(event) => setGlobalMarkup(event.target.value)}
                      className="h-9 w-24 rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                  <button type="button" onClick={applyGlobalMarkup} className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                    Aplicar a todos
                  </button>
                </div>
              </div>
            )}
            <div className="mb-4 flex gap-2 overflow-x-auto border-b border-border pb-2">
              {['Todos', ...materialCategories].map((category) => {
                const count = category === 'Todos'
                  ? (settings.materials ?? []).length
                  : (settings.materials ?? []).filter((material: any) => (material.category || 'Otros') === category).length
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setMaterialCategory(category)}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      materialCategory === category ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {category}<span className="rounded-full bg-background/30 px-1.5 py-0.5 text-[10px]">{count}</span>
                  </button>
                )
              })}
            </div>
            <div className="space-y-3">
              {visibleMaterials.map(({ material, index }: { material: any; index: number }) => (
                <div key={material.id || index} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input value={material.name || ''} onChange={(e) => updateMaterialField(index, 'name', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    <button onClick={() => removeMaterial(index)} className="rounded-lg border border-destructive/20 p-2 text-destructive"><Trash2 className="size-4" /></button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-6">
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Precio</span>
                      <input type="number" value={material.price ?? 0} onChange={(e) => updateMaterialField(index, 'price', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Stock</span>
                      <input type="number" value={material.stock ?? 0} onChange={(e) => updateMaterialField(index, 'stock', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Ganancia %</span>
                      <input type="number" value={material.markupPercent ?? 0} onChange={(e) => updateMaterialField(index, 'markupPercent', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">IVA %</span>
                      <input type="number" step="0.1" value={material.ivaPercent ?? 19} onChange={(e) => updateMaterialField(index, 'ivaPercent', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Proveedor</span>
                      <input value={material.provider ?? ''} onChange={(e) => updateMaterialField(index, 'provider', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Código interno</span>
                      <input value={material.internalCode ?? ''} onChange={(e) => updateMaterialField(index, 'internalCode', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Categoría</span>
                      <input value={material.category ?? 'Otros'} onChange={(e) => updateMaterialField(index, 'category', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm md:col-span-2">
                      <span className="mb-1 block text-muted-foreground">Link de compra</span>
                      <input
                        type="url"
                        value={material.purchaseUrl ?? ''}
                        onChange={(e) => updateMaterialField(index, 'purchaseUrl', e.target.value)}
                        placeholder="https://tienda.example/material"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
        )}

        {configTab === 'promociones' && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Promociones</h2>
              <p className="text-sm text-muted-foreground">Crea campañas con fechas, alcance y descuentos aplicables a servicios o totales.</p>
            </div>
            <button onClick={addPromotion} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
              <Plus className="size-4" /> Agregar
            </button>
          </div>
          <div className="space-y-4">
            {(settings.promotions ?? []).map((promotion: any, index: number) => (
              <div key={promotion.id || index} className="rounded-2xl border border-border bg-background p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-[220px] flex-1">
                    <input
                      value={promotion.name || ''}
                      onChange={(e) => updatePromotionField(index, 'name', e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                      placeholder="Título de la campaña"
                    />
                  </div>
                  <button onClick={() => removePromotion(index)} className="rounded-lg border border-destructive/20 px-3 py-1.5 text-sm text-destructive">Eliminar</button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-muted-foreground">Descripción</span>
                    <textarea
                      value={promotion.description || ''}
                      onChange={(e) => updatePromotionField(index, 'description', e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                      rows={2}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!promotion.active}
                      onChange={(e) => updatePromotionField(index, 'active', e.target.checked)}
                    />
                    Activa
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="text-sm">
                    <span className="mb-1 block text-muted-foreground">Aplicar a</span>
                    <select
                      value={promotion.applyTo || 'total'}
                      onChange={(e) => updatePromotionField(index, 'applyTo', e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="total">Total</option>
                      <option value="service">Servicios específicos</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-muted-foreground">Tipo de descuento</span>
                    <select
                      value={promotion.discountType || 'percent'}
                      onChange={(e) => updatePromotionField(index, 'discountType', e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="percent">Porcentaje</option>
                      <option value="fixed">Monto fijo</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-muted-foreground">Valor</span>
                    <input
                      type="number"
                      value={promotion.discountValue ?? 0}
                      onChange={(e) => updatePromotionField(index, 'discountValue', Number(e.target.value))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-muted-foreground">Vigencia desde</span>
                    <input
                      type="date"
                      value={promotion.startDate || ''}
                      onChange={(e) => updatePromotionField(index, 'startDate', e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-muted-foreground">Vigencia hasta</span>
                    <input
                      type="date"
                      value={promotion.endDate || ''}
                      onChange={(e) => updatePromotionField(index, 'endDate', e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                {promotion.applyTo === 'service' ? (
                  <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <p className="mb-2 text-sm font-medium">Servicios aplicables</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(settings.services ?? []).map((service: any) => (
                        <label key={service.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Array.isArray(promotion.serviceIds) && promotion.serviceIds.includes(service.id)}
                            onChange={() => togglePromotionService(index, service.id)}
                          />
                          <span>{service.name || service.short || service.id}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">Esta campaña solo se aplicará cuando la fecha actual esté entre inicio y fin. Para servicios específicos, marque los servicios correspondientes.</p>
              </div>
            ))}
          </div>
        </section>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={saveSettings} disabled={saving} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {editingChecklistServiceId && (
        <ChecklistEditor
          key={editingChecklistServiceId}
          serviceId={editingChecklistServiceId}
          serviceName={
            editingChecklistServiceId === ORDER_CHECKLIST_ID
              ? 'Orden general'
              : (settings.services ?? []).find((s: any) => s.id === editingChecklistServiceId)?.name || 'Servicio'
          }
          items={
            // verifications (what the technician will mark in the order)
            Array.isArray(settings.checklists?.[editingChecklistServiceId])
              ? settings.checklists[editingChecklistServiceId]
              : settings.checklists?.[editingChecklistServiceId]?.verifications ?? (serviceChecklists as any)[editingChecklistServiceId]?.map((text: string, idx: number) => ({
                  id: `default-${editingChecklistServiceId}-${idx}`,
                  text,
                  required: false,
                  materials: [],
                  evidence: { photosBefore: false, photosAfter: false, measurements: false },
                })) ?? []
          }
          serviceChecklistItems={
            // separate checklist por servicio (admin-visible checklist)
            Array.isArray(settings.checklists?.[editingChecklistServiceId])
              ? []
              : settings.checklists?.[editingChecklistServiceId]?.checklist ?? []
          }
          orderItems={settings.orderChecklist ?? []}
          blockedItems={settings.blockedRequestsChecklist ?? []}
          serviceMaterials={
            editingChecklistServiceId === ORDER_CHECKLIST_ID
              ? []
              : (settings.services ?? []).find((s: any) => s.id === editingChecklistServiceId)?.materials ?? []
          }
          settingsMaterials={settings.materials ?? []}
          onSave={(payload: any) => {
            const nextSettings = { ...settings }
            nextSettings.orderChecklist = payload.orderChecklistItems
            nextSettings.blockedRequestsChecklist = payload.blockedChecklistItems
            const prev = settings.checklists ?? {}
            if (editingChecklistServiceId === ORDER_CHECKLIST_ID) {
              nextSettings.checklists = prev
            } else {
              // store both arrays under the service id for explicit separation
              nextSettings.checklists = {
                ...prev,
                [editingChecklistServiceId]: {
                  checklist: payload.serviceChecklistItems ?? [],
                  verifications: payload.items ?? [],
                },
              }
            }
            if (editingChecklistServiceId !== ORDER_CHECKLIST_ID) {
              const svcIndex = (settings.services ?? []).findIndex((s: any) => s.id === editingChecklistServiceId)
              if (svcIndex >= 0) {
                const nextServices = [...(settings.services ?? [])]
                nextServices[svcIndex] = {
                  ...nextServices[svcIndex],
                  materials: payload.serviceMaterials,
                }
                nextSettings.services = nextServices
              }
            }
            setSettings(nextSettings)
            setEditingChecklistServiceId(null)
          }}
          onClose={() => setEditingChecklistServiceId(null)}
        />
      )}
    </div>
  )
}

function ChecklistEditor({
  serviceId,
  serviceName,
  items,
  orderItems,
  blockedItems,
  serviceMaterials,
  settingsMaterials,
  serviceChecklistItems,
  onSave,
  onClose,
}: {
  serviceId: string
  serviceName: string
  items: any[]
  orderItems: any[]
  blockedItems: any[]
  serviceMaterials: any[]
  settingsMaterials: any[]
  serviceChecklistItems?: any[]
  onSave: (payload: { items: any[]; orderChecklistItems: any[]; blockedChecklistItems: any[]; serviceMaterials: any[]; serviceChecklistItems?: any[] }) => void
  onClose: () => void
}) {
  const isOrderEditor = serviceId === '__order__'
  const [localItems, setLocalItems] = useState(() => (
    isOrderEditor
      ? []
      : (items ?? []).map((it: any, idx: number) => ({
          id: typeof it === 'string' ? `item-${serviceId}-${idx}` : String(it.id ?? `item-${serviceId}-${idx}`),
          text: typeof it === 'string' ? it : it.text || '',
          required: typeof it === 'string' ? false : !!it.required,
          type: typeof it === 'string' ? 'comprobacion' : it.type || 'comprobacion',
          materials: Array.isArray(it.materials) ? it.materials : [],
          evidence: (typeof it === 'string' ? undefined : it.evidence) || { photosBefore: false, photosAfter: false, measurements: false },
        }))
  ))
  const [localOrderItems, setLocalOrderItems] = useState(() => (
    (orderItems ?? []).map((it: any, idx: number) => ({
      id: String(it.id ?? `order-${serviceId}-${idx}`),
      text: it.text || '',
      required: !!it.required,
    }))
  ))
  const [localBlockedItems, setLocalBlockedItems] = useState(() => (
    (blockedItems ?? []).map((it: any, idx: number) => ({
      id: String(it.id ?? `blocked-${serviceId}-${idx}`),
      text: it.text || '',
      required: !!it.required,
    }))
  ))
  const modalContentRef = useRef<HTMLDivElement | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const [addingMaterialFor, setAddingMaterialFor] = useState<string | null>(null)
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1)
  const [localServiceMaterials, setLocalServiceMaterials] = useState(() => (Array.isArray(serviceMaterials) ? serviceMaterials.map((m: any) => ({ ...m })) : []))
  const [localServiceChecklist, setLocalServiceChecklist] = useState(() => (
    (serviceChecklistItems ?? []).map((it: any, idx: number) => ({ id: String(it.id ?? `svc-${idx}`), text: it.text || it || '', required: !!it.required }))
  ))

  const serviceChecklistPreview = (!isOrderEditor ? (items ?? []).map((it: any, idx: number) => ({
    id: typeof it === 'string' ? `default-${serviceId}-${idx}` : String(it.id ?? `default-${serviceId}-${idx}`),
    text: typeof it === 'string' ? it : it.text || '',
  })) : [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const addItem = (text?: string) => {
    const nextText = text !== undefined ? text : newItemText.trim()
    setLocalItems([
      ...localItems,
      {
        id: `item-${Date.now()}`,
        text: nextText || 'Nueva verificación',
        required: true,
        type: 'comprobacion',
        materials: [],
        evidence: { photosBefore: false, photosAfter: false, measurements: false },
      },
    ])
    if (nextText) {
      setNewItemText('')
    }
  }

  const addServiceChecklistItem = (text?: string) => {
    const nextText = text !== undefined ? text : 'Nuevo item'
    setLocalServiceChecklist([
      ...localServiceChecklist,
      { id: `svc-${Date.now()}`, text: nextText, required: true },
    ])
  }

  const updateServiceChecklistItem = (id: string, text: string) => {
    setLocalServiceChecklist(localServiceChecklist.map((it) => (it.id === id ? { ...it, text } : it)))
  }

  const removeServiceChecklistItem = (id: string) => {
    setLocalServiceChecklist(localServiceChecklist.filter((it) => it.id !== id))
  }

  const updateItem = (id: string, text: string) => {
    setLocalItems(localItems.map((item) => (item.id === id ? { ...item, text } : item)))
  }

  const updateItemType = (id: string, type: string) => {
    setLocalItems(localItems.map((item) => (item.id === id ? { ...item, type } : item)))
  }

  const removeItem = (id: string) => {
    setLocalItems(localItems.filter((item) => item.id !== id))
  }

  const toggleRequired = (id: string) => {
    setLocalItems(localItems.map((item) => (item.id === id ? { ...item, required: !item.required } : item)))
  }

  const addOrderItem = (text?: string) => {
    const nextText = text !== undefined ? text : 'Nuevo item de orden'
    setLocalOrderItems([
      ...localOrderItems,
      { id: `order-item-${Date.now()}`, text: nextText, required: true },
    ])
  }

  const updateOrderItem = (id: string, text: string) => {
    setLocalOrderItems(localOrderItems.map((item) => (item.id === id ? { ...item, text } : item)))
  }

  const removeOrderItem = (id: string) => {
    setLocalOrderItems(localOrderItems.filter((item) => item.id !== id))
  }

  const addBlockedItem = (text?: string) => {
    const nextText = text !== undefined ? text : 'Nuevo item para solicitudes bloqueadas'
    setLocalBlockedItems([
      ...localBlockedItems,
      { id: `blocked-item-${Date.now()}`, text: nextText, required: true },
    ])
  }

  const updateBlockedItem = (id: string, text: string) => {
    setLocalBlockedItems(localBlockedItems.map((item) => (item.id === id ? { ...item, text } : item)))
  }

  const removeBlockedItem = (id: string) => {
    setLocalBlockedItems(localBlockedItems.filter((item) => item.id !== id))
  }

  const startAddMaterial = (itemId: string) => {
    setAddingMaterialFor(itemId)
    setSelectedMaterialId(settingsMaterials?.[0]?.id ?? null)
    setSelectedQuantity(1)
  }

  const confirmAddMaterial = () => {
    if (!addingMaterialFor || !selectedMaterialId) return
    const mat = settingsMaterials.find((m: any) => String(m.id) === String(selectedMaterialId))
    if (!mat) return
    setLocalItems(localItems.map((it) => {
      if (it.id !== addingMaterialFor) return it
      const existing = Array.isArray(it.materials) ? [...it.materials] : []
      existing.push({ id: mat.id, name: mat.name, quantity: Number(selectedQuantity) || 1 })
      return { ...it, materials: existing }
    }))
    setAddingMaterialFor(null)
  }

  const startAddServiceMaterial = () => {
    setSelectedMaterialId(settingsMaterials?.[0]?.id ?? null)
    setSelectedQuantity(1)
  }

  const confirmAddServiceMaterial = () => {
    if (!selectedMaterialId) return
    const mat = settingsMaterials.find((m: any) => String(m.id) === String(selectedMaterialId))
    if (!mat) return
    setLocalServiceMaterials([...localServiceMaterials, { id: mat.id, name: mat.name, quantity: Number(selectedQuantity) || 1 }])
  }

  const updateServiceMaterialQty = (index: number, qty: number) => {
    setLocalServiceMaterials(localServiceMaterials.map((m: any, i: number) => (i === index ? { ...m, quantity: Number(qty) || 0 } : m)))
  }

  const removeServiceMaterial = (index: number) => {
    setLocalServiceMaterials(localServiceMaterials.filter((_: any, i: number) => i !== index))
  }

  const updateMaterialQuantity = (itemId: string, materialIndex: number, qty: number) => {
    setLocalItems(localItems.map((it) => {
      if (it.id !== itemId) return it
      const materials = (it.materials ?? []).map((m: any, idx: number) => idx === materialIndex ? { ...m, quantity: Number(qty) || 0 } : m)
      return { ...it, materials }
    }))
  }

  const removeMaterialFromItem = (itemId: string, materialIndex: number) => {
    setLocalItems(localItems.map((it) => {
      if (it.id !== itemId) return it
      const materials = (it.materials ?? []).filter((_: any, idx: number) => idx !== materialIndex)
      return { ...it, materials }
    }))
  }

  const toggleEvidence = (itemId: string, field: string) => {
    setLocalItems(localItems.map((it) => {
      if (it.id !== itemId) return it
      return { ...it, evidence: { ...(it.evidence || {}), [field]: !Boolean(it.evidence?.[field]) } }
    }))
  }

  return (
    <div
      onClick={onClose}
      onWheel={(e: any) => {
        if (e.target !== e.currentTarget) return
        const el = modalContentRef.current
        if (el && el.scrollHeight > el.clientHeight) {
          el.scrollBy({ top: e.deltaY, behavior: 'auto' })
          e.preventDefault()
        }
      }}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-4 sm:py-6"
      role="dialog"
      aria-modal="true"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full h-full max-w-[calc(100vw-2rem)] sm:max-w-5xl max-h-[calc(100vh-2rem)] rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6 sm:py-5">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">Checklist: {serviceName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Personaliza los items que debe verificar el técnico; adjunta materiales y requisitos de evidencia si aplica.</p>
            </div>
            <button onClick={onClose} aria-label="Cerrar checklist" className="rounded-full p-2 text-muted-foreground transition hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>

          <div ref={modalContentRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6" style={{ overscrollBehavior: 'contain', touchAction: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div className="grid grid-cols-1 gap-5">
              {!isOrderEditor ? (
                <div className="min-w-0 space-y-5">
                  <div className="rounded-3xl border border-border bg-background p-4 sm:p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium">Materiales del servicio</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={startAddServiceMaterial} type="button" className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">Agregar material</button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(localServiceMaterials ?? []).map((m: any, idx: number) => (
                          <div key={idx} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{m.name}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="text-sm text-muted-foreground">Cantidad</label>
                              <input type="number" min={0} value={m.quantity ?? 0} onChange={(e) => updateServiceMaterialQty(idx, Number(e.target.value))} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm" />
                              <button onClick={() => removeServiceMaterial(idx)} className="rounded-lg border border-destructive/20 p-1 text-destructive"><Trash2 className="size-4" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {settingsMaterials?.length ? (
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <select value={selectedMaterialId ?? ''} onChange={(e) => setSelectedMaterialId(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                            {(settingsMaterials ?? []).map((mat: any) => (
                              <option key={mat.id} value={mat.id}>{mat.name}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2">
                            <input type="number" min={1} value={selectedQuantity} onChange={(e) => setSelectedQuantity(Number(e.target.value))} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm" />
                            <button onClick={confirmAddServiceMaterial} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Agregar</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-background p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">Evidencia</p>
                        <p className="mt-1 text-xs text-muted-foreground">Define cuadros de evidencia que el técnico deberá completar (mediciones, observaciones, fotos).</p>
                      </div>
                      <button onClick={() => addServiceChecklistItem()} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">Agregar caja de evidencia</button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {localServiceChecklist.length ? localServiceChecklist.map((item) => (
                        <div key={item.id} className="rounded-3xl border border-border bg-card p-4">
                          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <label className="flex items-center gap-2">
                                  <input type="checkbox" checked={item.required} onChange={() => setLocalServiceChecklist(localServiceChecklist.map((it) => (it.id === item.id ? { ...it, required: !it.required } : it)))} className="mt-1" />
                                  <span className="text-sm font-medium">Obligatorio</span>
                                </label>
                                <input
                                  type="text"
                                  value={item.text}
                                  onChange={(e) => updateServiceChecklistItem(item.id, e.target.value)}
                                  className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                            </div>
                            <button onClick={() => removeServiceChecklistItem(item.id)} className="self-start rounded-lg border border-destructive/20 p-2 text-destructive">
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">No hay items configurados para las verificaciones del servicio.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-background p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">Checklist por servicio</p>
                        <p className="mt-1 text-xs text-muted-foreground">Items del checklist específicos del servicio (separado de las verificaciones que marca el técnico).</p>
                      </div>
                      <button onClick={addItem} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">Agregar verificación</button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {(localItems.length ? localItems : serviceChecklistPreview).map((item) => (
                        <div key={item.id} className="rounded-3xl border border-border bg-card p-4">
                          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <label className="flex items-center gap-2">
                                  <input type="checkbox" checked={item.required} onChange={() => toggleRequired(item.id)} className="mt-1" />
                                  <span className="text-sm font-medium">Obligatorio</span>
                                </label>
                                <input
                                  type="text"
                                  value={item.text}
                                  onChange={(e) => updateItem(item.id, e.target.value)}
                                  className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="text-sm text-muted-foreground">Tipo</label>
                                <select
                                  value={item.type || 'comprobacion'}
                                  onChange={(e) => updateItemType(item.id, e.target.value)}
                                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                >
                                  <option value="comprobacion">Comprobación</option>
                                  <option value="medicion">Medición</option>
                                </select>
                              </div>
                            </div>
                            <button onClick={() => removeItem(item.id)} className="self-start rounded-lg border border-destructive/20 p-2 text-destructive">
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border bg-background p-3">
                              <p className="text-xs text-muted-foreground">Materiales requeridos</p>
                              <div className="mt-3 space-y-3">
                                {(item.materials ?? []).map((m: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</p>
                                    <input type="number" min={0} value={m.quantity ?? 0} onChange={(e) => updateMaterialQuantity(item.id, idx, Number(e.target.value))} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm" />
                                    <button onClick={() => removeMaterialFromItem(item.id, idx)} className="rounded-lg border border-destructive/20 p-1 text-destructive"><Trash2 className="size-4" /></button>
                                  </div>
                                ))}
                                {addingMaterialFor === item.id ? (
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <select value={selectedMaterialId ?? ''} onChange={(e) => setSelectedMaterialId(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                      {(settingsMaterials ?? []).map((mat: any) => (
                                        <option key={mat.id} value={mat.id}>{mat.name}</option>
                                      ))}
                                    </select>
                                    <input type="number" min={1} value={selectedQuantity} onChange={(e) => setSelectedQuantity(Number(e.target.value))} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm" />
                                    <button onClick={confirmAddMaterial} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Agregar</button>
                                    <button onClick={() => setAddingMaterialFor(null)} className="rounded-lg border border-border px-3 py-2 text-sm">Cancelar</button>
                                  </div>
                                ) : (
                                  <button onClick={() => startAddMaterial(item.id)} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">Agregar material</button>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-border bg-background p-3">
                              <p className="text-xs text-muted-foreground">Evidencia requerida</p>
                              <div className="mt-3 space-y-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={!!item.evidence?.photosBefore} onChange={() => toggleEvidence(item.id, 'photosBefore')} /> Fotos antes
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={!!item.evidence?.photosAfter} onChange={() => toggleEvidence(item.id, 'photosAfter')} /> Fotos después
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={!!item.evidence?.measurements} onChange={() => toggleEvidence(item.id, 'measurements')} /> Mediciones
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={`${isOrderEditor ? '' : 'xl:mt-0'} min-w-0 rounded-3xl border border-border bg-background p-4 sm:p-5`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Checklist de orden</p>
                    <p className="mt-1 text-xs text-muted-foreground">Items generales que aplican a toda la orden, aparte de las verificaciones por servicio.</p>
                  </div>
                  <button onClick={addOrderItem} type="button" className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">Agregar item</button>
                </div>

                <div className="mt-4 space-y-4">
                  {localOrderItems.length ? localOrderItems.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-border bg-card p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={item.required} onChange={() => {
                                setLocalOrderItems(localOrderItems.map((orderItem) => (orderItem.id === item.id ? { ...orderItem, required: !orderItem.required } : orderItem)))
                              }} className="mt-1" />
                              <span className="text-sm font-medium">Obligatorio</span>
                            </label>
                            <input
                              type="text"
                              value={item.text}
                              onChange={(e) => updateOrderItem(item.id, e.target.value)}
                              className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>
                        <button onClick={() => removeOrderItem(item.id)} className="self-start rounded-lg border border-destructive/20 p-2 text-destructive">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No hay items en el checklist de orden.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-background p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Checklist para solicitudes bloqueadas</p>
                    <p className="mt-1 text-xs text-muted-foreground">Items adicionales que aplican cuando la solicitud queda bloqueada por revisión o falta de datos.</p>
                  </div>
                  <button onClick={addBlockedItem} type="button" className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">Agregar item</button>
                </div>

                <div className="mt-4 space-y-4">
                  {localBlockedItems.length ? localBlockedItems.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-border bg-card p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={item.required} onChange={() => {
                                setLocalBlockedItems(localBlockedItems.map((blockedItem) => (blockedItem.id === item.id ? { ...blockedItem, required: !blockedItem.required } : blockedItem)))
                              }} className="mt-1" />
                              <span className="text-sm font-medium">Obligatorio</span>
                            </label>
                            <input
                              type="text"
                              value={item.text}
                              onChange={(e) => updateBlockedItem(item.id, e.target.value)}
                              className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>
                        <button onClick={() => removeBlockedItem(item.id)} className="self-start rounded-lg border border-destructive/20 p-2 text-destructive">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No hay items en el checklist para solicitudes bloqueadas.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-card/95 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={() => onSave({ items: localItems, orderChecklistItems: localOrderItems, blockedChecklistItems: localBlockedItems, serviceMaterials: localServiceMaterials, serviceChecklistItems: localServiceChecklist })}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Guardar checklist
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminProfilePanel({
  user,
  stats,
  onClose,
  onLogout,
}: {
  user: { name?: string; email?: string; role?: string }
  stats: { openOrders: number; activeClients: number; onlineTechnicians: number }
  onClose: () => void
  onLogout: () => Promise<void>
}) {
  const statsData = [
    { label: 'Órdenes abiertas', value: String(stats.openOrders) },
    { label: 'Clientes activos', value: String(stats.activeClients) },
    { label: 'Técnicos online', value: String(stats.onlineTechnicians) },
  ]

  return (
    <div className="fixed right-4 top-24 z-50 w-[320px] rounded-3xl border border-border bg-card p-4 shadow-2xl">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <span className="text-lg font-semibold">{user.name?.[0] ?? 'A'}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Administrador</p>
          <p className="text-lg font-semibold leading-tight">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-3xl bg-background/80 p-4 text-sm text-muted-foreground">
        {statsData.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-card p-3 text-sm">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90"
        >
          <LogIn className="size-4" /> Cerrar sesión
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary/50"
        >
          Cerrar ventana
        </button>
      </div>
    </div>
  )
}
