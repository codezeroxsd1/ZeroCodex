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
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/logo'
import { StatusBadge } from '@/components/status-badge'
import { RevenueChart, JobsChart, SegmentsChart, getStatusBucket } from './charts'
import { formatCLP, getFriendlyServiceName, serviceChecklists, getApplicablePromotions, computeBestPromotionDiscount, applyPromotionToAmount } from '@/lib/data'
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

const requestStatuses = [
  'pendiente',
  'en camino',
  'en proceso',
  'en revision',
  'cotizando',
  'cotizado',
  'recotizando',
  'aceptada',
  'pendiente_pago',
  'pagada',
  'rechazado',
  'por_validar',
  'finalizado',
  'en_reclamo',
  'anulada',
] as const

type RequestStatus = (typeof requestStatuses)[number]

function normalizeRequestStatus(value: unknown): RequestStatus {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw.includes('anulada') || raw.includes('cancelada')) return 'anulada'
  if (raw.includes('pagad')) return 'pagada'
  if (raw.includes('aceptad')) return 'aceptada'
  if (raw.includes('pendiente_pago') || raw.includes('pendiente de pago') || raw.includes('pendiente pago')) return 'pendiente_pago'
  if (raw.includes('reclamo') || raw.includes('disputa')) return 'en_reclamo'
  if (raw.includes('por validar') || raw.includes('por_validar')) return 'por_validar'
  if (raw.includes('recotiz')) return 'recotizando'
  if (raw.includes('cotizando')) return 'cotizando'
  if (raw.includes('cotiz')) return 'cotizado'
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

