'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LogIn,
  MapPin,
  Navigation,
  Phone,
  ChevronRight,
  ChevronLeft,
  ClipboardCheck,
  Camera,
  Package,
  PenLine,
  FileText,
  CheckCircle2,
  Plus,
  Bell,
  Zap,
  Search,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/logo'
import { StatusBadge } from '@/components/status-badge'
import { SignaturePad } from './signature-pad'
import { CircuitCalculator } from './circuit-calculator'
import { useTechnicianLocation } from '@/hooks/use-technician-location'
import {
  workOrders,
  serviceDefinitions,
  serviceChecklists,
  electricianGoldenRules,
  statusOrder,
  formatCLP,
  activeJob,
  type WorkOrder,
  type ServiceStatus,
  getFriendlyServiceName,
  normalizeServiceValue,
} from '@/lib/data'
import { updateOrdenStatus, saveOrdenEvidence } from '@/app/actions/orden'
import { useSession, signOut } from '@/lib/auth-client'
import { diffOrderNotifications } from '@/lib/notifications'

const getRequestedTime = (order: any) => {
  if (order.localTime) return order.localTime
  if (order.time) return order.time
  if (order.hora) return order.hora
  if (order.date) {
    try {
      return new Date(order.date).toLocaleTimeString('es-CL', {
        timeZone: 'America/Santiago',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }
  if (order.createdAt) {
    try {
      return new Date(order.createdAt).toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }
  return ''
}

const getRequestedDate = (order: any) => {
  if (order.localDate) {
    try {
      return new Date(order.localDate).toLocaleDateString('es-CL', {
        timeZone: 'UTC',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return order.localDate
    }
  }
  if (order.date) {
    try {
      return new Date(order.date).toLocaleDateString('es-CL', {
        timeZone: 'America/Santiago',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }
  return ''
}

const parseRequestedSchedule = (order: any) => {
  const localDate = order.localDate
  const localTime = order.localTime || order.time || order.hora
  if (localDate && localTime) {
    const [year, month, day] = localDate.split('-').map(Number)
    const [hours, minutes] = localTime.split(':').map(Number)
    if ([year, month, day, hours, minutes].every(Number.isFinite)) {
      return new Date(Date.UTC(year, month - 1, day, hours, minutes))
    }
  }
  if (order.date) {
    const date = new Date(order.date)
    if (!Number.isNaN(date.getTime())) return date
  }
  if (order.createdAt) {
    const date = new Date(order.createdAt)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

function parseEvidence(raw: any) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw
  return null
}

function parseFeedbackPayload(raw: any) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : raw
    } catch {
      return raw
    }
  }
  if (typeof raw === 'object') return raw
  return null
}

const technicianVisibleStatuses = ['pendiente', 'en camino', 'en proceso', 'en progreso', 'finalizado', 'finalizada'] as const

function normalizeTechnicianStatus(status: unknown) {
  return String(status ?? '').trim().toLowerCase()
}

function isTechnicianVisibleStatus(status: unknown) {
  const normalized = normalizeTechnicianStatus(status)
  return technicianVisibleStatuses.includes(normalized as (typeof technicianVisibleStatuses)[number])
}

export function TecnicoApp({ initialOrders }: { initialOrders?: any[] }) {
  const router = useRouter()
  const { data: session } = useSession()
  const [active, setActive] = useState<WorkOrder | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [viewMode, setViewMode] = useState<'activa' | 'historial'>('activa')
  const [orders, setOrders] = useState<any[]>(initialOrders ?? workOrders)
  const [ratingOrder, setRatingOrder] = useState<any | null>(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [savingRating, setSavingRating] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const ordersRef = useRef<any[]>(initialOrders ?? workOrders)

  const technicianId = session?.user?.id ?? null
  const technicianName = session?.user?.name ?? null
  const relevantOrders = orders.filter((o: any) => {
    const oTechId = o.tecnicoId ?? o.tecnicoid ?? null
    const oTechName = o.tecnicoNombre ?? o.tecniconombre ?? null
    const hasAssignedTech = Boolean(oTechId || oTechName)
    const assignedToThisTech = technicianId
      ? String(oTechId) === String(technicianId)
      : technicianName
      ? String(oTechName).toLowerCase() === String(technicianName).toLowerCase()
      : false

    return hasAssignedTech ? assignedToThisTech && isTechnicianVisibleStatus(o.status ?? o.estado) : false
  })

  const completedOrdersCount = relevantOrders.filter((o: any) => {
    const estado = normalizeTechnicianStatus(o.status ?? o.estado)
    return estado === 'finalizado' || estado === 'finalizada'
  }).length
  const inProgressCount = relevantOrders.filter((o: any) => {
    const estado = normalizeTechnicianStatus(o.status ?? o.estado)
    return ['en progreso', 'en proceso', 'en camino'].includes(estado)
  }).length

  useEffect(() => {
    if (!initialOrders) return
    setOrders(initialOrders)
    ordersRef.current = initialOrders
  }, [initialOrders])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/tecnico/orders', { cache: 'no-store' })
        if (!response.ok) {
          const nextOrders: any[] = []
          ordersRef.current = nextOrders
          setOrders(nextOrders)
          return
        }
        const payload = await response.json().catch(() => ({ orders: [] }))
        const nextOrders = Array.isArray(payload?.orders) ? payload.orders : []

        const incoming = diffOrderNotifications(ordersRef.current, nextOrders, 'tecnico')
        if (ordersRef.current.length > 0 && incoming.length > 0) {
          setNotifications((current) => [...incoming, ...current].slice(0, 20))
          setHasUnreadNotifications(true)
        }

        ordersRef.current = nextOrders
        setOrders(nextOrders)
      } catch (error) {
        console.error('Failed to refresh tecnico orders:', error)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (showNotifications) {
      setHasUnreadNotifications(false)
    }
  }, [showNotifications])

  // Activar rastreo de ubicación cuando la orden está "en camino"
  const activeOrderId = active?.id ?? (active as any)?.orderId ?? (active as any)?.ordenId
  const activeOrderStatus = (active?.status ?? (active as any)?.estado ?? '').toString().toLowerCase()
  const isOnTheWay = activeOrderStatus.includes('en camino') || activeOrderStatus.includes('en_camino')
  
  useTechnicianLocation({
    orderId: isOnTheWay && activeOrderId ? String(activeOrderId) : undefined,
    enabled: isOnTheWay && Boolean(activeOrderId),
  })

  const assignedOrders = orders.filter((o: any) => {
    const estado = normalizeTechnicianStatus(o.status ?? o.estado)
    return ['en progreso', 'en proceso', 'en camino'].includes(estado)
  })

  const averageRating = useMemo(() => {
    if (!technicianId) return 0
    let total = 0
    let count = 0
    for (const o of orders) {
      const oTechId = o.tecnicoId ?? o.tecnicoid ?? null
      const oTechName = o.tecnicoNombre ?? o.tecniconombre ?? null
      const assignedToThisTech = technicianId
        ? String(oTechId) === String(technicianId)
        : technicianName
        ? String(oTechName).toLowerCase() === String(technicianName).toLowerCase()
        : false
      if (!assignedToThisTech) continue
      const parsed = parseFeedbackPayload(o.notasTecnico ?? o.feedback ?? null)
      const clientRating = parsed?.rating ?? (parsed?.clientRating && parsed.clientRating.score ? parsed.clientRating.score : undefined)
      if (clientRating !== undefined && clientRating !== null) {
        total += Number(clientRating) || 0
        count += 1
      }
    }
    return count > 0 ? Math.round((total / count) * 10) / 10 : 0
  }, [orders, technicianId, technicianName])

  const resolveOrderId = (order: any) => {
    const candidates = [
      order?.id,
      order?.orderId,
      order?.ordenId,
      order?.order?.id,
      order?.order?.orderId,
    ]

    for (const candidate of candidates) {
      if (candidate == null) continue
      const text = String(candidate).trim()
      if (text && text !== 'null' && text !== 'undefined') return text
    }

    return null
  }

  const handleSaveRating = async () => {
    if (!ratingOrder) return

    const orderId = resolveOrderId(ratingOrder)
    if (!orderId) {
      window.alert('No se pudo identificar la orden para guardar la valoración.')
      return
    }

    setSavingRating(true)
    try {
      const currentStatus = normalizeTechnicianStatus((ratingOrder as any).status ?? (ratingOrder as any).estado)
      const statusToSave = currentStatus === 'por_validar' ? 'por_validar' : 'finalizado'
      const parsedFeedback = parseFeedbackPayload((ratingOrder as any).notasTecnico ?? (ratingOrder as any).feedback ?? null)
      const nextFeedback = {
        ...(parsedFeedback && typeof parsedFeedback === 'object' && !Array.isArray(parsedFeedback) ? parsedFeedback : {}),
        clientRating: {
          score: ratingValue,
          comment: ratingComment.trim(),
          ratedAt: new Date().toISOString(),
        },
      }

      const result = await updateOrdenStatus(orderId, statusToSave as any, {
        feedback: JSON.stringify(nextFeedback),
      })

      if (result?.success) {
        setOrders((prev) => prev.map((order) => String(order.id) === String(orderId)
          ? { ...order, notasTecnico: JSON.stringify(nextFeedback), feedback: JSON.stringify(nextFeedback) }
          : order))
        setRatingOrder(null)
        setRatingComment('')
        setRatingValue(5)
        window.alert('Valoración guardada correctamente.')
      } else {
        window.alert(result?.error || 'No se pudo guardar la valoración.')
      }
    } catch (error) {
      console.error('Error saving client rating:', error)
      window.alert('No se pudo guardar la valoración.')
    } finally {
      setSavingRating(false)
    }
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      <div className="flex h-full w-full flex-col lg:flex-row">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/70 lg:flex">
          <div className="border-b border-border p-5">
            <Logo size={32} withText />
            <p className="mt-2 text-sm text-muted-foreground">Panel de operaciones para técnicos y visitas en terreno.</p>
          </div>
          <div className="flex-1 space-y-3 p-4">
            <div className="rounded-2xl border border-border bg-background/60 p-3 text-sm">
              <p className="font-semibold">Ruta de hoy</p>
              <p className="mt-1 text-muted-foreground">{assignedOrders.length} ordenes asignadas · {orders.filter((o:any)=>String(o.urgencia||'').toLowerCase()==='urgente').length} urgencia</p>
            </div>
              <div className="rounded-2xl border border-border bg-background/60 p-3 text-sm">
                <p className="font-semibold">Calificación</p>
                <p className="mt-1 flex items-center gap-2">
                  <Star className="size-4 fill-warning text-warning" />
                  <span className="font-semibold">{averageRating ?? 0}</span>
                  <span className="text-xs text-muted-foreground">promedio</span>
                </p>
              </div>
            <div className="rounded-2xl border border-border bg-background/60 p-3 text-sm">
              <p className="font-semibold">Herramientas</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• Checklist de inspección</li>
                <li>• Registro de materiales</li>
                <li>• Firma digital</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border p-3">
            <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
              Volver al inicio
            </Link>
          </div>
        </aside>

        <div className="flex h-full flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:px-6">
            {active ? (
              <button
                onClick={() => setActive(null)}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground"
              >
                <ChevronLeft className="size-4" /> Órdenes
              </button>
            ) : (
              <Logo size={28} withText />
            )}
            <div className="flex items-center gap-3 relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications((v) => {
                    const next = !v
                    if (!v) {
                      setHasUnreadNotifications(false)
                    }
                    return next
                  })
                }}
                className="relative flex items-center justify-center rounded-full border border-border p-3 text-muted-foreground transition hover:bg-accent/10"
                aria-label="Notificaciones"
              >
                <Bell className="size-4" />
                {hasUnreadNotifications && notifications.length > 0 && (
                  <span className="absolute right-2 top-2 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {notifications.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowProfile((v) => !v)}
                className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition hover:bg-accent/10"
              >
                Perfil
              </button>
            </div>
          </header>

          {showNotifications && (
            <div className="fixed right-4 top-20 z-50 w-[320px] rounded-3xl border border-border bg-card p-4 shadow-2xl lg:right-16">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Notificaciones</p>
                  <p className="text-lg font-semibold">Actualizaciones de órdenes</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Cerrar
                </button>
              </div>
              <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="rounded-3xl border border-border bg-background/80 p-4 text-center text-sm text-muted-foreground">
                    No hay notificaciones nuevas.
                  </div>
                ) : (
                  notifications.map((notification, index) => (
                    <div key={`${notification.id ?? 'notification'}-${index}`} className="rounded-3xl border border-border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{notification.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{notification.timestamp}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{notification.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {showProfile && (
            <ProfilePanel
              user={session?.user ?? {
                name: (activeJob as any)?.technician?.name ?? 'Técnico',
                email: (activeJob as any)?.technician?.email ?? 'no disponible',
                phone: (activeJob as any)?.technician?.phone ?? 'no disponible',
                role: (activeJob as any)?.technician?.role ?? 'Técnico de campo',
                lastSeen: 'Hoy',
              }}
              orders={orders}
              onClose={() => setShowProfile(false)}
              onLogout={async () => {
                try {
                  await signOut()
                } catch (error) {
                  console.error('Error during sign out:', error)
                }
                router.push('/sign-in/tecnico')
              }}
            />
          )}

          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            {active ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card p-3 text-center">
                    <p className="font-display text-xl font-bold text-primary">{inProgressCount}</p>
                    <p className="text-[11px] text-muted-foreground">En curso</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3 text-center">
                    <p className="font-display text-xl font-bold text-primary">{completedOrdersCount}</p>
                    <p className="text-[11px] text-muted-foreground">Finalizadas</p>
                  </div>
                </div>
                <OrderDetail order={active} onClose={() => setActive(null)} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2 rounded-2xl border border-border bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('activa')}
                    className={cn(
                      'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
                      viewMode === 'activa' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    Órdenes activas
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('historial')}
                    className={cn(
                      'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
                      viewMode === 'historial' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                    )}
                  >
                    Historial
                  </button>
                </div>

                {viewMode === 'historial' ? (
                  <HistoryList
                    initialOrders={orders}
                    technicianId={session?.user?.id ?? null}
                    technicianName={session?.user?.name ?? null}
                    onRateOrder={setRatingOrder}
                  />
                ) : (
                  <OrderList onOpen={setActive} initialOrders={orders} technicianId={session?.user?.id ?? null} technicianName={session?.user?.name ?? null} compact={false} />
                )}
              </div>
            )}

            {ratingOrder ? (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Calificar al cliente</p>
                    <p className="mt-1 text-xs text-muted-foreground">{(ratingOrder as any).client ?? (ratingOrder as any).clienteNombre ?? 'Cliente'}</p>
                  </div>
                  <button type="button" onClick={() => setRatingOrder(null)} className="text-sm text-muted-foreground">Cerrar</button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const value = index + 1
                    return (
                      <button key={value} type="button" onClick={() => setRatingValue(value)} className="text-amber-500">
                        <Star className={cn('size-5', value <= ratingValue ? 'fill-current' : 'opacity-50')} />
                      </button>
                    )
                  })}
                </div>
                <textarea
                  value={ratingComment}
                  onChange={(event) => setRatingComment(event.target.value)}
                  rows={3}
                  placeholder="Agrega un comentario breve sobre la experiencia con el cliente..."
                  className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={handleSaveRating} disabled={savingRating} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {savingRating ? 'Guardando...' : 'Guardar valoración'}
                  </button>
                  <button type="button" onClick={() => setRatingOrder(null)} className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// Note: Login handled elsewhere; removed fake login UI.

function HistoryList({ initialOrders, technicianId, technicianName, onRateOrder }: { initialOrders?: any[]; technicianId?: string | null; technicianName?: string | null; onRateOrder: (order: any) => void }) {
  const orders = initialOrders ?? workOrders
  const techId = technicianId ?? null
  const techName = technicianName ?? null

  const relevantOrders = orders.filter((o: any) => {
    const oTechId = o.tecnicoId ?? o.tecnicoid ?? null
    const oTechName = o.tecnicoNombre ?? o.tecniconombre ?? null
    const hasAssignedTech = Boolean(oTechId || oTechName)
    const assignedToThisTech = techId
      ? String(oTechId) === String(techId)
      : techName
      ? String(oTechName).toLowerCase() === String(techName).toLowerCase()
      : false

    const normalizedStatus = normalizeTechnicianStatus(o.status ?? o.estado)
    const isCompletedLike = normalizedStatus === 'finalizado' || normalizedStatus === 'finalizada' || normalizedStatus === 'por_validar'

    return hasAssignedTech ? assignedToThisTech && isCompletedLike : false
  })

  return (
    <div className="space-y-3">
      {relevantOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/70 p-6 text-center text-sm text-muted-foreground">
          Aún no tienes órdenes finalizadas para ver en el historial.
        </div>
      ) : relevantOrders.sort((a: any, b: any) => {
        const aDate = parseRequestedSchedule(a)
        const bDate = parseRequestedSchedule(b)
        if (!aDate && !bDate) return 0
        if (!aDate) return 1
        if (!bDate) return -1
        return bDate.getTime() - aDate.getTime()
      }).map((order) => {
        const parsedFeedback = parseFeedbackPayload((order as any).notasTecnico ?? (order as any).feedback ?? null)
        const rating = parsedFeedback?.clientRating
        return (
          <div key={(order as any).id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{(order as any).client ?? (order as any).clienteNombre ?? 'Cliente'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{getFriendlyServiceName((order as any).service ?? (order as any).categoria ?? (order as any).descripcion ?? 'Servicio')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{getRequestedDate(order)} · {getRequestedTime(order)}</p>
              </div>
              <StatusBadge status={(order as any).status ?? (order as any).estado ?? 'finalizado'} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-background/70 px-3 py-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Calificación cliente</p>
                <p className="text-sm text-muted-foreground">{rating ? `${rating.score}/5` : 'Sin calificación aún'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    // debug log to help trace why clicks might not trigger
                    // eslint-disable-next-line no-console
                    console.log('Rate button clicked for order', (order as any)?.id)
                    onRateOrder?.(order)
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error('Error invoking onRateOrder:', e)
                  }
                }}
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                {rating ? 'Editar valoración' : 'Valorar cliente'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OrderList({ onOpen, initialOrders, compact, technicianId, technicianName }: { onOpen: (o: WorkOrder) => void; initialOrders?: any[]; compact?: boolean; technicianId?: string | null; technicianName?: string | null }) {
  const orders = initialOrders ?? workOrders
  const techId = technicianId ?? null
  const techName = technicianName ?? null

  const relevantOrders = orders.filter((o: any) => {
    const oTechId = o.tecnicoId ?? o.tecnicoid ?? null
    const oTechName = o.tecnicoNombre ?? o.tecniconombre ?? null
    const hasAssignedTech = Boolean(oTechId || oTechName)
    const assignedToThisTech = techId
      ? String(oTechId) === String(techId)
      : techName
      ? String(oTechName).toLowerCase() === String(techName).toLowerCase()
      : false

    return hasAssignedTech ? assignedToThisTech && isTechnicianVisibleStatus(o.status ?? o.estado) : false
  })

  const activeOrders = relevantOrders.filter((o: any) => {
    const estado = normalizeTechnicianStatus(o.status ?? o.estado)
    return ['pendiente', 'en progreso', 'en proceso', 'en camino'].includes(estado)
  })

  const completedOrders = relevantOrders.filter((o: any) => {
    const estado = normalizeTechnicianStatus(o.status ?? o.estado)
    return estado === 'finalizado' || estado === 'finalizada'
  })

  const inProgressCount = activeOrders.filter((o: any) => {
    const estado = normalizeTechnicianStatus(o.status ?? o.estado)
    return ['en progreso', 'en proceso', 'en camino'].includes(estado)
  }).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="font-display text-xl font-bold text-primary">{inProgressCount}</p>
          <p className="text-[11px] text-muted-foreground">En curso</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="font-display text-xl font-bold text-primary">{completedOrders.length}</p>
          <p className="text-[11px] text-muted-foreground">Finalizadas</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Órdenes de trabajo</p>
        {!compact && <span className="text-xs text-muted-foreground">Vista adaptable</span>}
      </div>
      <div className="space-y-3">
        {activeOrders
          .sort((a: any, b: any) => {
            const aDate = parseRequestedSchedule(a)
            const bDate = parseRequestedSchedule(b)
            if (!aDate && !bDate) return 0
            if (!aDate) return 1
            if (!bDate) return -1
            return aDate.getTime() - bDate.getTime()
          })
          .map((o, index) => {
            const serviceLabel = getFriendlyServiceName(o.service ?? o.categoria ?? o.descripcion ?? 'Servicio')
            return (
              <button
                key={`${o.id ?? 'order'}-${index}`}
                onClick={() => onOpen(o)}
                className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 sm:flex-row sm:items-center"
              >
                <div className="flex flex-col items-center rounded-xl bg-secondary px-3 py-2 sm:min-w-[72px]">
                  <span className="text-[10px] text-muted-foreground">HORA</span>
                  <span className="font-display font-bold">{getRequestedTime(o)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{o.client ?? o.clienteNombre ?? o.cliente}</p>
                    {((o.priority === 'Urgente') || (o.urgencia && String(o.urgencia).toLowerCase() === 'urgente')) && (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        Urgente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{serviceLabel}</p>
                  {(o.descripcion || o.description) && (
                    <>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Descripción</p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words">{o.descripcion || o.description}</p>
                    </>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Fecha reservada: {getRequestedDate(o)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Hora reservada: {getRequestedTime(o)}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <MapPin className="size-3" /> {o.address ?? o.direccion}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </button>
            )
          })}
      </div>
    </div>
  )
}

const sections = [
  { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
  { id: 'fotos', label: 'Fotos', icon: Camera },
  { id: 'materiales', label: 'Materiales', icon: Package },
  { id: 'calculadora', label: 'Calcular', icon: Zap },
  { id: 'evidence', label: 'Evidencia', icon: Zap },
  { id: 'firma', label: 'Firma', icon: PenLine },
] as const

function OrderDetail({ order, onClose }: { order: WorkOrder; onClose: () => void }) {
  const [status, setStatus] = useState<ServiceStatus>((order.status as ServiceStatus) ?? ((order as any).estado as ServiceStatus) ?? 'pendiente')
  const [section, setSection] = useState<(typeof sections)[number]['id']>('checklist')
  const [signed, setSigned] = useState(false)
  const { data: session } = useSession()
  const [generated, setGenerated] = useState(false)
  const [orderChecklist, setOrderChecklist] = useState<Array<{ id: string; text: string; required?: boolean }>>([])
  const [serviceChecklistSettings, setServiceChecklistSettings] = useState<Record<string, any>>({})
  const [checked, setChecked] = useState<boolean[]>([])
  const [availableMaterials, setAvailableMaterials] = useState<Array<{ id: string; name: string; price: number; stock?: number; category?: string; purchaseUrl?: string }>>([])
  const [usedMaterials, setUsedMaterials] = useState<{ [key: string]: number }>({})
  const [materialsDescription, setMaterialsDescription] = useState('')
  const [beforePhotoUrls, setBeforePhotoUrls] = useState<string[]>([])
  const [afterPhotoUrls, setAfterPhotoUrls] = useState<string[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([])
  const [missingMaterials, setMissingMaterials] = useState<Record<string, number>>({})
  const [missingMaterialSearch, setMissingMaterialSearch] = useState('')
  const [missingMaterialCategory, setMissingMaterialCategory] = useState('Todos')
  const [isRejecting, setIsRejecting] = useState(false)
  const [voltage, setVoltage] = useState('')
  const [current, setCurrent] = useState('')
  const [earthResistance, setEarthResistance] = useState('')
  const [continuity, setContinuity] = useState('')
  const [evidenceObservations, setEvidenceObservations] = useState('')
  const [savingEvidence, setSavingEvidence] = useState(false)
  const [departureAtTime, setDepartureAtTime] = useState<string | Date | null>((order as any).departureAt ?? null)
  const [arrivalAtTime, setArrivalAtTime] = useState<string | Date | null>((order as any).arrivalAt ?? (order as any).workStartAt ?? null)
  const [workStartAtTime, setWorkStartAtTime] = useState<string | Date | null>((order as any).workStartAt ?? null)
  const [workEndAtTime, setWorkEndAtTime] = useState<string | Date | null>((order as any).workEndAt ?? null)
  const [estimatedWorkHours, setEstimatedWorkHours] = useState<number | ''>(typeof (order as any).estimatedHours === 'number' ? (order as any).estimatedHours : '')
  const beforeInputRef = useRef<HTMLInputElement | null>(null)
  const afterInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDepartureAtTime((order as any).departureAt ?? null)
    setArrivalAtTime((order as any).arrivalAt ?? (order as any).workStartAt ?? null)
    setWorkStartAtTime((order as any).workStartAt ?? null)
    setWorkEndAtTime((order as any).workEndAt ?? null)
    setEstimatedWorkHours(typeof (order as any).estimatedHours === 'number' ? (order as any).estimatedHours : '')
  }, [order])

  const clientName = (order as any).client ?? (order as any).clienteNombre ?? (order as any).cliente
  const orderDescription = (order as any).descripcion ?? (order as any).description ?? ''
  const rawServiceName = (order as any).service ?? (order as any).categoria ?? (order as any).descripcion
  const serviceName = getFriendlyServiceName(rawServiceName)
  const phone = (order as any).phone ?? (order as any).clienteTelefono
  const evidenceData = parseEvidence((order as any).technicalEvidence)
  const normalizedServiceName = String(rawServiceName).toLowerCase()
  const serviceEntry = Object.entries(serviceDefinitions).find(([key, def]) => {
    const normalizedDefName = def.name.toLowerCase()
    const normalizedShort = def.short.toLowerCase()
    return String((order as any).serviceId ?? '').trim() === key || normalizedServiceName.includes(key) || normalizedServiceName.includes(normalizedDefName) || normalizedServiceName.includes(normalizedShort)
  })
  const serviceKey = serviceEntry ? serviceEntry[0] : String((order as any).serviceId ?? normalizeServiceValue(rawServiceName) ?? '').trim()
  const friendlyServiceName = serviceEntry ? serviceDefinitions[serviceEntry[0]].name : serviceName

  const uploadPhotoToServer = async (category: 'before' | 'after', file: File) => {
    try {
      setPhotoUploadError(null)
      setPhotoUploading(true)
      const formData = new FormData()
      formData.append('orderId', String((order as any).id))
      formData.append('category', category)
      formData.append('file', file)

      const response = await fetch('/api/tecnico/upload-photo', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Error subiendo la foto')
      }

      return String(data.url)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setPhotoUploadError(message)
      console.error('Upload photo error:', message)
      return null
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleUploadPhoto = async (category: 'before' | 'after', file: File) => {
    const url = await uploadPhotoToServer(category, file)
    if (!url) return

    if (category === 'before') {
      setBeforePhotoUrls((prev) => [...prev, url])
    } else {
      setAfterPhotoUrls((prev) => [...prev, url])
    }
  }

  // Load dynamic checklists from API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const json = await res.json()
        if (json?.settings?.orderChecklist) {
          setOrderChecklist(Array.isArray(json.settings.orderChecklist) ? json.settings.orderChecklist : [])
        }
        if (json?.settings?.checklists) {
          setServiceChecklistSettings(typeof json.settings.checklists === 'object' ? json.settings.checklists : {})
        }
        if (json?.settings?.materials) {
          setAvailableMaterials(json.settings.materials)
        }
      } catch (e) {
        console.error('Error loading settings:', e)
      }
    }
    loadSettings()
  }, [])

  // Get checklist items - prioritize dynamic checklists from API
  type ChecklistItem = { id: string; text: string; required?: boolean; materials?: any[]; evidence?: any; source: 'order' | 'service' }

  const orderChecklistItems = useMemo<ChecklistItem[]>(() => Array.isArray(orderChecklist) ? orderChecklist.map((it: any) => ({
    id: String(it.id || `order-${Math.random()}`),
    text: it.text || '',
    required: !!it.required,
    source: 'order' as const,
  })) : [], [orderChecklist])

  const serviceChecklistItems = useMemo<ChecklistItem[]>(() => {
    const raw = (serviceChecklistSettings as any)[serviceKey]
    const settingsItems = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.verifications)
      ? raw.verifications
      : Array.isArray(raw?.checklist)
      ? raw.checklist
      : []
    const fallbackItems = Array.isArray(serviceChecklists[serviceKey]) ? serviceChecklists[serviceKey] : []
    const sourceItems = settingsItems.length ? settingsItems : fallbackItems.map((text) => ({ id: `service-${serviceKey}-${text}`, text, required: false, materials: [], evidence: { photosBefore: false, photosAfter: false, measurements: false } }))

    return sourceItems.map((it: any, index: number) => ({
      id: String(it.id || `service-${serviceKey}-${index}`),
      text: it.text || '',
      required: !!it.required,
      materials: it.materials || [],
      evidence: it.evidence || { photosBefore: false, photosAfter: false, measurements: false },
      source: 'service' as const,
    }))
  }, [serviceKey, serviceChecklistSettings])

  const checklistItems = useMemo<ChecklistItem[]>(() => [...orderChecklistItems, ...serviceChecklistItems], [orderChecklistItems, serviceChecklistItems])

  const configuredMaterials = useMemo(() => {
    const aggregated = new Map<string, { id: string; name: string; price: number; quantity: number; category?: string }>()

    for (const item of checklistItems) {
      for (const material of (item.materials || []) as Array<{ id?: string; name?: string; quantity?: number }>) {
        const id = String(material.id || material.name || `${item.id}-material`)
        const existing = aggregated.get(id)
        const price = availableMaterials.find((entry) => String(entry.id) === String(material.id) || entry.name === material.name)?.price || 0
        const quantity = Number(material.quantity ?? 1) || 1

        if (existing) {
          existing.quantity += quantity
          existing.price = existing.price || price
        } else {
          aggregated.set(id, {
            id,
            name: String(material.name || material.id || 'Material sin nombre'),
            price,
            quantity,
            category: 'Checklist',
          })
        }
      }
    }

    return Array.from(aggregated.values())
  }, [availableMaterials, checklistItems])

  useEffect(() => {
    setChecked(Array.isArray(checklistItems) ? checklistItems.map(() => false) : [])
  }, [checklistItems.length])

  const orderChecklistEntries = orderChecklistItems
  const serviceChecklistEntries = serviceChecklistItems
  const checklist = checklistItems
  const visibleStatuses = ['pendiente', 'en camino', 'en proceso', 'finalizado'] as const
  const statusIdx = visibleStatuses.indexOf(normalizeTechnicianStatus(status) === 'finalizada' ? 'finalizado' : normalizeTechnicianStatus(status) as (typeof visibleStatuses)[number])
  const canFinish = Array.isArray(checked) && checked.every(Boolean) && signed
  const missingMaterialCategories = Array.from(new Set(availableMaterials.map((material) => material.category || 'Otros'))).sort()
  const normalizedMissingMaterialSearch = missingMaterialSearch.trim().toLowerCase()
  const filteredMissingMaterials = availableMaterials.filter((material) => {
    const matchesCategory = missingMaterialCategory === 'Todos' || (material.category || 'Otros') === missingMaterialCategory
    const searchableText = `${material.name} ${material.id} ${material.category || ''}`.toLowerCase()
    return matchesCategory && (!normalizedMissingMaterialSearch || searchableText.includes(normalizedMissingMaterialSearch))
  })

  const buildTechnicianFeedback = () => {
    const materialsItems = configuredMaterials.map((material) => ({
      materialId: material.id,
      name: material.name,
      price: material.price || 0,
      quantity: material.quantity,
      subtotal: (material.price || 0) * material.quantity,
    }))

    const materialsTotal = materialsItems.reduce((sum, item) => sum + item.subtotal, 0)
    const technicianName = session?.user?.name ?? (activeJob as any)?.technician?.name ?? (order as any).tecnicoNombre ?? 'el técnico'
    const departureAt = departureAtTime ?? null
    const arrivalAt = arrivalAtTime ?? null
    const workStartAt = workStartAtTime ?? null
    const workEndAt = workEndAtTime ?? null
    const durationMs = workStartAt && workEndAt ? (new Date(workEndAt).getTime() - new Date(workStartAt).getTime()) : undefined
    const workDuration = durationMs !== undefined && durationMs >= 0 ? `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m` : undefined
    const estimatedHours = typeof estimatedWorkHours === 'number' && estimatedWorkHours >= 0 ? estimatedWorkHours : undefined

    const checklistFeedbackItems = checklist.map((item, idx) => ({
      text: item.text || '',
      completed: checked[idx] || false,
      required: item.required,
      materials: item.materials || [],
      evidence: item.evidence || { photosBefore: false, photosAfter: false, measurements: false },
      source: item.source,
    }))

    return {
      technician: technicianName,
      timestamp: new Date().toISOString(),
      departureAt,
      arrivalAt,
      workStartAt,
      workEndAt,
      workDuration,
      materials: {
        description: materialsDescription,
        items: materialsItems,
        total: materialsTotal,
      },
      checklist: {
        service: friendlyServiceName,
        serviceItems: checklistFeedbackItems.filter((item) => item.source === 'service'),
        orderItems: checklistFeedbackItems.filter((item) => item.source === 'order'),
        allCompleted: checked.every(Boolean),
      },
      photos: {
        before: beforePhotoUrls.length,
        after: afterPhotoUrls.length,
        total: beforePhotoUrls.length + afterPhotoUrls.length,
        beforeUrls: beforePhotoUrls,
        afterUrls: afterPhotoUrls,
      },
      signature: signed,
      estimatedHours,
    }
  }

  const handleStatusChange = async (s: ServiceStatus) => {
    const nextStatus = s === 'finalizado' ? 'por_validar' : s

    if (nextStatus === 'por_validar') {
      if (!canFinish) {
        alert('Completa el checklist y captura la firma antes de finalizar.')
        return
      }
      try {
        const result = await updateOrdenStatus(String((order as any).id), 'por_validar', {
          feedback: JSON.stringify(buildTechnicianFeedback()),
        })
        if (result?.success) {
          setStatus('por_validar')
          setGenerated(true)
          if (!workEndAtTime) setWorkEndAtTime(new Date().toISOString())
        }
      } catch (error) {
        console.error(error)
      }
      return
    }

    setStatus(s)
    try {
      await updateOrdenStatus(String((order as any).id), nextStatus)
      if (nextStatus === 'en camino' && !departureAtTime) {
        setDepartureAtTime(new Date().toISOString())
      }
      if (nextStatus === 'en proceso') {
        if (!arrivalAtTime) setArrivalAtTime(new Date().toISOString())
        if (!workStartAtTime) setWorkStartAtTime(new Date().toISOString())
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleReject = async () => {
    if (!rejectionReasons.length && !rejectionReason.trim() && Object.keys(missingMaterials).length === 0) {
      alert('Indica al menos un motivo o agrega un detalle antes de rechazar la orden.')
      return
    }

    setIsRejecting(true)
    try {
      const technicianName = session?.user?.name ?? (activeJob as any)?.technician?.name ?? (order as any).tecnicoNombre ?? 'el técnico'
      const estimatedHours = typeof estimatedWorkHours === 'number' && estimatedWorkHours >= 0 ? estimatedWorkHours : undefined

      const rejectionPayload = {
        type: 'rejection_report',
        technician: technicianName,
        reasons: rejectionReasons,
        missingMaterials: Object.entries(missingMaterials).map(([materialId, quantity]) => {
          const material = availableMaterials.find((item) => item.id === materialId)
          return { id: materialId, name: material?.name ?? materialId, quantity }
        }),
        details: rejectionReason.trim(),
        timestamp: new Date().toISOString(),
        estimatedHours,
      }
      console.log('rejectionPayload', rejectionPayload)
      const result = await updateOrdenStatus(String((order as any).id), 'en revision', {
        feedback: JSON.stringify(rejectionPayload),
      })
      if (result?.success) {
        setStatus('en revision')
        setGenerated(false)
        setShowRejectForm(false)
        setRejectionReasons([])
        setMissingMaterials({})
        setMissingMaterialSearch('')
        setMissingMaterialCategory('Todos')
        setRejectionReason('')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsRejecting(false)
    }
  }

  const handleFinalize = async () => {
    try {
      const result = await updateOrdenStatus(String((order as any).id), 'por_validar', {
        feedback: JSON.stringify(buildTechnicianFeedback()),
      })
      if (result?.success) {
        setStatus('por_validar')
        setGenerated(true)
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Orden {(order as any).id}</p>
            <p className="font-display text-lg font-bold">{clientName}</p>
            <p className="text-sm text-muted-foreground">{friendlyServiceName}</p>
            {orderDescription ? (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Descripción</p>
                <p className="mt-1 text-sm text-muted-foreground break-words">{orderDescription}</p>
              </>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">Fecha reservada: {getRequestedDate(order)}</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Navigation className="size-4" /> Navegar GPS
          </a>
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"
              aria-label="Llamar cliente"
            >
              <Phone className="size-4" />
            </a>
          ) : (
            <button
              disabled
              className="flex size-11 items-center justify-center rounded-xl bg-secondary/40 text-muted-foreground"
              aria-label="Teléfono no disponible"
            >
              <Phone className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowRejectForm((prev) => !prev)}
            disabled={status === 'en revision' || status === 'finalizado' || status === 'por_validar' || status === 'en_reclamo'}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:border-amber-500/60 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ClipboardCheck className="size-4 shrink-0" />
            <span>{showRejectForm ? 'Cancelar revisión' : 'Revisar orden'}</span>
          </button>
        </div>
        {showRejectForm && status !== 'en revision' && status !== 'finalizado' ? (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <ClipboardCheck className="size-4" />
              <p className="text-sm font-semibold">Revisar orden</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                { id: 'sin_materiales', label: 'No tenía todos los materiales' },
                { id: 'falla_incoherente', label: 'La falla no era coherente con la solicitud' },
                { id: 'cliente_no_responde', label: 'El cliente no respondió' },
              ].map((option) => {
                const checked = rejectionReasons.includes(option.id)
                return (
                  <label key={option.id} className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-background px-3 py-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setRejectionReasons((prev) =>
                          prev.includes(option.id) ? prev.filter((item) => item !== option.id) : [...prev, option.id],
                        )
                      }}
                      className="mt-1"
                    />
                    <span>{option.label}</span>
                  </label>
                )
              })}
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Horas de trabajo estimadas</p>
              <input
                type="number"
                min="0"
                value={estimatedWorkHours}
                onChange={(event) => setEstimatedWorkHours(event.target.value === '' ? '' : Number(event.target.value))}
                placeholder="0"
                className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/70 focus:ring-2 focus:ring-primary/10"
              />
              <p className="mt-2 text-xs text-muted-foreground">Ingresa las horas que estimas que tomará el trabajo.</p>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Materiales faltantes</p>
              {availableMaterials.length > 0 ? (
                <div className="mt-2 rounded-xl border border-amber-500/20 bg-background p-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={missingMaterialSearch}
                      onChange={(event) => setMissingMaterialSearch(event.target.value)}
                      placeholder="Buscar material faltante..."
                      className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 pb-1">
                    {['Todos', ...missingMaterialCategories].map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setMissingMaterialCategory(category)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          missingMaterialCategory === category ? 'bg-amber-500 text-white' : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {filteredMissingMaterials.length > 0 ? filteredMissingMaterials.map((material) => {
                    const quantity = missingMaterials[material.id] ?? 0
                    const checked = quantity > 0
                    return (
                      <div key={material.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setMissingMaterials((prev) =>
                              checked
                                ? Object.fromEntries(Object.entries(prev).filter(([id]) => id !== material.id))
                                : { ...prev, [material.id]: 1 },
                            )
                          }}
                          className="mt-1"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{material.name}</span>
                          <span className="block text-[11px] text-muted-foreground">{material.category || 'Otros'}</span>
                        </span>
                        {checked ? (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={quantity}
                            onChange={(event) => {
                              const nextQuantity = Math.max(1, Number(event.target.value) || 1)
                              setMissingMaterials((prev) => ({ ...prev, [material.id]: nextQuantity }))
                            }}
                            className="h-8 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm"
                            aria-label={`Cantidad faltante de ${material.name}`}
                          />
                        ) : null}
                      </div>
                    )
                  }) : (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">No hay materiales que coincidan.</p>
                  )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No hay materiales configurados.</p>
              )}
            </div>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mt-3 w-full rounded-xl border border-destructive/40 bg-background px-3 py-2 text-sm text-foreground focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/20"
              rows={4}
              placeholder="Añade más detalle del incidente o la situación observada..."
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleReject}
                disabled={isRejecting || (!rejectionReason.trim() && !rejectionReasons.length && Object.keys(missingMaterials).length === 0)}
                className="flex w-full items-center justify-center rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50 sm:w-auto"
              >
                {isRejecting ? 'Enviando a revisión...' : 'Enviar a revisión'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRejectForm(false)
                  setRejectionReason('')
                  setRejectionReasons([])
                  setMissingMaterials({})
                  setMissingMaterialSearch('')
                  setMissingMaterialCategory('Todos')
                }}
                className="flex w-full items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold sm:w-auto"
              >
                Volver
              </button>
            </div>
          </div>
        ) : null}

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Estado del trabajo</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {visibleStatuses.map((s, i) => {
            const label = s === 'finalizado' ? 'Finalizada' : s === 'en camino' ? 'En camino' : s === 'en proceso' ? 'En proceso' : 'Pendiente'
            return (
              <button
                key={s}
                onClick={async () => handleStatusChange(s as ServiceStatus)}
                className={cn(
                  'rounded-lg py-2 text-[10px] font-medium leading-tight transition-colors',
                  i <= statusIdx
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              'flex min-w-[90px] flex-col items-center gap-1 rounded-xl border py-2 px-3 text-[10px] font-medium',
              section === s.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground',
            )}
          >
            <s.icon className="size-4" />
            <span className="text-[11px]">{s.label}</span>
          </button>
        ))}
      </div>

      {section === 'checklist' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-secondary/10 p-4">
            <p className="text-sm font-semibold">Reglas de oro del electricista</p>
            <ol className="mt-3 space-y-2 pl-4 text-sm text-muted-foreground list-decimal">
              {electricianGoldenRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Checklist de orden</p>
              <div className="space-y-2">
                {orderChecklistEntries.map((item, i) => {
                  const itemText = item.text || ''
                  const index = checklist.findIndex((checkItem) => checkItem.id === item.id && checkItem.source === 'order')
                  return (
                    <button
                      key={`order-${item.id}-${i}`}
                      onClick={() =>
                        setChecked((prev) => (Array.isArray(prev) ? prev.map((c, idx) => (idx === index ? !c : c)) : []))
                      }
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"
                    >
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-md border',
                          checked[index] ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                        )}
                      >
                        {checked[index] && <CheckCircle2 className="size-3.5" />}
                      </span>
                      <span className={cn('text-sm', checked[index] && 'text-muted-foreground line-through')}>
                        {itemText}
                      </span>
                    </button>
                  )
                })}
                {checklist.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay items de checklist de orden configurados.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Verificaciones del servicio</p>
              <div className="space-y-2">
                {serviceChecklistEntries.map((item, i) => {
                  const itemText = item.text || ''
                  const index = checklist.findIndex((checkItem) => checkItem.id === item.id && checkItem.source === 'service')
                  return (
                    <button
                      key={`service-${item.id}-${i}`}
                      onClick={() =>
                        setChecked((prev) => (Array.isArray(prev) ? prev.map((c, idx) => (idx === index ? !c : c)) : []))
                      }
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"
                    >
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-md border',
                          checked[index] ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                        )}
                      >
                        {checked[index] && <CheckCircle2 className="size-3.5" />}
                      </span>
                      <span className={cn('text-sm', checked[index] && 'text-muted-foreground line-through')}>
                        {itemText}
                      </span>
                    </button>
                  )
                })}
                {serviceChecklistEntries.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay items de verificaciones del servicio configurados para este tipo de solicitud.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {section === 'fotos' && (
        <div className="space-y-4">
          <PhotoBlock
            title="Antes"
            photos={beforePhotoUrls}
            uploading={photoUploading}
            uploadError={photoUploadError}
            onUpload={(file) => handleUploadPhoto('before', file)}
            onRemove={(index) => setBeforePhotoUrls((prev) => prev.filter((_, i) => i !== index))}
            inputRef={beforeInputRef}
          />
          <PhotoBlock
            title="Después"
            photos={afterPhotoUrls}
            uploading={photoUploading}
            uploadError={photoUploadError}
            onUpload={(file) => handleUploadPhoto('after', file)}
            onRemove={(index) => setAfterPhotoUrls((prev) => prev.filter((_, i) => i !== index))}
            inputRef={afterInputRef}
          />
        </div>
      )}

      {section === 'materiales' && (
        <Materials
          availableMaterials={availableMaterials}
          configuredMaterials={configuredMaterials}
          usedMaterials={usedMaterials}
          onUsedMaterialsChange={setUsedMaterials}
          description={materialsDescription}
          onDescriptionChange={setMaterialsDescription}
        />
      )}

      {section === 'calculadora' && (
        <CircuitCalculator
          onUseSummary={(summary) => {
            setMaterialsDescription((prev) => `${prev}${prev ? '\n' : ''}${summary}`.trim())
          }}
        />
      )}

      {section === 'evidence' && (
        <EvidenceSection
          order={order}
          serviceTemplates={serviceChecklistEntries}
          beforePhotoUrls={beforePhotoUrls}
          afterPhotoUrls={afterPhotoUrls}
          onSave={async (evidence) => {
            const result = await saveOrdenEvidence(String((order as any).id), evidence)
            if (!result.success) {
              alert(result.error || 'No se pudo guardar la evidencia')
            }
          }}
        />
      )}

      {section === 'firma' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Solicita al cliente firmar para conformidad del trabajo realizado.
          </p>
          <SignaturePad onSign={setSigned} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        {generated ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-8 text-primary" />
            <div>
              <p className="text-sm font-semibold">Informe generado</p>
              <p className="text-xs text-muted-foreground">
                informe-{(order as any).id}.pdf enviado al cliente
              </p>
            </div>
          </div>
        ) : (
          <>
            <button
              disabled={!canFinish}
              onClick={handleFinalize}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-40"
            >
              <FileText className="size-4" />
              Finalizar y generar informe PDF
            </button>
            {!canFinish && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Completa el checklist y captura la firma para finalizar
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EvidenceSection({
  order,
  serviceTemplates,
  beforePhotoUrls,
  afterPhotoUrls,
  onSave,
}: {
  order: WorkOrder
  serviceTemplates: Array<{ id: string; text: string; required?: boolean; materials?: any[]; evidence?: any }>
  beforePhotoUrls: string[]
  afterPhotoUrls: string[]
  onSave: (evidence: Record<string, any>) => Promise<void>
}) {
  const evidenceData = parseEvidence((order as any).technicalEvidence) || {}
  const [saving, setSaving] = useState(false)

  const [localEvidence, setLocalEvidence] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {}
    if (serviceTemplates && serviceTemplates.length) {
      for (const t of serviceTemplates) {
        initial[String(t.id)] = evidenceData[String(t.id)] ?? {
          voltage: '',
          current: '',
          earthResistance: '',
          continuity: '',
          observations: '',
          evidenceRequirements: {
            photosBefore: Boolean(t.evidence?.photosBefore),
            photosAfter: Boolean(t.evidence?.photosAfter),
            measurements: Boolean(t.evidence?.measurements),
          },
        }
      }
    } else {
      initial['legacy'] = evidenceData || { voltage: '', current: '', earthResistance: '', continuity: '', observations: '' }
    }
    return initial
  })

  useEffect(() => {
    const parsed = parseEvidence((order as any).technicalEvidence) || {}
    setLocalEvidence((prev) => {
      const next: Record<string, any> = { ...prev }
      if (serviceTemplates && serviceTemplates.length) {
        for (const t of serviceTemplates) {
          next[String(t.id)] = parsed[String(t.id)] ?? prev[String(t.id)] ?? {
            voltage: '',
            current: '',
            earthResistance: '',
            continuity: '',
            observations: '',
            evidenceRequirements: {
              photosBefore: Boolean(t.evidence?.photosBefore),
              photosAfter: Boolean(t.evidence?.photosAfter),
              measurements: Boolean(t.evidence?.measurements),
            },
          }
        }
      } else {
        next['legacy'] = parsed || prev['legacy'] || { voltage: '', current: '', earthResistance: '', continuity: '', observations: '' }
      }
      return next
    })
  }, [order, serviceTemplates])

  const handleChange = (templateId: string, field: string, value: string) => {
    setLocalEvidence((prev) => ({ ...prev, [templateId]: { ...(prev[templateId] || {}), [field]: value } }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = serviceTemplates && serviceTemplates.length
        ? Object.fromEntries(serviceTemplates.map((template) => {
            const templateId = String(template.id)
            const currentValue = localEvidence[templateId] || {}
            return [templateId, {
              ...currentValue,
              evidenceRequirements: {
                photosBefore: Boolean(template.evidence?.photosBefore),
                photosAfter: Boolean(template.evidence?.photosAfter),
                measurements: Boolean(template.evidence?.measurements),
              },
            }]
          }))
        : (localEvidence['legacy'] || {})
      await onSave(payload)
      alert('Evidencia técnica guardada correctamente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {serviceTemplates && serviceTemplates.length ? (
        <div className="space-y-4">
          {serviceTemplates.map((t) => {
            const id = String(t.id)
            const e = localEvidence[id] || {
              voltage: '',
              current: '',
              earthResistance: '',
              continuity: '',
              observations: '',
              evidenceRequirements: {
                photosBefore: Boolean(t.evidence?.photosBefore),
                photosAfter: Boolean(t.evidence?.photosAfter),
                measurements: Boolean(t.evidence?.measurements),
              },
            }
            const requiresPhotosBefore = Boolean(t.evidence?.photosBefore)
            const requiresPhotosAfter = Boolean(t.evidence?.photosAfter)
            const requiresMeasurements = Boolean(t.evidence?.measurements)
            const shouldShowMeasurements = requiresMeasurements || (!requiresPhotosBefore && !requiresPhotosAfter)

            return (
              <div key={id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{t.text || 'Evidencia'}</p>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {requiresPhotosBefore || requiresPhotosAfter || requiresMeasurements
                      ? 'Requisitos configurados'
                      : 'Sin requisitos extra'}
                  </span>
                </div>

                {(requiresPhotosBefore || requiresPhotosAfter || requiresMeasurements) && (
                  <div className="mt-3 rounded-2xl border border-border bg-background/70 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Requisitos del checklist</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {requiresPhotosBefore && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">Fotos antes</span>}
                      {requiresPhotosAfter && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">Fotos después</span>}
                      {requiresMeasurements && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">Mediciones</span>}
                    </div>
                  </div>
                )}

                {shouldShowMeasurements && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2 rounded-2xl border border-border bg-card p-3">
                      <span className="text-xs font-semibold text-muted-foreground">Voltaje</span>
                      <input value={e.voltage || ''} onChange={(ev) => handleChange(id, 'voltage', ev.target.value)} placeholder="Ej: 230 V" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
                    </label>
                    <label className="space-y-2 rounded-2xl border border-border bg-card p-3">
                      <span className="text-xs font-semibold text-muted-foreground">Corriente</span>
                      <input value={e.current || ''} onChange={(ev) => handleChange(id, 'current', ev.target.value)} placeholder="Ej: 10 A" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
                    </label>
                    <label className="space-y-2 rounded-2xl border border-border bg-card p-3">
                      <span className="text-xs font-semibold text-muted-foreground">Resistencia de tierra</span>
                      <input value={e.earthResistance || ''} onChange={(ev) => handleChange(id, 'earthResistance', ev.target.value)} placeholder="Ej: 0.5 Ω" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
                    </label>
                    <label className="space-y-2 rounded-2xl border border-border bg-card p-3">
                      <span className="text-xs font-semibold text-muted-foreground">Continuidad</span>
                      <input value={e.continuity || ''} onChange={(ev) => handleChange(id, 'continuity', ev.target.value)} placeholder="Ej: OK / fallida" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
                    </label>
                  </div>
                )}

                {(requiresPhotosBefore || requiresPhotosAfter) && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {requiresPhotosBefore && (
                      <div className="rounded-2xl border border-border bg-background p-3">
                        <p className="text-xs font-semibold text-muted-foreground">Fotos antes</p>
                        <p className="mt-2 text-sm text-muted-foreground">Se espera evidencia visual previa. Estas fotos se cargan en la sección de fotos del técnico.</p>
                        <p className="mt-2 text-xs text-muted-foreground">{beforePhotoUrls.length} foto{beforePhotoUrls.length === 1 ? '' : 's'} registradas</p>
                      </div>
                    )}
                    {requiresPhotosAfter && (
                      <div className="rounded-2xl border border-border bg-background p-3">
                        <p className="text-xs font-semibold text-muted-foreground">Fotos después</p>
                        <p className="mt-2 text-sm text-muted-foreground">Se espera evidencia visual final. Estas fotos se cargan en la sección de fotos del técnico.</p>
                        <p className="mt-2 text-xs text-muted-foreground">{afterPhotoUrls.length} foto{afterPhotoUrls.length === 1 ? '' : 's'} registradas</p>
                      </div>
                    )}
                  </div>
                )}

                <label className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-3">
                  <span className="text-xs font-semibold text-muted-foreground">Observaciones</span>
                  <textarea value={e.observations || ''} onChange={(ev) => handleChange(id, 'observations', ev.target.value)} rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
                </label>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <LegacyEvidenceForm evidence={localEvidence['legacy'] || {}} onChange={(next) => setLocalEvidence({ legacy: next })} />
        </div>
      )}

      <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition disabled:opacity-50">
        {saving ? 'Guardando...' : 'Guardar evidencia'}
      </button>
    </div>
  )
}

function LegacyEvidenceForm({ evidence, onChange }: { evidence: any; onChange: (next: any) => void }) {
  const [voltage, setVoltage] = useState(evidence?.voltage || '')
  const [current, setCurrent] = useState(evidence?.current || '')
  const [earthResistance, setEarthResistance] = useState(evidence?.earthResistance || '')
  const [continuity, setContinuity] = useState(evidence?.continuity || '')
  const [observations, setObservations] = useState(evidence?.observations || '')

  useEffect(() => {
    onChange({ voltage, current, earthResistance, continuity, observations })
  }, [voltage, current, earthResistance, continuity, observations])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <span className="text-xs font-semibold text-muted-foreground">Voltaje</span>
          <input value={voltage} onChange={(e) => setVoltage(e.target.value)} placeholder="Ej: 230 V" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
        </label>
        <label className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <span className="text-xs font-semibold text-muted-foreground">Corriente</span>
          <input value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Ej: 10 A" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
        </label>
        <label className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <span className="text-xs font-semibold text-muted-foreground">Resistencia de tierra</span>
          <input value={earthResistance} onChange={(e) => setEarthResistance(e.target.value)} placeholder="Ej: 0.5 Ω" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
        </label>
        <label className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <span className="text-xs font-semibold text-muted-foreground">Continuidad</span>
          <input value={continuity} onChange={(e) => setContinuity(e.target.value)} placeholder="Ej: OK / fallida" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
        </label>
      </div>

      <label className="space-y-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Observaciones técnicas</span>
        <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={4} placeholder="Detalles adicionales sobre mediciones, hallazgos o recomendaciones" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
      </label>
    </div>
  )
}

function PhotoBlock({
  title,
  photos,
  uploading,
  uploadError,
  onUpload,
  onRemove,
  inputRef,
}: {
  title: string
  photos: string[]
  uploading: boolean
  uploadError: string | null
  onUpload: (file: File) => void
  onRemove: (index: number) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary/50"
        >
          {uploading ? 'Subiendo...' : 'Agregar foto'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          if (event.target) event.target.value = ''
        }}
      />
      {uploadError ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{uploadError}</p>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {photos.length > 0 ? (
          photos.map((url, index) => (
            <div key={`${url}-${index}`} className="relative overflow-hidden rounded-xl border border-border bg-background">
              <img src={url} alt={`${title} ${index + 1}`} className="h-28 w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
              >
                Eliminar
              </button>
            </div>
          ))
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border bg-secondary/10 text-sm text-muted-foreground">
            Sin fotos
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{photos.length} foto{photos.length === 1 ? '' : 's'}</span>
        <span>Máx 6 por sección</span>
      </div>
    </div>
  )
}

const materialCatalog = [
  { name: 'Automático 2x25A', price: 12990 },
  { name: 'Cable THHN 2.5mm (m)', price: 890 },
  { name: 'Enchufe doble', price: 3490 },
  { name: 'Cinta aislante', price: 1290 },
]

type Material = { id: string; name: string; price: number; stock?: number; category?: string; purchaseUrl?: string }

interface MaterialsProps {
  availableMaterials: Array<Material>;
  configuredMaterials?: Array<Material & { quantity?: number }>;
  usedMaterials: { [key: string]: number };
  onUsedMaterialsChange: (materials: { [key: string]: number }) => void;
  description?: string;
  onDescriptionChange?: (description: string) => void;
}

function Materials({ availableMaterials, configuredMaterials = [], usedMaterials, onUsedMaterialsChange, description = '', onDescriptionChange }: MaterialsProps) {
  const materials: Material[] = configuredMaterials.length > 0
    ? configuredMaterials.map((material) => ({
        id: material.id,
        name: material.name,
        price: material.price,
        category: material.category || 'Checklist',
      }))
    : availableMaterials.length > 0
      ? availableMaterials
      : materialCatalog.map((m) => ({
          id: m.name,
          name: m.name,
          price: m.price,
          category: 'Otros',
        }))

  const total = materials.reduce((sum, material) => {
    const configured = configuredMaterials.find((entry) => entry.id === material.id)
    const qty = configured?.quantity ?? 1
    return sum + (material.price || 0) * qty
  }, 0)

  const materialList = configuredMaterials.length > 0
    ? configuredMaterials.map((material) => ({
        ...material,
        quantity: Number(material.quantity ?? 1),
      }))
    : materials.map((material) => ({
        id: material.id,
        name: material.name,
        price: material.price,
        category: material.category || 'Checklist',
        quantity: 1,
      }))

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Notas y Descripción</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange?.(e.target.value)}
          placeholder="Describe los materiales utilizados, observaciones o detalles relevantes del trabajo..."
          className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0"
          rows={3}
        />
      </div>

      <div className="rounded-2xl border border-border bg-background/80 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Materiales del checklist</p>
            <p className="mt-1 text-xs text-muted-foreground">Estos materiales vienen desde la configuración del admin y no se editan desde la orden.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Solo lectura</span>
        </div>

        {materialList.length > 0 ? (
          <div className="mt-4 space-y-2">
            {materialList.map((material) => (
              <div key={material.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{material.name}</p>
                  <p className="text-xs text-muted-foreground">{material.category || 'Checklist'} · {formatCLP(material.price || 0)} c/u</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">x{material.quantity}</p>
                  <p className="text-xs text-muted-foreground">{formatCLP((material.price || 0) * material.quantity)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
            No hay materiales configurados para este checklist.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Total de materiales del checklist</p>
          <p className="font-display font-bold">{formatCLP(total)}</p>
        </div>
      </div>
    </div>
  )
}

function ProfilePanel({
  user,
  orders,
  onClose,
  onLogout,
}: {
  user: {
    id?: string
    name?: string
    email?: string
    phone?: string
    role?: string
    lastSeen?: string
  }
  orders: any[]
  onClose: () => void
  onLogout: () => Promise<void>
}) {
  const technicianId = user.id
  const assignedOrders = orders.filter((order) => {
    const orderTechId = order.tecnicoId ?? order.tecnicoid ?? null
    const orderTechName = order.tecnicoNombre ?? order.tecniconombre ?? null
    const matchesId = technicianId ? String(orderTechId) === String(technicianId) : false
    const matchesName = !technicianId && user.name ? String(orderTechName).toLowerCase() === String(user.name).toLowerCase() : false
    const status = String(order.status ?? (order as any).estado ?? '').toLowerCase()
    return (matchesId || matchesName) && status !== 'finalizado' && status !== 'rechazado'
  }).length
  const completedOrders = orders.filter((order) => {
    const orderTechId = order.tecnicoId ?? order.tecnicoid ?? null
    const orderTechName = order.tecnicoNombre ?? order.tecniconombre ?? null
    const matchesId = technicianId ? String(orderTechId) === String(technicianId) : false
    const matchesName = !technicianId && user.name ? String(orderTechName).toLowerCase() === String(user.name).toLowerCase() : false
    return (matchesId || matchesName) && String(order.status ?? (order as any).estado ?? '').toLowerCase() === 'finalizado'
  }).length
  const totalAssigned = orders.filter((order) => {
    const orderTechId = order.tecnicoId ?? order.tecnicoid ?? null
    const orderTechName = order.tecnicoNombre ?? order.tecniconombre ?? null
    const matchesId = technicianId ? String(orderTechId) === String(technicianId) : false
    const matchesName = !technicianId && user.name ? String(orderTechName).toLowerCase() === String(user.name).toLowerCase() : false
    return matchesId || matchesName
  }).length
  const onTimeRate = totalAssigned > 0 ? Math.round((completedOrders / totalAssigned) * 100) : 100

  return (
    <div className="fixed right-4 top-20 z-50 w-[320px] rounded-3xl border border-border bg-card p-4 shadow-2xl">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <span className="text-lg font-semibold">{user.name?.[0] ?? 'T'}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Perfil técnico</p>
          <p className="text-lg font-semibold leading-tight">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.role ?? 'Técnico de campo'}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-3xl bg-background/80 p-4 text-sm text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">Email</span>
          <span className="truncate text-right">{user.email ?? 'no disponible'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">Teléfono</span>
          <span className="truncate text-right">{user.phone ?? 'no disponible'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">Última conexión</span>
          <span className="text-right">{user.lastSeen ?? 'Hoy'}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-3xl bg-primary/5 p-3">
          <p className="text-lg font-semibold text-primary">{assignedOrders}</p>
          <p className="text-[11px] text-muted-foreground">Asignadas</p>
        </div>
        <div className="rounded-3xl bg-secondary/5 p-3">
          <p className="text-lg font-semibold">{completedOrders}</p>
          <p className="text-[11px] text-muted-foreground">Completadas</p>
        </div>
        <div className="rounded-3xl bg-accent/5 p-3">
          <p className="text-lg font-semibold">{onTimeRate}%</p>
          <p className="text-[11px] text-muted-foreground">A tiempo</p>
        </div>
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