function parseJsonSafe(value: unknown): any {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

function resolveQuoteOrderId(quote: any): number | null {
  if (!quote) return null

  const parseCandidate = (candidate: any): number | null => {
    if (candidate == null) return null
    const asString = String(candidate).trim()
    if (!asString) return null
    const cleaned = asString.replace(/^QT[-_]?/i, '')
    if (!/^[0-9]+$/.test(cleaned)) return null
    const numeric = Number(cleaned)
    if (!Number.isFinite(numeric) || numeric <= 0) return null
    if (numeric > 99999999999) return null
    return numeric
  }

  let orderId = parseCandidate(quote.orderId)
  if (orderId) return orderId

  orderId = parseCandidate(quote.id)
  if (orderId) return orderId

  const feedback = parseJsonSafe(quote.feedback)
  if (feedback && typeof feedback === 'object') {
    const candidates = [
      feedback.orderId,
      feedback.order?.id,
      feedback.order?.orderId,
      feedback.order_id,
      feedback.quote?.orderId,
      feedback.quote?.id,
      feedback.quote?.order_id,
      feedback.quote?.reference,
      feedback.id,
    ]
    for (const candidate of candidates) {
      const parsed = parseCandidate(candidate)
      if (parsed) return parsed
    }
  }

  return null
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
  const [localQuotes, setLocalQuotes] = useState<any[]>(() => {
    if (typeof window === 'undefined') return Array.isArray(quotes) ? quotes : []
    try {
      const stored = window.localStorage.getItem('admin-quotes')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore invalid storage payloads
    }
    return Array.isArray(quotes) ? quotes : []
  })
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
  const [sendingQuote, setSendingQuote] = useState(false)

  const refreshSolicitudes = () => {
    setView('solicitudes')
    router.refresh()
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin-quotes', JSON.stringify(localQuotes))
    }
  }, [localQuotes])

  const handleCreateQuote = (quote: any) => {
    setLocalQuotes((prev) => [quote, ...prev])
  }

  const parseFeedback = (raw: unknown) => {
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

  const buildQuoteFeedbackPayload = (quote: any, preview?: {
    estimatedHours?: number
    details?: string
    materials?: any[]
    additionalBlocks?: any[]
    selectedPromotionId?: string | null
  }) => {
    const parsedFeedback = parseFeedback(quote.feedback) ?? parseFeedback(quote.notasTecnico) ?? parseFeedback(quote.notastecnico) ?? {}
    const mergedFeedback: any = {
      ...parsedFeedback,
      ...(preview?.estimatedHours !== undefined ? { estimatedHours: preview.estimatedHours } : {}),
      ...(preview?.details !== undefined ? { details: preview.details } : {}),
    }

    if (Array.isArray(preview?.materials) && preview.materials.length > 0) {
      mergedFeedback.materials = { items: preview.materials }
    }

    if (Array.isArray(preview?.additionalBlocks)) {
      const filtered = preview.additionalBlocks
        .map((block) => ({
          id: block.id,
          name: block.name,
          unit: block.unit,
          unitPrice: Number(block.unitPrice ?? 0),
          quantity: Number(block.quantity ?? 0),
          markupPercent: Number(block.markupPercent ?? 0),
          ivaPercent: Number(block.ivaPercent ?? 0),
        }))
        .filter((block) => block.quantity > 0 && block.unitPrice > 0)

      if (filtered.length > 0) mergedFeedback.additionalBlocks = filtered
    }

    if (preview?.selectedPromotionId !== undefined) {
      mergedFeedback.promotionId = preview.selectedPromotionId
    }

    if (mergedFeedback && typeof mergedFeedback === 'object') {
      mergedFeedback.quote = {
        ...((mergedFeedback as any).quote ?? {}),
        status: 'Enviada',
        sent: true,
        sentAt: new Date().toISOString(),
      }
    }

    return JSON.stringify(mergedFeedback)
  }

  const sendQuoteToClient = async (
    quote: any,
    preview?: {
      estimatedHours?: number
      details?: string
      materials?: any[]
      additionalBlocks?: any[]
      selectedPromotionId?: string | null
    },
  ) => {
    if (!quote?.id) return
    if (!window.confirm('¿Estás seguro que deseas enviar esta cotización al cliente?')) return

    try {
      setSendingQuote(true)
      const feedbackPayload = preview
        ? buildQuoteFeedbackPayload(quote, preview)
        : typeof quote.feedback === 'string'
          ? quote.feedback
          : JSON.stringify(quote.feedback ?? quote.notasTecnico ?? {})
      const result = await updateOrdenStatus(String(quote.id), 'cotizado', {
        feedback: feedbackPayload,
        appendHistory: {
          title: 'Cotización enviada',
          details: 'La cotización fue enviada al cliente.',
        },
      })

      if (!result?.success) {
        window.alert(result?.error || 'No se pudo enviar la cotización al cliente.')
        return
      }

      setLocalQuotes((prev) => prev.map((item) => (item?.id === quote.id ? { ...item, status: 'cotizado' } : item)))
      window.alert('Cotización enviada al cliente.')
    } catch (error) {
      console.error('Error sending quote to client:', error)
      window.alert('Error enviando cotización al cliente.')
    } finally {
      setSendingQuote(false)
    }
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
              technicians={safeTechnicians}
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
              onCreateQuote={handleCreateQuote}
            />
          )}
          {view === 'agenda' && <Agenda orders={orders} technicians={technicians} />}
          {view === 'cotizaciones' && <Cotizaciones quotes={localQuotes} orders={safeOrders} />}
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
  technicians,
  quotes,
  updatingOrden,
  setUpdatingOrden,
}: {
  orders?: any[]
  clients?: any[]
  technicians?: any[]
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

    const topTechnicians = (technicians ?? [])
      .slice()
      .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
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
              <th className="px-4 py-3 font-medium">Calif.</th>
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
                  <td className="px-4 py-3 font-medium flex items-center gap-2"><Star className="size-3.5 fill-warning text-warning" /> {c.rating ?? 0}</td>
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
  onCreateQuote,
}: {
  orders?: any[]
  technicians?: any[]
  search?: string
  filter?: 'all' | RequestStatus
  onFilterChange?: (value: 'all' | RequestStatus) => void
  adminName?: string
  refreshSolicitudes?: () => void
  onCreateQuote?: (quote: any) => void
}) {
  const [selectedOrden, setSelectedOrden] = useState<string | null>(null)
  const [selectedTecnico, setSelectedTecnico] = useState<Record<string, string>>({})
  const [servicesConfig, setServicesConfig] = useState<any[]>([])
  const [materialsConfig, setMaterialsConfig] = useState<any[]>([])
  const [localQuotes, setLocalQuotes] = useState<any[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = window.localStorage.getItem('admin-quotes')
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [assigning, setAssigning] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ ordenId: string; motivo: string } | null>(null)
  const [feedbackModal, setFeedbackModal] = useState<{ ordenId: string; motivo: string; technicalEvidence?: unknown } | null>(null)
  const [historyModal, setHistoryModal] = useState<{ ordenId: string; historyEntries: any[] } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin-quotes', JSON.stringify(localQuotes))
    }
  }, [localQuotes])

  useEffect(() => {
    let isMounted = true
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings')
        const json = await response.json()
        if (isMounted) {
          setServicesConfig(Array.isArray(json?.settings?.services) ? json.settings.services : [])
          setMaterialsConfig(Array.isArray(json?.settings?.materials) ? json.settings.materials : [])
        }
      } catch {
        if (isMounted) {
          setServicesConfig([])
          setMaterialsConfig([])
        }
      }
    }

    loadSettings()
    return () => {
      isMounted = false
    }
  }, [])

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
    
    // Por defecto, no mostrar órdenes en "pendiente_pago" (esperando confirmación de pago online)
    // Estas órdenes aparecerán cuando el pago sea confirmado por Mercado Pago
    if (estado === 'pendiente_pago' && filter === 'all') {
      return false
    }
    
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

  const getServiceConfig = (serviceName?: string) => {
    if (!serviceName) return null
    const normalizedService = String(serviceName).trim().toLowerCase()
    return (
      servicesConfig.find((service: any) => {
        const name = String(service?.name ?? '').trim().toLowerCase()
        const short = String(service?.short ?? '').trim().toLowerCase()
        return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
      }) ?? null
    )
  }

  const applyMarkupAndIva = (value: number, markupPercent: number, ivaPercent: number) => {
    const subtotalWithMarkup = value * (1 + markupPercent / 100)
    return subtotalWithMarkup * (1 + ivaPercent / 100)
  }

  const resolveMaterialPrice = (item: any) => {
    const itemId = String(item?.materialId ?? item?.id ?? item?.material ?? '').trim().toLowerCase()
    const itemName = String(item?.name ?? item?.material ?? item?.id ?? '').trim().toLowerCase()

    const matchedMaterial = materialsConfig.find((material: any) => {
      const materialId = String(material?.id ?? '').trim().toLowerCase()
      const materialName = String(material?.name ?? '').trim().toLowerCase()
      return (
        (itemId && materialId && (itemId === materialId || itemId.includes(materialId) || materialId.includes(itemId))) ||
        (itemName && materialName && (itemName === materialName || itemName.includes(materialName) || materialName.includes(itemName)))
      )
    })

    const explicitPrice = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.cost ?? 0)
    const configPrice = Number(matchedMaterial?.price ?? 0)
    const subtotal = Number(item?.subtotal ?? item?.total ?? 0)
    const quantity = Number(item?.quantity ?? item?.qty ?? 1)

    return explicitPrice > 0 ? explicitPrice : configPrice > 0 ? configPrice : quantity > 0 && subtotal > 0 ? subtotal / quantity : 0
  }

  type QuoteBreakdown = {
    materialsValue: number
    hoursValue: number
    visitPrice: number
    additionalVisitCount: number
    visitValue: number
    estimatedHours: number
  }

  const getQuoteBreakdown = (feedbackValue: unknown, serviceName?: string): QuoteBreakdown => {
    const feedback = parseFeedback(feedbackValue)
    const directItems = Array.isArray(feedback?.materials?.items)
      ? feedback.materials.items
      : Array.isArray(feedback?.materials)
        ? feedback.materials
        : []

    const materialEntries = directItems.length > 0
      ? directItems
      : (Array.isArray(feedback?.missingMaterials)
          ? feedback.missingMaterials
          : Array.isArray(feedback?.rejectionFeedback?.missingMaterials)
            ? feedback.rejectionFeedback.missingMaterials
            : [])

    let materialsValue = 0
    materialEntries.forEach((item: any) => {
      const quantity = Number(item?.quantity ?? item?.qty ?? 1)
      const unitPrice = resolveMaterialPrice(item)
      materialsValue += unitPrice * quantity
    })

    const serviceConfig = getServiceConfig(serviceName)
    const estimatedHours = Number(feedback?.estimatedHours ?? 0)
    const hourValue = Number(serviceConfig?.hourValue ?? 0)
    const hoursValue = estimatedHours > 0
      ? applyMarkupAndIva(estimatedHours * hourValue, Number(serviceConfig?.hourMarkupPercent ?? 0), Number(serviceConfig?.hourIvaPercent ?? 0))
      : 0
    const visitPrice = Number(serviceConfig?.visitPrice ?? 0)
    const visitUnitValue = applyMarkupAndIva(visitPrice, Number(serviceConfig?.markupPercent ?? 0), Number(serviceConfig?.ivaPercent ?? 0))
    const additionalVisitCount = estimatedHours > 8 ? Math.max(0, Math.floor((estimatedHours - 1) / 8)) : 0
    const visitValue = visitUnitValue * (1 + additionalVisitCount)

    return {
      materialsValue,
      hoursValue,
      visitPrice,
      additionalVisitCount,
      visitValue,
      estimatedHours,
    }
  }

  const createExtraQuote = async (solicitud: any) => {
    const feedbackRaw = getOrderFeedback(solicitud)
    const parsedFeedback = parseFeedback(feedbackRaw)
    const quoteId = `QT-${Date.now()}`
    const clientName = solicitud.clienteNombre || solicitud.client || 'Cliente'
    const serviceName = getOrderService(solicitud)
    const quoteBreakdown = getQuoteBreakdown(parsedFeedback, serviceName)
    const estimatedHours = quoteBreakdown.estimatedHours
    const quoteTotal = quoteBreakdown.materialsValue + quoteBreakdown.visitValue + quoteBreakdown.hoursValue

    const quoteNotes = [
      parsedFeedback?.details,
      parsedFeedback?.reasons?.length ? `Motivos: ${parsedFeedback.reasons.join(', ')}` : null,
      parsedFeedback?.missingMaterials?.length ? `Materiales faltantes: ${parsedFeedback.missingMaterials.map((item: any) => item.name || item.id).join(', ')}` : null,
      Number.isFinite(estimatedHours) && estimatedHours > 0 ? `Horas estimadas: ${estimatedHours}` : null,
    ].filter(Boolean)

    const quote = {
      id: quoteId,
      orderId: solicitud.id,
      client: clientName,
      clienteEmail: solicitud.clienteEmail || '',
      email: solicitud.clienteEmail || '',
      service: serviceName,
      date: new Date().toLocaleDateString('es-CL'),
      status: 'Borrador' as const,
      total: Number(quoteTotal) || 0,
      estimatedHours: Number(estimatedHours) || 0,
      pricing: {
        materialsValue: quoteBreakdown.materialsValue || 0,
        visitPrice: quoteBreakdown.visitPrice || 0,
        visitValue: quoteBreakdown.visitValue || 0,
        additionalVisits: quoteBreakdown.additionalVisitCount || 0,
        hoursValue: quoteBreakdown.hoursValue || 0,
      },
      notes: quoteNotes.join(' | '),
      feedback: parsedFeedback,
    }

    onCreateQuote?.(quote)

    const nextFeedback = {
      ...(typeof parsedFeedback === 'object' && parsedFeedback !== null ? parsedFeedback : {}),
      pricing: {
        materialsValue: quoteBreakdown.materialsValue || 0,
        visitPrice: quoteBreakdown.visitPrice || 0,
        visitValue: quoteBreakdown.visitValue || 0,
        additionalVisits: quoteBreakdown.additionalVisitCount || 0,
        hoursValue: quoteBreakdown.hoursValue || 0,
      },
      quote: {
        id: quoteId,
        status: 'Borrador',
        sent: false,
        createdAt: new Date().toISOString(),
      },
    }

    try {
      const currentStatus = normalizeRequestStatus(solicitud.estado ?? solicitud.status ?? 'en revision')
      const result = await updateOrdenStatus(String(solicitud.id), currentStatus, {
        feedback: JSON.stringify(nextFeedback),
        appendHistory: {
          title: 'Cotización extra creada',
          details: `Se generó la cotización ${quoteId} con base en el feedback de revisión.`,
        },
      })

      if (!result.success) {
        alert(`❌ Error: ${result.error}`)
        return
      }

      refreshSolicitudes?.()
    } catch (error) {
      alert(`❌ Error: ${String(error)}`)
    }
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
    if (status === 'cotizando') return 'Cotizando'
    if (status === 'cotizado') return 'Cotizado'
    if (status === 'recotizando') return 'Recotizando'
    if (status === 'aceptada') return 'Aceptada'
    if (status === 'pendiente_pago') return 'Pendiente de pago'
    if (status === 'pagada') return 'Pagada'
    if (status === 'finalizado') return 'Finalizado'
    if (status === 'rechazado') return 'Rechazado'
    if (status === 'en revision') return 'En revisión'
    if (status === 'anulada') return 'Anulada'
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
                                        onClick={() => createExtraQuote(solicitud)}
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
                                      onClick={() => createExtraQuote(solicitud)}
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
                        {rejectionFeedback.estimatedHours !== undefined && rejectionFeedback.estimatedHours !== null && rejectionFeedback.estimatedHours !== '' ? (
                          <div className="mt-3 rounded-2xl border border-destructive/20 bg-background/80 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Horas estimadas</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{String(rejectionFeedback.estimatedHours)} h</p>
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
                if (feedback && (feedback.materials || feedback.checklist || feedback.photos || feedback.signature || feedback.voltage || feedback.current || feedback.earthResistance || feedback.continuity || feedback.observations || feedback.evidenceRequirements || feedback.evidence)) {
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
                      {feedback.estimatedHours !== undefined && feedback.estimatedHours !== null && feedback.estimatedHours !== '' ? (
                        <div className="rounded-2xl border border-border bg-background p-4">
                          <h3 className="text-sm font-semibold mb-3">Horas estimadas</h3>
                          <div className="rounded-2xl border border-border bg-secondary/10 p-3">
                            <p className="text-xs text-muted-foreground">Estimación del técnico</p>
                            <p className="mt-1 text-sm font-semibold">{String(feedback.estimatedHours)} h</p>
                          </div>
                        </div>
                      ) : null}

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
                      {(() => {
                        const evidenceEntries = Object.entries(feedback.evidence || {}).filter(([, value]) => value && typeof value === 'object')
                        const hasEvidenceValues = Boolean(
                          feedback.voltage || feedback.current || feedback.earthResistance || feedback.continuity || feedback.observations || evidenceEntries.length
                        )

                        if (!hasEvidenceValues) return null

                        return (
                          <div className="rounded-2xl border border-border bg-background p-4">
                            <h3 className="text-sm font-semibold mb-3">Evidencia Técnica</h3>

                            {(feedback.voltage || feedback.current || feedback.earthResistance || feedback.continuity || feedback.observations) && (
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
                            )}

                            {feedback.observations && (
                              <div className="mt-3 rounded-2xl border border-border bg-secondary/10 p-3">
                                <p className="text-xs text-muted-foreground">Observaciones técnicas</p>
                                <p className="mt-1 text-sm">{feedback.observations}</p>
                              </div>
                            )}

                            {evidenceEntries.length > 0 && (
                              <div className="mt-4 space-y-3">
                                {evidenceEntries.map(([templateId, value]: [string, any]) => {
                                  const requirements = value?.evidenceRequirements || feedback.evidenceRequirements?.[templateId] || null
                                  const entries = Object.entries(value || {}).filter(([key]) => key !== 'evidenceRequirements')
                                  return (
                                    <div key={templateId} className="rounded-2xl border border-border bg-secondary/10 p-3">
                                      <p className="text-sm font-semibold">{templateId}</p>
                                      {requirements && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {requirements.photosBefore && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">Fotos antes</span>}
                                          {requirements.photosAfter && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">Fotos después</span>}
                                          {requirements.measurements && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">Mediciones</span>}
                                        </div>
                                      )}
                                      {entries.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                          {entries.map(([key, entryValue]: [string, any]) => (
                                            <div key={key} className="rounded-xl border border-border bg-background/70 p-2">
                                              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{key}</p>
                                              <p className="mt-1 text-sm">{String(entryValue)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })()}

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
  const [agendaView, setAgendaView] = useState<'daily' | 'weekly' | 'monthly'>('monthly')

  const timeBlocks = ['09:00', '11:00', '13:00', '15:30', '17:00', '19:00']

  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)
  const [calendarMonthKey, setCalendarMonthKey] = useState(todayKey.slice(0, 7))

  const parseDateKey = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map((part) => Number(part))
    return new Date(Date.UTC(year, month - 1, day))
  }

  const parseMonthKey = (monthKey: string) => {
    const [year, month] = monthKey.split('-').map((part) => Number(part))
    return new Date(Date.UTC(year, month - 1, 1))
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
  const [monthYear, monthString] = [calendarMonthKey.slice(0, 4), calendarMonthKey.slice(5, 7)]
  const monthDays = new Date(Number(monthYear), Number(monthString), 0).getDate()
  const monthKeys = getDateRange(`${calendarMonthKey}-01`, monthDays)

  const dailyOrders = activeOrders.filter((o) => o.scheduleDateKey === selectedDateKey)
  const weeklyOrders = activeOrders.filter((o) => o.scheduleDateKey && weekKeys.includes(o.scheduleDateKey))
  const monthlyOrders = activeOrders.filter((o) => o.scheduleDateKey && o.scheduleDateKey.startsWith(calendarMonthKey))

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

  const statusColorClasses: Record<string, string> = {
    pendiente: 'bg-amber-500 text-amber-foreground',
    'en camino': 'bg-sky-500 text-sky-foreground',
    'en proceso': 'bg-orange-500 text-orange-foreground',
    finalizado: 'bg-emerald-500 text-emerald-foreground',
    rechazado: 'bg-destructive-500 text-destructive-foreground',
    'en revision': 'bg-violet-500 text-violet-foreground',
  }

  const monthStatusCounts = monthKeys.reduce((acc: Record<string, Record<string, number>>, key) => {
    acc[key] = normalizedOrders
      .filter((order) => order.scheduleDateKey === key)
      .reduce((dayAcc: Record<string, number>, order) => {
        const status = order.status || 'pendiente'
        dayAcc[status] = (dayAcc[status] || 0) + 1
        return dayAcc
      }, {})
    return acc
  }, {})

  const monthOrders = normalizedOrders.filter((o) => o.scheduleDateKey && monthKeys.includes(o.scheduleDateKey))
  const monthMarkerCounts = monthKeys.reduce((acc: Record<string, number>, key) => {
    acc[key] = monthOrders.filter((order) => order.scheduleDateKey === key).length
    return acc
  }, {})

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, 1))
    return date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: 'America/Santiago' })
  }

  const changeCalendarMonth = (delta: number) => {
    const current = parseMonthKey(calendarMonthKey)
    current.setUTCMonth(current.getUTCMonth() + delta)
    const nextYear = current.getUTCFullYear()
    const nextMonth = String(current.getUTCMonth() + 1).padStart(2, '0')
    setCalendarMonthKey(`${nextYear}-${nextMonth}`)
  }

  const buildCalendarGrid = () => {
    const firstDayDate = parseMonthKey(calendarMonthKey)
    const startDay = firstDayDate.getUTCDay()
    const startOffset = (startDay + 6) % 7 // lunes como primer día
    const totalDays = monthDays
    const cells: Array<{ key: string; day: number; count: number; date: Date } | null> = []

    for (let i = 0; i < startOffset; i += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const key = `${calendarMonthKey}-${String(day).padStart(2, '0')}`
      const date = new Date(Date.UTC(Number(monthYear), Number(monthString) - 1, day))
      const count = monthMarkerCounts[key] || 0
      cells.push({ key, day, count, date })
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    return cells
  }

  const calendarCells = buildCalendarGrid()

  const dailyGrouped = groupByDay(dailyOrders)
  const weeklyGrouped = groupByDay(weeklyOrders)
  const monthlyGrouped = groupByDay(monthlyOrders)

  const displayGroups = agendaView === 'daily' ? dailyGrouped : agendaView === 'weekly' ? weeklyGrouped : monthlyGrouped

  const renderAgendaGroups = () => {
    if (agendaView === 'monthly') {
      return (
        <div className="overflow-hidden rounded-2xl border border-border bg-background p-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[560px] grid grid-cols-7 gap-2 pt-2">
              {calendarCells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className="min-h-[80px] rounded-2xl bg-card" />
                }

                const isToday = cell.key === todayKey
                const isSelected = cell.key === selectedDateKey
                const count = cell.count

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => {
                      setSelectedDateKey(cell.key)
                      setAgendaView('daily')
                    }}
                    className={cn(
                      'group min-h-[80px] rounded-2xl border p-3 text-left transition',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/70 hover:bg-accent/10',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{cell.day}</span>
                      {isToday ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">Hoy</span> : null}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {count > 0 ? `${count} solicitud${count !== 1 ? 'es' : ''}` : 'Sin solicitudes'}
                    </p>
                    {count > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {Object.entries(monthStatusCounts[cell.key] || {}).slice(0, 2).map(([status, statusCount]) => (
                          <span
                            key={status}
                            className={cn(
                              'rounded-full px-2 py-1 text-[11px] font-semibold',
                              statusColorClasses[status] ?? 'bg-secondary/10 text-secondary',
                            )}
                          >
                            {statusCount} {status}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    if (Object.keys(displayGroups).length > 0) {
      return (
        <>
          {Object.entries(displayGroups).map(([group, items]) => (
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
          ))}
        </>
      )
    }

    return <p className="text-sm text-muted-foreground">No hay órdenes para esta vista.</p>
  }

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

      {agendaView === 'monthly' && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            onClick={() => changeCalendarMonth(-1)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-background sm:w-auto w-full"
          >
            <ArrowLeft className="size-4" />
            Mes anterior
          </button>
          <div className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-center sm:text-left w-full sm:w-auto">
            {getMonthName(calendarMonthKey)}
          </div>
          <input
            type="month"
            value={calendarMonthKey}
            onChange={(event) => setCalendarMonthKey(event.target.value)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition focus:outline-none focus:ring-2 focus:ring-primary sm:w-auto w-full"
          />
          <button
            onClick={() => changeCalendarMonth(1)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-background sm:w-auto w-full"
          >
            Siguiente mes
            <ArrowRight className="size-4" />
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
              {renderAgendaGroups()}
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

function Cotizaciones(props: { quotes?: any[]; orders?: any[] }) {
  const initialQuotes = Array.isArray(props.quotes) ? props.quotes : []
  const safeOrders = Array.isArray(props.orders) ? props.orders : []
  const [localQuotes, setLocalQuotes] = useState<any[]>(initialQuotes)
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null)
  const [previewQuoteOpen, setPreviewQuoteOpen] = useState(false)
  const [servicesConfig, setServicesConfig] = useState<any[]>([])
  const [materialsConfig, setMaterialsConfig] = useState<any[]>([])
  const [promotionsConfig, setPromotionsConfig] = useState<any[]>([])
  const [selectedPromotionId, setSelectedPromotionId] = useState<string | null>(null)
  const [editableMaterials, setEditableMaterials] = useState<any[]>([])
  const [editableReviewDescription, setEditableReviewDescription] = useState('')
  const [editableEstimatedHours, setEditableEstimatedHours] = useState<number | null>(null)
  const [sendingQuote, setSendingQuote] = useState(false)

  const resolveQuoteOrderId = (quote: any): number | null => {
    if (!quote) return null

    const parseCandidate = (candidate: any): number | null => {
      if (candidate == null) return null
      const asString = String(candidate).trim()
      if (!asString) return null
      if (!/^[0-9]+$/.test(asString)) return null
      const numeric = Number(asString)
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null
    }

    let orderId = parseCandidate(quote.orderId)
    if (orderId) return orderId

    orderId = parseCandidate(quote.id)
    if (orderId) return orderId

    const feedback = parseJsonSafe(quote.feedback) ?? parseJsonSafe(quote.notasTecnico) ?? parseJsonSafe(quote.notastecnico) ?? quote.feedback
    if (feedback && typeof feedback === 'object') {
      const candidates = [
        feedback.orderId,
        feedback.order?.id,
        feedback.order?.orderId,
        feedback.order_id,
        feedback.quote?.orderId,
        feedback.quote?.id,
        feedback.quote?.order_id,
        feedback.quote?.reference,
        feedback.id,
      ]
      for (const candidate of candidates) {
        const parsed = parseCandidate(candidate)
        if (parsed) return parsed
      }
    }

    const normalizedQuoteClient = String(quote.client ?? quote.clienteNombre ?? quote.clientName ?? '').trim().toLowerCase()
    const normalizedQuoteService = String(quote.service ?? quote.categoria ?? quote.descripcion ?? quote.description ?? '').trim().toLowerCase()
    const normalizedQuoteDate = String(quote.date ?? quote.createdAt ?? quote.localDate ?? '').trim().toLowerCase()
    const quoteTotal = Number(quote.total ?? quote.precio ?? quote.price ?? 0)

    for (const order of safeOrders) {
      const normalizedOrderClient = String(order.client ?? order.clienteNombre ?? order.clientName ?? '').trim().toLowerCase()
      const normalizedOrderService = String(order.service ?? order.categoria ?? order.descripcion ?? order.description ?? '').trim().toLowerCase()
      const normalizedOrderDate = String(order.date ?? order.localDate ?? order.createdAt ?? '').trim().toLowerCase()
      const orderTotal = Number(order.precio ?? order.price ?? order.total ?? 0)

      const clientMatches = normalizedOrderClient && normalizedQuoteClient && normalizedOrderClient === normalizedQuoteClient
      const serviceMatches = normalizedOrderService && normalizedQuoteService && normalizedOrderService === normalizedQuoteService
      const dateMatches = normalizedQuoteDate && normalizedOrderDate && normalizedOrderDate.includes(normalizedQuoteDate)
      const totalMatches = quoteTotal > 0 && orderTotal > 0 && quoteTotal === orderTotal
      const looseTotalMatches = quoteTotal > 0 && orderTotal > 0 && Math.abs(orderTotal - quoteTotal) / quoteTotal <= 0.05

      if (clientMatches && serviceMatches && (dateMatches || totalMatches || looseTotalMatches)) {
        const parsed = parseCandidate(order.id)
        if (parsed) return parsed
      }
    }

    return null
  }

  const sendQuoteToClient = async (
    quote: any,
    preview?: {
      estimatedHours?: number
      details?: string
      materials?: any[]
      additionalBlocks?: any[]
      selectedPromotionId?: string | null
    },
  ) => {
    if (!quote?.id && quote?.orderId == null) return
    if (!window.confirm('¿Estás seguro que deseas enviar esta cotización al cliente?')) return

    const numericOrderId = resolveQuoteOrderId(quote)
    if (!numericOrderId) {
      window.alert('No es posible enviar esta cotización: falta el ID de orden válido.')
      return
    }

    const matchedOrder = safeOrders.find((order) => Number(order.id) === numericOrderId)
    if (!matchedOrder) {
      window.alert('No es posible enviar esta cotización: no se encontró la orden asociada.')
      return
    }

    try {
      setSendingQuote(true)
      const parsedFeedback = parseJsonSafe(quote.feedback) ?? parseJsonSafe(quote.notasTecnico) ?? parseJsonSafe(quote.notastecnico) ?? quote.feedback
      const feedbackObject = parsedFeedback && typeof parsedFeedback === 'object' ? parsedFeedback : null
      const finalFeedback = feedbackObject
        ? {
            ...feedbackObject,
            ...(preview?.estimatedHours !== undefined ? { estimatedHours: preview.estimatedHours } : {}),
            ...(preview?.details !== undefined ? { details: preview.details } : {}),
            ...(Array.isArray(preview?.materials) && preview.materials.length > 0 ? { materials: { items: preview.materials } } : {}),
            ...(Array.isArray(preview?.additionalBlocks) && preview.additionalBlocks.length > 0 ? { additionalBlocks: preview.additionalBlocks.map((block: any) => ({
              id: block.id,
              name: block.name,
              unit: block.unit,
              unitPrice: Number(block.unitPrice ?? 0),
              quantity: Number(block.quantity ?? 0),
              markupPercent: Number(block.markupPercent ?? 0),
              ivaPercent: Number(block.ivaPercent ?? 0),
            })) } : {}),
            ...(preview?.selectedPromotionId !== undefined ? { promotionId: preview.selectedPromotionId } : {}),
            quote: {
              ...((feedbackObject as any).quote ?? {}),
              status: 'Enviada',
              sent: true,
              sentAt: new Date().toISOString(),
            },
          }
        : quote.feedback ?? quote.notasTecnico ?? quote.notastecnico ?? {}
      const feedbackPayload = typeof finalFeedback === 'string' ? finalFeedback : JSON.stringify(finalFeedback)
      const result = await updateOrdenStatus(String(matchedOrder.id), 'cotizado', {
        feedback: feedbackPayload,
        appendHistory: {
          title: 'Cotización enviada',
          details: 'La cotización fue enviada al cliente.',
        },
      })

      if (!result?.success) {
        window.alert(result?.error || 'No se pudo enviar la cotización al cliente.')
        return
      }

      const updatedQuote = {
        ...quote,
        status: 'cotizado',
        orderId: quote.orderId ?? numericOrderId,
      }

      setSelectedQuote((prev: any) => (prev?.id === quote.id ? updatedQuote : prev))
      window.alert('Cotización enviada al cliente.')
    } catch (error) {
      console.error('Error sending quote to client:', error)
      window.alert('Error enviando cotización al cliente.')
    } finally {
      setSendingQuote(false)
    }
  }

  type AdditionalQuoteBlock = {
    id: string
    materialId: string
    name: string
    unit: string
    unitPrice: number
    quantity: number
    markupPercent: number
    ivaPercent: number
  }
  const [editableAdditionalBlocks, setEditableAdditionalBlocks] = useState<AdditionalQuoteBlock[]>([
    {
      id: 'additional-0',
      materialId: '',
      name: 'Concepto adicional',
      unit: '',
      unitPrice: 0,
      quantity: 1,
      markupPercent: 0,
      ivaPercent: 0,
    },
  ])

  useEffect(() => {
    if (safeOrders.length > 0) {
      setLocalQuotes((prev: any[]) =>
        prev.map((quote: any) => {
          if (quote.orderId) return quote
          const resolved = resolveQuoteOrderId(quote)
          return resolved ? { ...quote, orderId: resolved } : quote
        }),
      )
    }
  }, [safeOrders])

  const resetAdditionalBlocks = () => {
    setEditableAdditionalBlocks([
      {
        id: 'additional-0',
        materialId: '',
        name: 'Concepto adicional',
        unit: '',
        unitPrice: 0,
        quantity: 1,
        markupPercent: 0,
        ivaPercent: 0,
      },
    ])
  }
  const styles: Record<string, string> = {
    borrador: 'bg-muted/15 text-muted-foreground',
    cotizado: 'bg-warning/15 text-warning',
    recotizando: 'bg-violet-500/15 text-violet-600',
    aceptada: 'bg-primary/15 text-primary',
    pendiente_pago: 'bg-primary/15 text-primary',
    pagada: 'bg-emerald-500/15 text-emerald-700',
    rechazado: 'bg-destructive/15 text-destructive',
  }

  const quoteStatusFilterOptions = ['all', 'borrador', 'cotizado', 'recotizando', 'aceptada', 'pendiente_pago', 'pagada', 'rechazado'] as const
  type QuoteStatusFilter = (typeof quoteStatusFilterOptions)[number]
  const [quoteFilter, setQuoteFilter] = useState<QuoteStatusFilter>('all')

  useEffect(() => {
    let isMounted = true
    const loadServices = async () => {
      try {
        const response = await fetch('/api/admin/settings')
        const json = await response.json()
        if (isMounted) {
          setServicesConfig(Array.isArray(json?.settings?.services) ? json.settings.services : [])
          setMaterialsConfig(Array.isArray(json?.settings?.materials) ? json.settings.materials : [])
          setPromotionsConfig(Array.isArray(json?.settings?.promotions) ? json.settings.promotions : [])
        }
      } catch {
        if (isMounted) {
          setServicesConfig([])
          setMaterialsConfig([])
          setPromotionsConfig([])
        }
      }
    }

    loadServices()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (selectedQuote) {
      const feedback = parseFeedback(selectedQuote.feedback)
      setEditableReviewDescription(
        String(feedback?.details ?? feedback?.description ?? selectedQuote.notes ?? ''),
      )
      setEditableEstimatedHours(
        typeof feedback?.estimatedHours === 'number'
          ? feedback.estimatedHours
          : Number(selectedQuote.estimatedHours ?? 0),
      )
    } else {
      setEditableReviewDescription('')
      setEditableEstimatedHours(null)
      setSelectedPromotionId(null)
    }
  }, [selectedQuote])

  const parseFeedback = (value: unknown) => {
    if (!value) return null
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    }
    return value
  }

  const deriveQuoteState = (quote: any) => {
    const rawStatus = String(quote?.status ?? quote?.estado ?? '').trim().toLowerCase()
    const feedback = parseFeedback(quote?.feedback ?? quote?.notasTecnico ?? quote?.notastecnico ?? quote?.notas_tecnico ?? quote?.quote ?? null)
    const quoteStatus = String(feedback?.quote?.status ?? '').trim().toLowerCase()
    const sentFlag = feedback && typeof feedback === 'object' && (
      feedback.sent === true ||
      (feedback.quote?.sent === true) ||
      /enviad/.test(String(quoteStatus)) ||
      quoteStatus === 'cotizado'
    )

    if (['pendiente_pago', 'pendiente de pago', 'pendiente pago'].includes(rawStatus)) return 'pendiente_pago'
    if (rawStatus === 'recotizando') return 'recotizando'
    if (rawStatus === 'aceptada') return 'aceptada'
    if (['pagada', 'pagado', 'finalizado', 'completado'].includes(rawStatus)) return 'pagada'
    if (['rechazado', 'cancelada', 'cancelado'].includes(rawStatus)) return 'rechazado'
    if (['enviada', 'enviado', 'cotizado'].includes(rawStatus)) return 'cotizado'
    if (rawStatus === 'borrador' || rawStatus === 'draft' || rawStatus === '') {
      if (sentFlag) return 'cotizado'
      return 'borrador'
    }
    if (['enviada', 'enviado', 'cotizado'].includes(quoteStatus) || sentFlag) return 'cotizado'
    return rawStatus || 'borrador'
  }

  const getQuoteStatusLabel = (status: string) => {
    switch (status) {
      case 'cotizado':
        return 'Enviada'
      case 'recotizando':
        return 'Recotizada'
      case 'aceptada':
        return 'Aceptada'
      case 'pendiente_pago':
        return 'Pendiente de pago'
      case 'pagada':
        return 'Pagada'
      case 'rechazado':
        return 'Rechazada'
      case 'borrador':
      default:
        return 'Borrador'
    }
  }

  const quoteGroups = useMemo(() => {
    const order = ['borrador', 'cotizado', 'recotizando', 'aceptada', 'pendiente_pago', 'pagada', 'rechazado']
    return order.map((status) => ({
      status,
      items: localQuotes
        .map((quote) => ({ quote, state: deriveQuoteState(quote) }))
        .filter((item) => item.state === status)
        .map((item) => item.quote)
        .sort((a, b) => String(b.date ?? b.createdAt ?? '').localeCompare(String(a.date ?? a.createdAt ?? ''))),
    }))
  }, [localQuotes])

  const quoteStatusSummary = (status: string, count: number) => {
    return `${count} cotización${count === 1 ? '' : 'es'} ${getQuoteStatusLabel(status).toLowerCase()}`
  }

  const applyMarkup = (value: number, markupPercent: number) => value * (1 + markupPercent / 100)

  const applyMarkupAndIva = (value: number, markupPercent: number, ivaPercent: number) => {
    const subtotalWithMarkup = applyMarkup(value, markupPercent)
    return subtotalWithMarkup * (1 + ivaPercent / 100)
  }

  const getServiceHourValue = (serviceName?: string) => {
    if (!serviceName) return 0
    const normalizedService = String(serviceName).trim().toLowerCase()
    const matchedService = servicesConfig.find((service: any) => {
      const name = String(service?.name ?? '').trim().toLowerCase()
      const short = String(service?.short ?? '').trim().toLowerCase()
      return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
    })
    return Number(matchedService?.hourValue ?? 0)
  }

  const findServiceConfigByQuote = (quote: any) => {
    if (!quote) return null
    const normalizedService = String(quote.service ?? '').trim().toLowerCase()
    return servicesConfig.find((service: any) => {
      const name = String(service?.name ?? '').trim().toLowerCase()
      const short = String(service?.short ?? '').trim().toLowerCase()
      return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
    })
  }

  useEffect(() => {
    if (!selectedQuote) return
    const serviceConfig = findServiceConfigByQuote(selectedQuote)
    const applicablePromotions = getApplicablePromotions(promotionsConfig, new Date(), serviceConfig?.id)
    if (!selectedPromotionId && applicablePromotions.length > 0) {
      setSelectedPromotionId(applicablePromotions[0].id)
    }
  }, [selectedQuote, promotionsConfig, servicesConfig, selectedPromotionId])

  const resolveMaterialPrice = (item: any) => {
    const itemId = String(item?.materialId ?? item?.id ?? item?.material ?? '').trim().toLowerCase()
    const itemName = String(item?.name ?? item?.material ?? item?.id ?? '').trim().toLowerCase()

    const matchedMaterial = materialsConfig.find((material: any) => {
      const materialId = String(material?.id ?? '').trim().toLowerCase()
      const materialName = String(material?.name ?? '').trim().toLowerCase()
      return (
        (itemId && materialId && (itemId === materialId || itemId.includes(materialId) || materialId.includes(itemId))) ||
        (itemName && materialName && (itemName === materialName || itemName.includes(materialName) || materialName.includes(itemName)))
      )
    })

    const explicitPrice = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.cost ?? 0)
    const configPrice = Number(matchedMaterial?.price ?? 0)
    const subtotal = Number(item?.subtotal ?? item?.total ?? 0)
    const quantity = Number(item?.quantity ?? item?.qty ?? 1)
    const basePrice = explicitPrice > 0 ? explicitPrice : configPrice > 0 ? configPrice : quantity > 0 && subtotal > 0 ? subtotal / quantity : 0
    const markupPercent = Number(matchedMaterial?.markupPercent ?? 0)
    const ivaPercent = Number(matchedMaterial?.ivaPercent ?? 0)

    return applyMarkupAndIva(basePrice, markupPercent, ivaPercent)
  }

  const resolveMaterialNetPrice = (item: any) => {
    const itemId = String(item?.materialId ?? item?.id ?? item?.material ?? '').trim().toLowerCase()
    const itemName = String(item?.name ?? item?.material ?? item?.id ?? '').trim().toLowerCase()

    const matchedMaterial = materialsConfig.find((material: any) => {
      const materialId = String(material?.id ?? '').trim().toLowerCase()
      const materialName = String(material?.name ?? '').trim().toLowerCase()
      return (
        (itemId && materialId && (itemId === materialId || itemId.includes(materialId) || materialId.includes(itemId))) ||
        (itemName && materialName && (itemName === materialName || itemName.includes(materialName) || materialName.includes(itemName)))
      )
    })

    const explicitPrice = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.cost ?? 0)
    const configPrice = Number(matchedMaterial?.price ?? 0)
    const subtotal = Number(item?.subtotal ?? item?.total ?? 0)
    const quantity = Number(item?.quantity ?? item?.qty ?? 1)
    const basePrice = explicitPrice > 0 ? explicitPrice : configPrice > 0 ? configPrice : quantity > 0 && subtotal > 0 ? subtotal / quantity : 0
    const markupPercent = Number(matchedMaterial?.markupPercent ?? 0)

    return applyMarkup(basePrice, markupPercent)
  }

  const resolveMaterialBasePrice = (item: any) => {
    const itemId = String(item?.materialId ?? item?.id ?? item?.material ?? '').trim().toLowerCase()
    const itemName = String(item?.name ?? item?.material ?? item?.id ?? '').trim().toLowerCase()

    const matchedMaterial = materialsConfig.find((material: any) => {
      const materialId = String(material?.id ?? '').trim().toLowerCase()
      const materialName = String(material?.name ?? '').trim().toLowerCase()
      return (
        (itemId && materialId && (itemId === materialId || itemId.includes(materialId) || materialId.includes(itemId))) ||
        (itemName && materialName && (itemName === materialName || itemName.includes(materialName) || materialName.includes(itemName)))
      )
    })

    const explicitPrice = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.cost ?? 0)
    const configPrice = Number(matchedMaterial?.price ?? 0)
    const subtotal = Number(item?.subtotal ?? item?.total ?? 0)
    const quantity = Number(item?.quantity ?? item?.qty ?? 1)
    return explicitPrice > 0 ? explicitPrice : configPrice > 0 ? configPrice : quantity > 0 && subtotal > 0 ? subtotal / quantity : 0
  }

  const getServiceVisitValue = (serviceName?: string) => {
    if (!serviceName) return 0
    const normalizedService = String(serviceName).trim().toLowerCase()
    const matchedService = servicesConfig.find((service: any) => {
      const name = String(service?.name ?? '').trim().toLowerCase()
      const short = String(service?.short ?? '').trim().toLowerCase()
      return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
    })
    return Number(matchedService?.visitPrice ?? 0)
  }

  const getQuotePricing = (feedbackValue: unknown, serviceName?: string) => {
    const feedback = parseFeedback(feedbackValue)
    const directItems = Array.isArray(feedback?.materials?.items)
      ? feedback.materials.items
      : Array.isArray(feedback?.materials)
        ? feedback.materials
        : []

    const materialEntries = directItems.length > 0
      ? directItems
      : (Array.isArray(feedback?.missingMaterials)
          ? feedback.missingMaterials
          : Array.isArray(feedback?.rejectionFeedback?.missingMaterials)
            ? feedback.rejectionFeedback.missingMaterials
            : [])

    let materialsValue = 0
    let materialsNetValue = 0
    let materialsBaseValue = 0
    let materialsIvaWeightedBase = 0
    materialEntries.forEach((item: any) => {
      const quantity = Number(item?.quantity ?? item?.qty ?? 1)
      const unitPrice = resolveMaterialPrice(item)
      const netUnitPrice = resolveMaterialNetPrice(item)
      const baseUnitPrice = resolveMaterialBasePrice(item)
      materialsValue += unitPrice * quantity
      materialsNetValue += netUnitPrice * quantity
      materialsBaseValue += baseUnitPrice * quantity
      materialsIvaWeightedBase += netUnitPrice * quantity
    })

    const serviceConfig = servicesConfig.find((service: any) => {
      const normalizedService = String(serviceName ?? '').trim().toLowerCase()
      const name = String(service?.name ?? '').trim().toLowerCase()
      const short = String(service?.short ?? '').trim().toLowerCase()
      return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
    })
    const estimatedHours = Number(feedback?.estimatedHours ?? 0)
    const hourValue = getServiceHourValue(serviceName)
    const hoursNetValue = estimatedHours > 0
      ? applyMarkup(estimatedHours * hourValue, Number(serviceConfig?.hourMarkupPercent ?? 0))
      : 0
    const hoursValue = estimatedHours > 0
      ? applyMarkupAndIva(estimatedHours * hourValue, Number(serviceConfig?.hourMarkupPercent ?? 0), Number(serviceConfig?.hourIvaPercent ?? 0))
      : 0
    const visitPrice = getServiceVisitValue(serviceName)
    const additionalVisitCount = estimatedHours > 8 ? Math.max(0, Math.floor((estimatedHours - 1) / 8)) : 0
    const visitNetValue = applyMarkup(visitPrice, Number(serviceConfig?.markupPercent ?? 0)) * (1 + additionalVisitCount)
    const visitValue = applyMarkupAndIva(visitPrice, Number(serviceConfig?.markupPercent ?? 0), Number(serviceConfig?.ivaPercent ?? 0)) * (1 + additionalVisitCount)
    const visitBaseValue = visitPrice * (1 + additionalVisitCount)
    const visitProfitValue = visitNetValue - visitBaseValue
    const hoursBaseValue = estimatedHours * hourValue
    const hoursProfitValue = hoursNetValue - hoursBaseValue
    const materialsProfitValue = materialsNetValue - materialsBaseValue
    const totalProfitValue = materialsProfitValue + hoursProfitValue + visitProfitValue
    const materialsIvaValue = materialsValue - materialsNetValue
    const materialsIvaPercent = materialsIvaWeightedBase > 0 ? (materialsIvaValue / materialsIvaWeightedBase) * 100 : 0
    const hoursIvaValue = hoursValue - hoursNetValue
    const hoursIvaPercent = Number(serviceConfig?.hourIvaPercent ?? 0)
    const visitIvaValue = visitValue - visitNetValue
    const visitIvaPercent = Number(serviceConfig?.ivaPercent ?? 0)
    const totalIvaValue = materialsIvaValue + hoursIvaValue + visitIvaValue
    const totalNetValue = materialsNetValue + hoursNetValue + visitNetValue
    const totalIvaPercent = totalNetValue > 0 ? (totalIvaValue / totalNetValue) * 100 : 0

    return {
      materialsValue,
      materialsNetValue,
      materialsBaseValue,
      materialsProfitValue,
      materialsIvaValue,
      materialsIvaPercent,
      hoursValue,
      hoursNetValue,
      hoursBaseValue,
      hoursProfitValue,
      hoursIvaValue,
      hoursIvaPercent,
      visitPrice,
      visitValue,
      visitBaseValue,
      visitNetValue,
      visitProfitValue,
      visitIvaValue,
      visitIvaPercent,
      totalProfitValue,
      totalIvaValue,
      totalIvaPercent,
      additionalVisitCount,
      estimatedHours,
    }
  }

  const getQuoteDisplayTotal = (quote: any) => {
    const pricing = getQuotePricing(quote?.feedback, quote?.service)
    return pricing.materialsValue + pricing.visitValue + pricing.hoursValue
  }

  const getQuoteNetTotal = (quote: any) => {
    const pricing = getQuotePricing(quote?.feedback, quote?.service)
    return pricing.materialsNetValue + pricing.visitNetValue + pricing.hoursNetValue
  }

  const getQuoteMaterials = (feedbackValue: unknown) => {
    const feedback = parseFeedback(feedbackValue)

    const directItems = Array.isArray(feedback?.materials?.items)
      ? feedback.materials.items
      : Array.isArray(feedback?.materials)
        ? feedback.materials
        : []

    if (directItems.length > 0) {
      return directItems.map((item: any, index: number) => {
        const quantity = Number(item?.quantity ?? item?.qty ?? 1)
        const unitPrice = resolveMaterialPrice(item)
        const unitNetPrice = resolveMaterialNetPrice(item)

        return {
          key: `${item?.id || item?.name || item?.material || index}`,
          name: item?.name || item?.material || item?.id || `Material ${index + 1}`,
          quantity,
          price: unitPrice,
          netPrice: unitNetPrice,
        }
      })
    }

    const missingMaterials = Array.isArray(feedback?.missingMaterials)
      ? feedback.missingMaterials
      : Array.isArray(feedback?.rejectionFeedback?.missingMaterials)
        ? feedback.rejectionFeedback.missingMaterials
        : []

    if (missingMaterials.length > 0) {
      return missingMaterials.map((item: any, index: number) => {
        const quantity = Number(item?.quantity ?? item?.qty ?? 1)
        const unitPrice = resolveMaterialPrice(item)
        const unitNetPrice = resolveMaterialNetPrice(item)

        return {
          key: `${item?.id || item?.name || index}`,
          name: item?.name || item?.material || item?.id || `Material ${index + 1}`,
          quantity,
          price: unitPrice,
          netPrice: unitNetPrice,
        }
      })
    }

    return []
  }

  const renderClientPreviewModal = (quote: any) => {
    const feedback = parseFeedback(quote.feedback)
    const estimatedHoursForPreview = editableEstimatedHours != null
      ? editableEstimatedHours
      : Number(feedback?.estimatedHours ?? quote.estimatedHours ?? 0)
    const feedbackForPricing = feedback
      ? { ...feedback, estimatedHours: estimatedHoursForPreview, details: editableReviewDescription }
      : { estimatedHours: estimatedHoursForPreview, details: editableReviewDescription }
    const pricing = getQuotePricing(feedbackForPricing, quote.service)
    const hourValue = getServiceHourValue(quote.service)
    const serviceConfig = servicesConfig.find((service: any) => {
      const normalizedService = String(quote.service ?? '').trim().toLowerCase()
      const name = String(service?.name ?? '').trim().toLowerCase()
      const short = String(service?.short ?? '').trim().toLowerCase()
      return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
    })
    const hourValueWithMarkup = applyMarkup(hourValue, Number(serviceConfig?.hourMarkupPercent ?? 0))
    const materials = editableMaterials.length > 0 ? editableMaterials : getQuoteMaterials(quote.feedback)
    const additionalConceptTotals = editableAdditionalBlocks.reduce(
      (acc, block) => {
        const subtotal = (Number(block.unitPrice) || 0) * (Number(block.quantity) || 0)
        const withMarkup = subtotal * (1 + (Number(block.markupPercent) || 0) / 100)
        const iva = withMarkup * (Number(block.ivaPercent) || 0) / 100
        return {
          subtotal: acc.subtotal + subtotal,
          withMarkup: acc.withMarkup + withMarkup,
          iva: acc.iva + iva,
          total: acc.total + withMarkup + iva,
        }
      },
      { subtotal: 0, withMarkup: 0, iva: 0, total: 0 },
    )
    const totalNetValue = pricing.materialsNetValue + pricing.visitNetValue + pricing.hoursNetValue + additionalConceptTotals.withMarkup
    const totalIvaBeforeDiscount = pricing.totalIvaValue + additionalConceptTotals.iva
    const applicablePromotions = getApplicablePromotions(promotionsConfig, new Date(), serviceConfig?.id)
    const selectedPromotion = selectedPromotionId
      ? promotionsConfig.find((promotion: any) => promotion.id === selectedPromotionId)
      : null
    const discountAmount = selectedPromotion
      ? computeBestPromotionDiscount(totalNetValue, [selectedPromotion], new Date(), serviceConfig?.id).discount
      : 0
    const discountedNetValue = Math.max(0, totalNetValue - discountAmount)
    const discountedIva = totalIvaBeforeDiscount
    const totalGrossAfterDiscount = discountedNetValue + discountedIva

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
        <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
<div className="flex items-center justify-between border-b border-border px-6 py-4 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Vista previa cliente</p>
                <h3 className="text-xl font-semibold">{quote.client}</h3>
                <p className="text-sm text-muted-foreground">{quote.service}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewQuoteOpen(false)}
                  className="rounded-full border border-border bg-background px-3 py-2 text-sm font-medium"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={sendingQuote || String(quote.status ?? '').toLowerCase() === 'cotizado'}
                  onClick={() => sendQuoteToClient(quote, {
                    estimatedHours: estimatedHoursForPreview,
                    details: editableReviewDescription,
                    materials: editableMaterials.length > 0 ? editableMaterials : undefined,
                    additionalBlocks: editableAdditionalBlocks,
                    selectedPromotionId,
                  })}
                  className="rounded-full border border-primary bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {String(quote.status ?? '').toLowerCase() === 'cotizado'
                    ? 'Enviada al cliente'
                    : sendingQuote
                      ? 'Enviando...'
                      : 'Enviar a cliente'}
                </button>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-background/70 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Descripción de la revisión</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{editableReviewDescription || feedback?.details || feedback?.description || quote.notes || 'Sin descripción'}</p>
              </div>

              <div className="rounded-2xl border border-border bg-background/70 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detalle</p>
                  <span className="text-xs text-muted-foreground">{estimatedHoursForPreview} h x {formatCLP(hourValueWithMarkup)}</span>
                </div>
                <div className="mt-4 space-y-3 text-sm text-foreground">
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                    <span>Horas de trabajo</span>
                    <span>{formatCLP(applyMarkupAndIva(estimatedHoursForPreview * hourValue, Number(serviceConfig?.hourMarkupPercent ?? 0), Number(serviceConfig?.hourIvaPercent ?? 0)))}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                    <span>Materiales</span>
                    <span>{formatCLP(pricing.materialsValue)}</span>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">Materiales incluidos</p>
                    <div className="mt-3 space-y-2">
                      {materials.map((item: any) => (
                        <div key={item.rowId ?? item.id ?? item.key} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-sm">
                          <div>
                            <div className="font-medium text-foreground">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{formatCLP(item.price ?? item.netPrice ?? 0)} c/u</div>
                          </div>
                          <span className="text-muted-foreground">x {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">Conceptos adicionales</p>
                    {editableAdditionalBlocks.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {editableAdditionalBlocks.map((block) => {
                          const subtotal = (Number(block.unitPrice) || 0) * (Number(block.quantity) || 0)
                          const withMarkup = subtotal * (1 + (Number(block.markupPercent) || 0) / 100)
                          const ivaAmount = withMarkup * (Number(block.ivaPercent) || 0) / 100
                          const blockTotal = withMarkup + ivaAmount

                          return (
                            <div key={block.id} className="rounded-xl border border-border bg-background px-3 py-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium text-foreground">{block.name || 'Concepto adicional'}</div>
                                  <div className="text-xs text-muted-foreground">{formatCLP(block.unitPrice)} c/u × {block.quantity}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Total</div>
                                  <div className="font-semibold text-foreground">{formatCLP(blockTotal)}</div>
                                </div>
                              </div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
                                <span>Ganancia: {formatCLP(withMarkup - subtotal)}</span>
                                <span>IVA: {formatCLP(ivaAmount)}</span>
                                <span>Subtotal: {formatCLP(subtotal)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">No hay conceptos adicionales agregados.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/70 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Promociones</p>
                <div className="mt-3 space-y-3 text-sm text-foreground">
                  {selectedPromotion ? (
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="font-semibold text-foreground">Promoción aplicada</p>
                      <p className="mt-1 text-xs text-muted-foreground">{selectedPromotion.description || 'Sin descripción'}</p>
                      <p className="mt-3 text-xs text-muted-foreground">Descuento: {formatCLP(discountAmount)}</p>
                    </div>
                  ) : applicablePromotions.length > 0 ? (
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="font-semibold text-foreground">Promociones activas</p>
                      <p className="mt-1 text-xs text-muted-foreground">Se encontraron promociones vigentes para este servicio.</p>
                      <ul className="mt-3 space-y-2">
                        {applicablePromotions.map((promotion: any) => (
                          <li key={promotion.id} className="rounded-lg border border-border bg-background px-3 py-2">
                            <div className="font-medium text-foreground">{promotion.name || 'Promoción sin nombre'}</div>
                            <div className="text-xs text-muted-foreground">{promotion.description || 'Sin descripción'}</div>
                            <div className="mt-1 text-xs text-muted-foreground">Descuento: {formatCLP(totalNetValue - applyPromotionToAmount(totalNetValue, promotion))}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="font-semibold text-foreground">No hay promociones activas</p>
                      <p className="mt-1 text-xs text-muted-foreground">No hay promociones vigentes para este servicio en la fecha actual.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total neto</p>
                  <p className="mt-3 text-2xl font-bold text-primary">{formatCLP(pricing.materialsNetValue + pricing.visitNetValue + pricing.hoursNetValue + additionalConceptTotals.withMarkup)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total IVA</p>
                  <p className="mt-3 text-2xl font-bold text-primary">{formatCLP(pricing.totalIvaValue + additionalConceptTotals.iva)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total cotización</p>
                  <p className="mt-3 text-2xl font-bold text-primary">{formatCLP(discountAmount > 0 ? totalGrossAfterDiscount : pricing.materialsValue + pricing.visitValue + pricing.hoursValue + additionalConceptTotals.total)}</p>
                  {discountAmount > 0 ? (
                    <p className="mt-2 text-sm text-secondary">Incluye descuento de {formatCLP(discountAmount)} aplicado sobre el total antes de IVA.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderSelectedQuoteModal = () => {
    if (!selectedQuote) return null

    const feedback = parseFeedback(selectedQuote.feedback)
    const estimatedHours = editableEstimatedHours != null
      ? editableEstimatedHours
      : Number(feedback?.estimatedHours ?? selectedQuote.estimatedHours ?? 0)
    const feedbackForPricing = feedback
      ? { ...feedback, estimatedHours }
      : { estimatedHours }
    const pricing = getQuotePricing(feedbackForPricing, selectedQuote.service)
    const serviceConfig = servicesConfig.find((service: any) => {
      const normalizedService = String(selectedQuote.service ?? '').trim().toLowerCase()
      const name = String(service?.name ?? '').trim().toLowerCase()
      const short = String(service?.short ?? '').trim().toLowerCase()
      return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
    })
    const hourValue = getServiceHourValue(selectedQuote.service)
    const hourValueWithMarkup = applyMarkup(hourValue, Number(serviceConfig?.hourMarkupPercent ?? 0))
    const estimatedAmount = Number(estimatedHours) > 0
      ? applyMarkupAndIva(Number(estimatedHours) * hourValue, Number(serviceConfig?.hourMarkupPercent ?? 0), Number(serviceConfig?.hourIvaPercent ?? 0))
      : 0

    const additionalConceptTotals = editableAdditionalBlocks.reduce(
      (acc, block) => {
        const subtotal = (Number(block.unitPrice) || 0) * (Number(block.quantity) || 0)
        const withMarkup = subtotal * (1 + (Number(block.markupPercent) || 0) / 100)
        const iva = withMarkup * (Number(block.ivaPercent) || 0) / 100
        return {
          subtotal: acc.subtotal + subtotal,
          withMarkup: acc.withMarkup + withMarkup,
          iva: acc.iva + iva,
          total: acc.total + withMarkup + iva,
        }
      },
      { subtotal: 0, withMarkup: 0, iva: 0, total: 0 },
    )
    const totalNetValue = pricing.materialsNetValue + pricing.visitNetValue + pricing.hoursNetValue + additionalConceptTotals.withMarkup
    const totalIvaBeforeDiscount = pricing.totalIvaValue + additionalConceptTotals.iva
    const applicablePromotions = getApplicablePromotions(promotionsConfig, new Date(), serviceConfig?.id)
    const selectedPromotion = selectedPromotionId
      ? promotionsConfig.find((promotion: any) => promotion.id === selectedPromotionId)
      : null
    const discountAmount = selectedPromotion
      ? computeBestPromotionDiscount(totalNetValue, [selectedPromotion], new Date(), serviceConfig?.id).discount
      : 0
    const discountedNetValue = Math.max(0, totalNetValue - discountAmount)
    const discountedIva = totalIvaBeforeDiscount
    const totalGrossAfterDiscount = discountedNetValue + discountedIva
    const additionalConceptProfit = additionalConceptTotals.withMarkup - additionalConceptTotals.subtotal

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
        <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <p className="text-sm text-muted-foreground">{selectedQuote.id} · {selectedQuote.date}</p>
              <h3 className="text-xl font-semibold">{selectedQuote.client}</h3>
              <p className="text-sm text-muted-foreground">{selectedQuote.service}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', styles[selectedQuote.status])}>
                {selectedQuote.status}
              </span>
              <button
                type="button"
                onClick={() => setSelectedQuote(null)}
                className="rounded-full border border-border bg-background px-3 py-2 text-sm font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Descripción de la revisión</p>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Editable</span>
                  </div>
                  <textarea
                    value={editableReviewDescription}
                    onChange={(event) => setEditableReviewDescription(event.target.value)}
                    className="mt-3 min-h-[120px] w-full rounded-xl border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
                    placeholder="Edita la descripción de la revisión aquí"
                  />
                </div>

                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Materiales colocados en la revisión</p>
                  {(() => {
                    const materials = getQuoteMaterials(selectedQuote.feedback)
                    return materials.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {materials.map((item: any) => (
                          <li key={item.key} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-sm">
                            <div>
                              <div className="text-foreground">{item.name}</div>
                              {Number(item.netPrice || 0) > 0 ? (
                                <div className="text-xs text-muted-foreground">{formatCLP(Number(item.netPrice))} c/u</div>
                              ) : null}
                            </div>
                            {typeof item.quantity === 'number' ? <span className="text-muted-foreground">x{item.quantity}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">No se registraron materiales en esta revisión.</p>
                    )
                  })()}
                </div>

                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Horas de trabajo</p>
                  <div className="mt-3 rounded-xl border border-border bg-card px-3 py-3 text-sm">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center">
                      <div>
                        <div className="text-foreground">Valor por hora</div>
                        <div className="text-xs text-muted-foreground">{formatCLP(hourValueWithMarkup)} c/u</div>
                      </div>
                      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                        <span>Cantidad de horas</span>
                        <input
                          type="number"
                          min="0"
                          value={estimatedHours ?? 0}
                          onChange={(event) => setEditableEstimatedHours(Number(event.target.value))}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Movilización</p>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-sm">
                    <div>
                      <div className="text-foreground">Valor por movilización</div>
                      <div className="text-xs text-muted-foreground">{formatCLP(pricing.visitValue)} c/u</div>
                    </div>
                    <span className="text-muted-foreground">x {pricing.additionalVisitCount > 0 ? pricing.additionalVisitCount + 1 : 1} movilización{pricing.additionalVisitCount + 1 > 1 ? 'es' : ''}</span>
                  </div>
                </div>
                {editableAdditionalBlocks.map((block, index) => {
                  const subtotal = (Number(block.unitPrice) || 0) * (Number(block.quantity) || 0)
                  const withMarkup = subtotal * (1 + (Number(block.markupPercent) || 0) / 100)
                  const ivaAmount = withMarkup * (Number(block.ivaPercent) || 0) / 100
                  const blockTotal = withMarkup + ivaAmount

                  return (
                    <div key={block.id} className="rounded-2xl border border-border bg-background/70 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {block.name || `Concepto adicional ${index + 1}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditableAdditionalBlocks((prev) => prev.filter((item) => item.id !== block.id))}
                          className="rounded-full border border-destructive/20 bg-destructive/5 px-3 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                        >
                          Eliminar
                        </button>
                      </div>
                      <div className="mt-3 rounded-xl border border-border bg-card px-3 py-3 text-sm">
                        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                          <div className="min-w-0 space-y-3">
                            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                              <span>Material</span>
                              <select
                                value={block.materialId ?? ''}
                                onChange={(event) => {
                                  const selectedId = event.target.value
                                  const matchedMaterial = materialsConfig.find((material) => String(material.id) === selectedId)
                                  setEditableAdditionalBlocks((prev) =>
                                    prev.map((item) =>
                                      item.id === block.id
                                        ? {
                                            ...item,
                                            materialId: selectedId,
                                            name: matchedMaterial?.name ?? item.name,
                                            unit: matchedMaterial?.unit ?? item.unit ?? '',
                                            unitPrice: Number(matchedMaterial?.price ?? item.unitPrice ?? 0),
                                            markupPercent: Number(matchedMaterial?.markupPercent ?? item.markupPercent ?? 0),
                                            ivaPercent: Number(matchedMaterial?.ivaPercent ?? item.ivaPercent ?? 0),
                                          }
                                        : item,
                                    ),
                                  )
                                }}
                                className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                              >
                                <option value="">Seleccionar material</option>
                                {materialsConfig.map((material) => (
                                  <option key={material.id} value={material.id}>
                                    {material.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <input
                              value={block.name}
                              onChange={(event) =>
                                setEditableAdditionalBlocks((prev) =>
                                  prev.map((item) =>
                                    item.id === block.id ? { ...item, name: event.target.value } : item,
                                  ),
                                )
                              }
                              className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                              placeholder="Nombre del bloque"
                            />
                            <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                              <label className="flex items-center gap-1">
                                <span>Precio</span>
                                <input
                                  type="number"
                                  value={block.unitPrice}
                                  min="0"
                                  onChange={(event) =>
                                    setEditableAdditionalBlocks((prev) =>
                                      prev.map((item) =>
                                        item.id === block.id
                                          ? ({ ...item, unitPrice: Number(event.target.value) } as AdditionalQuoteBlock)
                                          : item,
                                      ),
                                    )
                                  }
                                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                                />
                              </label>
                              <label className="flex items-center gap-1">
                                <span>Cant.</span>
                                <input
                                  type="number"
                                  value={block.quantity}
                                  min="0"
                                  onChange={(event) =>
                                    setEditableAdditionalBlocks((prev) =>
                                      prev.map((item) =>
                                        item.id === block.id
                                          ? ({ ...item, quantity: Number(event.target.value) } as AdditionalQuoteBlock)
                                          : item,
                                      ),
                                    )
                                  }
                                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                                />
                              </label>
                              <label className="flex items-center gap-1">
                                <span>Ganancia %</span>
                                <input
                                  type="number"
                                  value={block.markupPercent}
                                  min="0"
                                  onChange={(event) =>
                                    setEditableAdditionalBlocks((prev) =>
                                      prev.map((item) =>
                                        item.id === block.id
                                          ? ({ ...item, markupPercent: Number(event.target.value) } as AdditionalQuoteBlock)
                                          : item,
                                      ),
                                    )
                                  }
                                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                                />
                              </label>
                              <label className="flex items-center gap-1">
                                <span>IVA %</span>
                                <input
                                  type="number"
                                  value={block.ivaPercent}
                                  min="0"
                                  onChange={(event) =>
                                    setEditableAdditionalBlocks((prev) =>
                                      prev.map((item) =>
                                        item.id === block.id
                                          ? ({ ...item, ivaPercent: Number(event.target.value) } as AdditionalQuoteBlock)
                                          : item,
                                      ),
                                    )
                                  }
                                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                                />
                              </label>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Subtotal</div>
                            <div className="mt-1 text-base font-semibold text-foreground">{formatCLP(subtotal)}</div>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <p>Ganancia: {formatCLP(withMarkup - subtotal)}</p>
                              <p>IVA: {formatCLP(ivaAmount)}</p>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">Total</div>
                            <div className="text-lg font-semibold text-foreground">{formatCLP(blockTotal)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Promociones</p>
                  <div className="mt-3 space-y-3">
                    {applicablePromotions.length > 0 ? (
                      <div className="rounded-xl border border-border bg-card p-3 text-sm">
                        <p className="font-semibold text-foreground">Promociones activas</p>
                        <p className="mt-1 text-xs text-muted-foreground">Estas promociones se aplican hoy al servicio seleccionado.</p>
                        <ul className="mt-3 space-y-2">
                          {applicablePromotions.map((promotion: any) => (
                            <li key={promotion.id} className="rounded-lg border border-border bg-background px-3 py-2">
                              <div className="font-medium text-foreground">{promotion.name || 'Promoción sin nombre'}</div>
                              <div className="text-xs text-muted-foreground">{promotion.description || 'Sin descripción'}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-card p-3 text-sm">
                        <p className="font-semibold text-foreground">No hay promociones activas</p>
                        <p className="mt-1 text-xs text-muted-foreground">Las promociones configuradas no coinciden con este servicio o no están vigentes.</p>
                      </div>
                    )}
                    <label className="block text-sm text-foreground">
                      <span className="text-xs text-muted-foreground">Seleccionar promoción</span>
                      <select
                        value={selectedPromotionId ?? ''}
                        onChange={(event) => setSelectedPromotionId(event.target.value || null)}
                        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        <option value="">Ninguna promoción</option>
                        {applicablePromotions.map((promotion: any) => (
                          <option key={promotion.id} value={promotion.id}>
                            {promotion.name || 'Promoción sin nombre'}{promotion.applyTo === 'service' ? ' (Servicio)' : ' (Total)'}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedPromotionId ? (
                      <div className="rounded-xl border border-border bg-card p-3 text-sm">
                        {(() => {
                          const promo = promotionsConfig.find((promotion: any) => promotion.id === selectedPromotionId)
                          return promo ? (
                            <>
                              <p className="font-semibold text-foreground">{promo.name || 'Promoción seleccionada'}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{promo.description || 'Sin descripción'}</p>
                              <p className="mt-3 text-xs text-muted-foreground">Descuento: {formatCLP(totalNetValue - applyPromotionToAmount(totalNetValue, promo))}</p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Promoción no encontrada.</p>
                          )
                        })()}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No se ha seleccionado ninguna promoción.</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setEditableAdditionalBlocks((prev) => [
                        ...prev,
                        {
                          id: `additional-${prev.length}`,
                          materialId: '',
                          name: 'Concepto adicional',
                          unit: '',
                          unitPrice: 0,
                          quantity: 1,
                          markupPercent: 0,
                          ivaPercent: 0,
                        },
                      ])
                    }
                    className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
                  >
                    Agregar concepto
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewQuoteOpen(true)}
                    className="inline-flex items-center rounded-full border border-primary bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
                  >
                    Vista previa cliente
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Movilización</p>
                  <p className="mt-3 font-display text-2xl font-bold text-primary">{formatCLP(pricing.visitValue)}</p>
                  {pricing.additionalVisitCount > 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">Incluye {pricing.additionalVisitCount} visita adicional{pricing.additionalVisitCount > 1 ? 's' : ''} por exceder las 8 horas.</p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">1 visita base</p>
                  )}
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Valor de materiales</p>
                  <p className="mt-3 font-display text-2xl font-bold text-primary">{formatCLP(pricing.materialsValue)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Monto estimado por horas</p>
                  <p className="mt-3 font-display text-2xl font-bold text-primary">{formatCLP(estimatedAmount)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Conceptos adicionales</p>
                  <p className="mt-3 font-display text-2xl font-bold text-primary">{formatCLP(additionalConceptTotals.total)}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {editableAdditionalBlocks.length} concepto adicional{editableAdditionalBlocks.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ganancia estimada</p>
                  <p className="mt-3 font-display text-2xl font-bold text-primary">{formatCLP(pricing.totalProfitValue + additionalConceptProfit)}</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Materiales: {formatCLP(pricing.materialsProfitValue)}</p>
                    <p>Horas: {formatCLP(pricing.hoursProfitValue)}</p>
                    <p>Visita: {formatCLP(pricing.visitProfitValue)}</p>
                    <p>Adicionales: {formatCLP(additionalConceptProfit)}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total neto</p>
                  <p className="mt-3 font-display text-2xl font-bold text-primary">{formatCLP(pricing.materialsNetValue + pricing.visitNetValue + pricing.hoursNetValue + additionalConceptTotals.withMarkup)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total IVA</p>
                  <p className="mt-3 font-display text-2xl font-bold text-primary">{formatCLP(pricing.totalIvaValue + additionalConceptTotals.iva)}</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Total IVA %: {(((pricing.totalIvaValue + additionalConceptTotals.iva) / (pricing.materialsNetValue + pricing.visitNetValue + pricing.hoursNetValue + additionalConceptTotals.withMarkup)) * 100 || 0).toFixed(1)}%</p>
                    <p>IVA materiales: {formatCLP(pricing.materialsIvaValue)} ({pricing.materialsIvaPercent.toFixed(1)}%)</p>
                    <p>IVA horas: {formatCLP(pricing.hoursIvaValue)} ({pricing.hoursIvaPercent.toFixed(1)}%)</p>
                    <p>IVA visita: {formatCLP(pricing.visitIvaValue)} ({pricing.visitIvaPercent.toFixed(1)}%)</p>
                    <p>IVA adicionales: {formatCLP(additionalConceptTotals.iva)} ({editableAdditionalBlocks.length > 0 ? `${(additionalConceptTotals.iva > 0 && additionalConceptTotals.withMarkup > 0 ? ((additionalConceptTotals.iva / additionalConceptTotals.withMarkup) * 100).toFixed(1) : '0')}%` : '0%'})</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total bruto con IVA</p>
                  <p className="mt-3 font-display text-2xl font-bold text-primary">{formatCLP(pricing.materialsValue + pricing.visitValue + pricing.hoursValue + additionalConceptTotals.total)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const visibleQuoteGroups = useMemo(
    () => quoteGroups.filter((group) => quoteFilter === 'all' || group.status === quoteFilter),
    [quoteGroups, quoteFilter],
  )

  const hasVisibleQuotes = visibleQuoteGroups.some((group) => group.items.length > 0)

  return (
    <div>
      <PageTitle title="Cotizaciones" subtitle="Propuestas enviadas a clientes" />
      <div className="mb-4 flex flex-wrap gap-2">
        {quoteStatusFilterOptions.map((value) => {
          const count = value === 'all'
            ? quoteGroups.reduce((sum, group) => sum + group.items.length, 0)
            : quoteGroups.find((group) => group.status === value)?.items.length ?? 0

          return (
            <button
              key={value}
              type="button"
              onClick={() => setQuoteFilter(value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition',
                quoteFilter === value
                  ? 'border border-primary/30 bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:bg-secondary/10',
              )}
            >
              {value === 'all'
                ? `Todas (${count})`
                : `${getQuoteStatusLabel(value)} (${count})`}
            </button>
          )
        })}
      </div>
      <div className="space-y-6">
        {!hasVisibleQuotes ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <ClipboardList className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">No hay cotizaciones con esos filtros</p>
          </div>
        ) : (
          visibleQuoteGroups.map((group) => (
            <div key={group.status}>
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-background/80 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{getQuoteStatusLabel(group.status)}</p>
                  <p className="text-xs text-muted-foreground">{quoteStatusSummary(group.status, group.items.length)}</p>
                </div>
                <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', styles[group.status])}>
                  {getQuoteStatusLabel(group.status)}
                </span>
              </div>

              {group.items.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {group.items.map((q) => {
                    const feedback = parseFeedback(q.feedback)
                    const reviewDescription = feedback?.details || feedback?.description || q.notes || 'Sin descripción de revisión.'
                    const quoteState = deriveQuoteState(q)

                    return (
                      <div
                        key={q.id}
                        className="cursor-pointer rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-accent/10"
                        onClick={() => setSelectedQuote(q)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">{q.id} · {q.date}</p>
                            <p className="mt-0.5 font-semibold">{q.client}</p>
                            <p className="text-sm text-muted-foreground">{q.service}</p>
                          </div>
                          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', styles[quoteState])}>
                            {getQuoteStatusLabel(quoteState)}
                          </span>
                        </div>

                        <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm text-muted-foreground">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Descripción de la revisión</p>
                            <p className="mt-1 text-sm leading-relaxed text-foreground">{reviewDescription}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                          <span className="text-xs text-muted-foreground">Toca para abrir en pantalla completa</span>
                          <span className="font-display text-lg font-bold text-primary">
                            {formatCLP(getQuoteDisplayTotal(q))}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
                  No hay cotizaciones en esta categoría.
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {renderSelectedQuoteModal()}
      {previewQuoteOpen && selectedQuote ? renderClientPreviewModal(selectedQuote) : null}
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

  const pendingOrders = visibleOrders.filter((o) => {
    const status = String(o.estado || o.status || '').toLowerCase()
    return ['pendiente', 'en camino', 'en proceso', 'cotizando', 'cotizado', 'recotizando', 'aceptada', 'pendiente_pago', 'por_validar', 'en revision', 'en revisión', 'en_reclamo'].includes(status)
  })

  const canceledOrders = visibleOrders.filter((o) => normalizeBillingStatus(o.estado || o.status) === 'cancelada')

  const totalRevenue = paidOrders.reduce((sum, o) => {
    const amount = Number(o.precio ?? o.price ?? o.total ?? o.amount ?? 0)
    return sum + (Number.isNaN(amount) ? 0 : amount)
  }, 0)

  const completedJobs = paidOrders.length
  const nonCanceledOrders = visibleOrders.filter((o) => normalizeBillingStatus(o.estado || o.status) !== 'cancelada')
  const totalOrders = nonCanceledOrders.length
  const paymentRate = totalOrders ? Math.round((completedJobs / totalOrders) * 100) : 0
  const averageTicket = completedJobs ? totalRevenue / completedJobs : 0
  const openOrders = pendingOrders.length

  const stats = [
    { label: 'Ingresos pagados', value: formatCLP(totalRevenue), hint: 'Cobranza cerrada' },
    { label: 'Trabajos completados', value: String(completedJobs), hint: 'Órdenes cerradas' },
    { label: 'Órdenes abiertas', value: String(openOrders), hint: 'En curso o pendientes' },
    { label: 'Ticket promedio', value: formatCLP(averageTicket), hint: 'Promedio por trabajo' },
    { label: 'Tasa de pago', value: `${paymentRate}%`, hint: 'Cobertura de pagos' },
    { label: 'Canceladas', value: String(canceledOrders.length), hint: 'Órdenes anuladas' },
  ]

  const bottlenecks = useMemo(() => {
    const buckets = visibleOrders.reduce<Record<string, { count: number; ageDays: number[] }>>((acc, order) => {
      const state = String(order.estado || order.status || 'pendiente').toLowerCase().trim()
      const bucket = getStatusBucket(state)
      const existing = acc[bucket] ?? { count: 0, ageDays: [] }
      const date = parseOrderDate(order)
      const ageDays = date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))) : 0
      existing.count += 1
      existing.ageDays.push(ageDays)
      acc[bucket] = existing
      return acc
    }, {})

    return Object.entries(buckets)
      .filter(([bucket]) => !['Cerradas', 'Canceladas', 'Otros'].includes(bucket))
      .map(([bucket, data]) => ({
        bucket,
        count: data.count,
        averageAge: Math.round(data.ageDays.reduce((sum, age) => sum + age, 0) / Math.max(1, data.ageDays.length)),
      }))
      .sort((a, b) => b.count - a.count || b.averageAge - a.averageAge)
  }, [visibleOrders])

  return (
    <div className="space-y-4">
      <PageTitle title="Reportes y estadísticas" subtitle="Vista ejecutiva del rendimiento del negocio" />

      <div className="flex flex-wrap gap-2">
        {(['all', 'pagada', 'pendiente', 'cancelada'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setReportFilter(value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              reportFilter === value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">{item.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold">Evolución de ingresos</p>
            <span className="text-sm text-muted-foreground">Último periodo</span>
          </div>
          <RevenueChart orders={visibleOrders} />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-4 font-semibold">Trabajos por tipo</p>
            <JobsChart orders={visibleOrders} />
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-4 font-semibold">Estados del flujo</p>
            <SegmentsChart orders={visibleOrders} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold">Cuellos de botella</p>
          <span className="text-sm text-muted-foreground">Estados que más acumulan trabajo</span>
        </div>
        <div className="space-y-3">
          {bottlenecks.map((item) => (
            <div key={item.bucket} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-3">
              <div>
                <p className="font-medium text-foreground">{item.bucket}</p>
                <p className="text-sm text-muted-foreground">
                  {item.count === 1 ? '1 pedido acumulado' : `${item.count} pedidos acumulados`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">{item.averageAge} días</p>
                <p className="text-xs text-muted-foreground">promedio abierto</p>
              </div>
            </div>
          ))}
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
  const [materialCategory, setMaterialCategory] = useState<string>('Todos')
  const [showGlobalMarkup, setShowGlobalMarkup] = useState(false)
  const [globalMarkup, setGlobalMarkup] = useState<string>('0')

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
      services: [...(settings.services ?? []), { id: `nuevo-${Date.now()}`, name: 'Nuevo servicio', short: 'Nuevo', description: '', from: 0, visitPrice: 12000, hourValue: 0, hourMarkupPercent: 0, hourIvaPercent: 19, markupPercent: 0, ivaPercent: 19, emergency: false, visibleToClient: true }],
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

  const materialCategories: string[] = Array.from(
    new Set<string>((settings?.materials ?? []).map((material: any) => String(material.category || 'Otros'))),
  ).sort()
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

  const toNumber = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  type ServiceTotalsItem = {
    subtotalWithoutIva: number
    totalService: number
    hourSubtotalWithoutIva: number
    totalHour: number
  }

  const serviceTotals: ServiceTotalsItem[] = (settings.services ?? []).map((service: any) => {
    const base = toNumber(service?.from)
    const visit = toNumber(service?.visitPrice)
    const subtotal = base + visit
    const markupPercent = toNumber(service?.markupPercent)
    const ivaPercent = toNumber(service?.ivaPercent)

    const subtotalWithMarkup = subtotal * (1 + markupPercent / 100)
    const totalService = subtotalWithMarkup * (1 + ivaPercent / 100)
    const subtotalWithoutIva = subtotalWithMarkup

    const hourValue = toNumber(service?.hourValue)
    const hourMarkupPercent = toNumber(service?.hourMarkupPercent)
    const hourIvaPercent = toNumber(service?.hourIvaPercent)
    const hourSubtotalWithMarkup = hourValue * (1 + hourMarkupPercent / 100)
    const totalHour = hourSubtotalWithMarkup * (1 + hourIvaPercent / 100)
    const hourSubtotalWithoutIva = hourSubtotalWithMarkup

    return { subtotalWithoutIva, totalService, hourSubtotalWithoutIva, totalHour }
  })

  const totalServicesValue = serviceTotals.reduce<number>((sum: number, item: ServiceTotalsItem) => sum + item.totalService, 0)
  const totalServicesSubtotalValue = serviceTotals.reduce<number>((sum: number, item: ServiceTotalsItem) => sum + item.subtotalWithoutIva, 0)
  const totalHoursValue = serviceTotals.reduce<number>((sum: number, item: ServiceTotalsItem) => sum + item.totalHour, 0)
  const totalHoursSubtotalValue = serviceTotals.reduce<number>((sum: number, item: ServiceTotalsItem) => sum + item.hourSubtotalWithoutIva, 0)

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
                <p className="text-sm text-muted-foreground">Modifica nombre, precio base, valor hora y sus propios porcentajes de ganancia e IVA.</p>
              </div>
              <button onClick={addService} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
                <Plus className="size-4" /> Agregar
              </button>
            </div>
            <div className="mb-4 rounded-xl border border-border bg-background/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Totales dinámicos</p>
                  <p className="text-sm text-muted-foreground">Se recalculan automáticamente con los valores que ingreses en cada servicio.</p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="rounded-lg border border-border bg-card px-3 py-2">
                    <span className="block text-xs text-muted-foreground">Subtotal servicios</span>
                    <span className="font-semibold">{formatCLP(totalServicesSubtotalValue)}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-card px-3 py-2">
                    <span className="block text-xs text-muted-foreground">Total servicios</span>
                    <span className="font-semibold">{formatCLP(totalServicesValue)}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-card px-3 py-2">
                    <span className="block text-xs text-muted-foreground">Subtotal valor hora</span>
                    <span className="font-semibold">{formatCLP(totalHoursSubtotalValue)}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-card px-3 py-2">
                    <span className="block text-xs text-muted-foreground">Total valor hora</span>
                    <span className="font-semibold">{formatCLP(totalHoursValue)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {(settings.services ?? []).map((service: any, index: number) => {
                const totals = serviceTotals[index] ?? { totalService: 0, totalHour: 0 }
                return (
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
                      <span className="mb-1 block text-muted-foreground">Valor hora</span>
                      <input type="number" step="0.1" value={service.hourValue ?? 0} onChange={(e) => updateServiceField(index, 'hourValue', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
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
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">Ganancia % hora</span>
                      <input type="number" value={service.hourMarkupPercent ?? 0} onChange={(e) => updateServiceField(index, 'hourMarkupPercent', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block text-muted-foreground">IVA % hora</span>
                      <input type="number" step="0.1" value={service.hourIvaPercent ?? 19} onChange={(e) => updateServiceField(index, 'hourIvaPercent', Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                    </label>
                  </div>
                  <label className="mt-3 block text-sm">
                    <span className="mb-1 block text-muted-foreground">Descripción</span>
                    <textarea value={service.description || ''} onChange={(e) => updateServiceField(index, 'description', e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} />
                  </label>
                  <div className="mt-3 grid gap-3 rounded-lg border border-border/70 bg-background/70 p-3 md:grid-cols-4">
                    <div className="rounded-lg border border-border bg-card px-3 py-2">
                      <div className="text-xs text-muted-foreground">Subtotal servicio</div>
                      <div className="text-sm font-semibold">{formatCLP(totals.subtotalWithoutIva)}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-3 py-2">
                      <div className="text-xs text-muted-foreground">Total servicio</div>
                      <div className="text-sm font-semibold">{formatCLP(totals.totalService)}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-3 py-2">
                      <div className="text-xs text-muted-foreground">Subtotal valor hora</div>
                      <div className="text-sm font-semibold">{formatCLP(totals.hourSubtotalWithoutIva)}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-3 py-2">
                      <div className="text-xs text-muted-foreground">Total valor hora</div>
                      <div className="text-sm font-semibold">{formatCLP(totals.totalHour)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input type="checkbox" checked={!!service.emergency} onChange={(e) => updateServiceField(index, 'emergency', e.target.checked)} />
                      Disponible como emergencia
                    </label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input type="checkbox" checked={service.visibleToClient !== false} onChange={(e) => updateServiceField(index, 'visibleToClient', e.target.checked)} />
                      Visible para clientes
                    </label>
                  </div>
                </div>
                )
              })}
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
  type ChecklistItemEvidence = {
    photosBefore: boolean
    photosAfter: boolean
    measurements: boolean
  }
  type EvidenceField = keyof ChecklistItemEvidence
  type ChecklistItem = {
    id: string
    text: string
    required: boolean
    type: string
    materials: any[]
    evidence: ChecklistItemEvidence
  }
  type SimpleChecklistItem = {
    id: string
    text: string
    required: boolean
  }
  type ServiceMaterialItem = {
    id: string
    name: string
    quantity: number
  }
  const [localItems, setLocalItems] = useState<ChecklistItem[]>(() => (
    isOrderEditor
      ? []
      : (items ?? []).map((it: any, idx: number) => ({
          id: typeof it === 'string' ? `item-${serviceId}-${idx}` : String(it.id ?? `item-${serviceId}-${idx}`),
          text: typeof it === 'string' ? String(it) : String(it?.text || ''),
          required: typeof it === 'string' ? false : Boolean(it?.required),
          type: typeof it === 'string' ? 'comprobacion' : String(it?.type || 'comprobacion'),
          materials: Array.isArray(it?.materials) ? it.materials : [],
          evidence: (typeof it === 'string' ? undefined : it?.evidence) || { photosBefore: false, photosAfter: false, measurements: false },
        }))
  ))
  const [localOrderItems, setLocalOrderItems] = useState<SimpleChecklistItem[]>(() => (
    (orderItems ?? []).map((it: any, idx: number) => ({
      id: String(it.id ?? `order-${serviceId}-${idx}`),
      text: it.text || '',
      required: !!it.required,
    }))
  ))
  const [localBlockedItems, setLocalBlockedItems] = useState<SimpleChecklistItem[]>(() => (
    (blockedItems ?? []).map((it: any, idx: number) => ({
      id: String(it.id ?? `blocked-${serviceId}-${idx}`),
      text: it.text || '',
      required: !!it.required,
    }))
  ))
  const modalContentRef = useRef<HTMLDivElement | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const [addingMaterialFor, setAddingMaterialFor] = useState<string | null>(null)
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1)
  const [localServiceMaterials, setLocalServiceMaterials] = useState<ServiceMaterialItem[]>(() => (Array.isArray(serviceMaterials) ? serviceMaterials.map((m: any) => ({ id: String(m.id ?? ''), name: String(m.name ?? ''), quantity: Number(m.quantity ?? 0) })) : []))
  const [localServiceChecklist, setLocalServiceChecklist] = useState<SimpleChecklistItem[]>(() => (
    (serviceChecklistItems ?? []).map((it: any, idx: number) => ({
      id: String(it?.id ?? `svc-${idx}`),
      text: String(it?.text ?? it ?? ''),
      required: Boolean(it?.required),
    }))
  ))

  const serviceChecklistPreview: ChecklistItem[] = (!isOrderEditor ? (items ?? []).map((it: any, idx: number) => ({
    id: typeof it === 'string' ? `default-${serviceId}-${idx}` : String(it?.id ?? `default-${serviceId}-${idx}`),
    text: typeof it === 'string' ? String(it) : String(it?.text || ''),
    required: typeof it === 'string' ? false : Boolean(it?.required),
    type: typeof it === 'string' ? 'comprobacion' : String(it?.type || 'comprobacion'),
    materials: Array.isArray(it?.materials) ? it.materials : [],
    evidence: (typeof it === 'string' ? undefined : it?.evidence) || { photosBefore: false, photosAfter: false, measurements: false },
  })) : [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const addItem = () => {
    const nextText = newItemText.trim()
    setLocalItems((prev) => [
      ...prev,
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

  const addServiceChecklistItem = () => {
    setLocalServiceChecklist((prev) => [
      ...prev,
      { id: `svc-${Date.now()}`, text: 'Nuevo item', required: true },
    ])
  }

  const updateServiceChecklistItem = (id: string, text: string) => {
    setLocalServiceChecklist((prev) => prev.map((it) => (it.id === id ? { ...it, text } : it)))
  }

  const removeServiceChecklistItem = (id: string) => {
    setLocalServiceChecklist((prev) => prev.filter((it) => it.id !== id))
  }

  const updateItem = (id: string, text: string) => {
    setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)))
  }

  const updateItemType = (id: string, type: string) => {
    setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, type } : item)))
  }

  const removeItem = (id: string) => {
    setLocalItems((prev) => prev.filter((item) => item.id !== id))
  }

  const toggleRequired = (id: string) => {
    setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, required: !item.required } : item)))
  }

  const addOrderItem = () => {
    setLocalOrderItems((prev) => [
      ...prev,
      { id: `order-item-${Date.now()}`, text: 'Nuevo item de orden', required: true },
    ])
  }

  const updateOrderItem = (id: string, text: string) => {
    setLocalOrderItems((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)))
  }

  const removeOrderItem = (id: string) => {
    setLocalOrderItems((prev) => prev.filter((item) => item.id !== id))
  }

  const addBlockedItem = () => {
    setLocalBlockedItems((prev) => [
      ...prev,
      { id: `blocked-item-${Date.now()}`, text: 'Nuevo item para solicitudes bloqueadas', required: true },
    ])
  }

  const updateBlockedItem = (id: string, text: string) => {
    setLocalBlockedItems((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)))
  }

  const removeBlockedItem = (id: string) => {
    setLocalBlockedItems((prev) => prev.filter((item) => item.id !== id))
  }

  const startAddMaterial = (itemId: string) => {
    setAddingMaterialFor(itemId)
    setSelectedMaterialId(String(settingsMaterials?.[0]?.id ?? ''))
    setSelectedQuantity(1)
  }

  const confirmAddMaterial = () => {
    if (!addingMaterialFor || !selectedMaterialId) return
    const mat = settingsMaterials.find((m: any) => String(m.id) === String(selectedMaterialId))
    if (!mat) return
    setLocalItems((prev) => prev.map((it) => {
      if (it.id !== addingMaterialFor) return it
      const existing = Array.isArray(it.materials) ? [...it.materials] : []
      existing.push({ id: mat.id, name: mat.name, quantity: Number(selectedQuantity) || 1 })
      return { ...it, materials: existing }
    }))
    setAddingMaterialFor(null)
  }

  const startAddServiceMaterial = () => {
    setSelectedMaterialId(String(settingsMaterials?.[0]?.id ?? ''))
    setSelectedQuantity(1)
  }

  const confirmAddServiceMaterial = () => {
    if (!selectedMaterialId) return
    const mat = settingsMaterials.find((m: any) => String(m.id) === String(selectedMaterialId))
    if (!mat) return
    setLocalServiceMaterials((prev) => [...prev, { id: mat.id, name: mat.name, quantity: Number(selectedQuantity) || 1 }])
  }

  const updateServiceMaterialQty = (index: number, qty: number) => {
    setLocalServiceMaterials((prev) => prev.map((m: any, i: number) => (i === index ? { ...m, quantity: Number(qty) || 0 } : m)))
  }

  const removeServiceMaterial = (index: number) => {
    setLocalServiceMaterials((prev) => prev.filter((_: any, i: number) => i !== index))
  }

  const updateMaterialQuantity = (itemId: string, materialIndex: number, qty: number) => {
    setLocalItems((prev) => prev.map((it) => {
      if (it.id !== itemId) return it
      const materials = (it.materials ?? []).map((m: any, idx: number) => idx === materialIndex ? { ...m, quantity: Number(qty) || 0 } : m)
      return { ...it, materials }
    }))
  }

  const removeMaterialFromItem = (itemId: string, materialIndex: number) => {
    setLocalItems((prev) => prev.map((it) => {
      if (it.id !== itemId) return it
      const materials = (it.materials ?? []).filter((_: any, idx: number) => idx !== materialIndex)
      return { ...it, materials }
    }))
  }

  const toggleEvidence = (itemId: string, field: EvidenceField) => {
    setLocalItems((prev) => prev.map((it) => {
      if (it.id !== itemId) return it
      const currentEvidence = it.evidence || { photosBefore: false, photosAfter: false, measurements: false }
      return { ...it, evidence: { ...currentEvidence, [field]: !currentEvidence[field] } }
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
                      <button onClick={() => addItem()} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">Agregar verificación</button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {(localItems.length ? localItems : serviceChecklistPreview).map((item: ChecklistItem) => (
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
                  <button onClick={() => addOrderItem()} type="button" className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">Agregar item</button>
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
                  <button onClick={() => addBlockedItem()} type="button" className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/80">Agregar item</button>
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
