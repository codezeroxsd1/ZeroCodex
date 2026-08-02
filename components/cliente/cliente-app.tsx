'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Home,
  LayoutGrid,
  Activity,
  Clock,
  Bot,
  ChevronLeft,
  Phone,
  User,
  LogIn,
  Bell,
  FileText,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/logo'
import { ZeroIA } from '@/components/zero-ia'
import { ClienteInicio } from './inicio'
import { ClienteServicios } from './servicios'
import { ClienteSolicitar } from './solicitar'
import { ClienteEstado } from './estado'
import { ClienteHistorial } from './historial'
import { useSession, signOut } from '@/lib/auth-client'
import { diffOrderNotifications } from '@/lib/notifications'
import { formatCLP } from '@/lib/data'
import QuotePreview from './quote-preview'

export type ClienteTab = 'inicio' | 'servicios' | 'estado' | 'historial' | 'zeroia' | 'cotizaciones'

const tabs: { id: ClienteTab; label: string; icon: typeof Home }[] = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'servicios', label: 'Servicios', icon: LayoutGrid },
  { id: 'estado', label: 'Estado', icon: Activity },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText },
  { id: 'historial', label: 'Historial', icon: Clock },
  { id: 'zeroia', label: 'Zero IA', icon: Bot },
]

const titles: Record<ClienteTab, string> = {
  inicio: 'Zero Industries',
  servicios: 'Servicios',
  estado: 'Estado del servicio',
  cotizaciones: 'Cotizaciones',
  historial: 'Historial y garantías',
  zeroia: 'Zero IA',
}

export function ClienteApp() {
  const router = useRouter()
  const { data: session } = useSession()
  const sessionUser = session?.user as { clientType?: string } | undefined
  const isEmpresaClient = sessionUser?.clientType === 'empresa'
  const [tab, setTab] = useState<ClienteTab>('inicio')
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalOrder, setModalOrder] = useState<any | null>(null)
  const ordersRef = useRef<any[]>([])
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
  const quoteOrders = orders.filter((order) => {
    const status = String(order.status ?? order.estado ?? '').trim().toLowerCase()
    const rawFeedback = order.feedback ?? order.notasTecnico ?? order.notastecnico ?? order.notas_tecnico ?? order.notes ?? null
    const feedback = parseFeedback(rawFeedback)
    const hasSentQuote = feedback && typeof feedback === 'object' && (
      (feedback as any).sent === true ||
      (feedback as any).quote?.sent === true
    )
    const visibleQuoteStatuses = ['cotizado', 'recotizando', 'aceptada', 'pendiente_pago', 'pagada']
    return visibleQuoteStatuses.includes(status) && hasSentQuote
  })

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch('/api/cliente/orders', { cache: 'no-store' })
        if (!response.ok) {
          const nextOrders: any[] = []
          ordersRef.current = nextOrders
          setOrders(nextOrders)
          return
        }
        const payload = await response.json().catch(() => ({ orders: [] }))
        const nextOrders = Array.isArray(payload.orders) ? payload.orders : []
        const incoming = diffOrderNotifications(ordersRef.current, nextOrders, 'cliente')

        if (ordersRef.current.length > 0 && incoming.length > 0) {
          setNotifications((current) => [...incoming, ...current].slice(0, 20))
          setHasUnreadNotifications(true)
        }

        ordersRef.current = nextOrders
        setOrders(nextOrders)
      } catch (error) {
        console.error('Error loading cliente orders:', error)
      }
    }

    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [])

  const averageRating = (() => {
    if (!session?.user) return 0
    let total = 0
    let count = 0
    for (const o of orders) {
      const clientId = o.clienteId ?? o.clienteid ?? o.cliente ?? o.client ?? null
      // only consider orders for this client
      if (!clientId) continue
      // try to match by session user id or email/name
      if (String(clientId) !== String(session.user.id) && String(o.client) !== String(session.user.name)) continue
      const parsed = parseFeedback(o.feedback ?? o.notasTecnico ?? o.notastecnico ?? null)
      const techGaveClientRating = parsed?.clientRating?.score ?? (typeof parsed?.clientRating === 'number' ? parsed.clientRating : undefined)
      if (techGaveClientRating !== undefined && techGaveClientRating !== null) {
        total += Number(techGaveClientRating) || 0
        count += 1
      }
    }
    return count > 0 ? Math.round((total / count) * 10) / 10 : 0
  })()

  useEffect(() => {
    if (showNotifications) {
      setHasUnreadNotifications(false)
    }
  }, [showNotifications])

  function openService(id: string) {
    setSelectedService(id)
  }

  return (
    <div className={cn("relative h-screen w-full overflow-hidden bg-background", isEmpresaClient && "empresa-theme")}>
      <div className="flex h-full w-full flex-col lg:flex-row">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/80 lg:flex">
          <div className="border-b border-border p-5">
            <Logo size={34} withText />
            <p className="mt-2 text-sm text-muted-foreground">Portal de servicio pensado para móvil y escritorio.</p>
          </div>
          <div className="p-3">
            <div className="rounded-2xl border border-border bg-background/60 p-3 text-sm">
              <p className="font-semibold">Calificación</p>
              <p className="mt-1 flex items-center gap-2">
                <Star className="size-4 fill-warning text-warning" />
                <span className="font-semibold">{averageRating ?? 0}</span>
                <span className="text-xs text-muted-foreground">promedio</span>
              </p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {tabs.map((t) => {
              const active = tab === t.id && !selectedService
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedService(null)
                    setTab(t.id)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <t.icon className="size-4" />
                  {t.label}
                </button>
              )
            })}
          </nav>
          <div className="border-t border-border p-3">
            <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">
              Volver al inicio
            </Link>
          </div>
        </aside>

        <div className="flex h-full flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:px-6">
            {selectedService ? (
              <button
                onClick={() => setSelectedService(null)}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground"
              >
                <ChevronLeft className="size-4" /> Volver
              </button>
            ) : tab === 'inicio' ? (
              <Logo size={30} withText />
            ) : (
              <span className="font-display text-base font-bold">{titles[tab]}</span>
            )}
            <div className="flex items-center gap-2 relative">
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
                className="relative flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent/10"
                aria-label="Notificaciones"
              >
                <Bell className="size-4" />
                {hasUnreadNotifications && notifications.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary" />
                )}
              </button>
              <button
                onClick={() => setShowProfile((v) => !v)}
                className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent/10"
                aria-label="Perfil"
              >
                <User className="size-4" />
              </button>
            </div>
          </header>

          {showNotifications && (
            <div className="fixed right-4 top-20 z-50 w-[320px] rounded-3xl border border-border bg-card p-4 shadow-2xl lg:right-16">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Notificaciones</p>
                  <p className="text-lg font-semibold">Actualizaciones de tu solicitud</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Cerrar
                </button>
              </div>
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="rounded-3xl border border-border bg-background/80 p-4 text-center text-sm text-muted-foreground">
                    No hay notificaciones nuevas por ahora.
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
            <ClienteProfilePanel
              user={
                session?.user ??
                {
                  name: 'Cliente',
                  email: 'usuario@dominio.com',
                  role: 'cliente',
                  phone: undefined,
                }
              }
              orders={orders}
              onClose={() => setShowProfile(false)}
              onLogout={async () => {
                try {
                  await signOut()
                } catch (error) {
                  console.error('Error during sign out:', error)
                }
                router.push('/sign-in/cliente')
              }}
            />
          )}

          <main className="flex-1 overflow-y-auto px-2 pb-24 sm:px-4 lg:pb-6">
            {selectedService ? (
              <ClienteSolicitar serviceId={selectedService} onDone={() => setSelectedService(null)} />
            ) : (
              <>
                {tab === 'inicio' && (
                  <ClienteInicio
                    orders={orders}
                    userName={session?.user?.name}
                    onSelectService={openService}
                    onGoTab={setTab}
                  />
                )}
                {tab === 'servicios' && <ClienteServicios onSelectService={openService} />}
                {tab === 'estado' && <ClienteEstado orders={orders} />}
                {tab === 'cotizaciones' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <p className="text-lg font-semibold">Cotizaciones</p>
                      <p className="mt-2 text-sm text-muted-foreground">Aquí verás las cotizaciones enviadas para tu solicitud.</p>
                    </div>
                    {quoteOrders.length === 0 ? (
                      <div className="rounded-2xl border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                        No tienes cotizaciones enviadas aún. Cuando te envíen una cotización, aparecerá aquí.
                      </div>
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {quoteOrders.map((order) => (
                          <div key={order.id} className="rounded-2xl border border-border bg-card p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                <p className="text-sm text-muted-foreground">{order.id} · {order.date ?? order.createdAt}</p>
                                <p className="mt-1 font-semibold">{order.categoria || order.service || 'Solicitud'}</p>
                                {order.orderId || order.id ? (
                                  <p className="text-xs text-muted-foreground">Orden: #{order.orderId ?? order.id}</p>
                                ) : null}
                              </div>
                              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Cotizado</span>
                            </div>
                            <div className="mt-4 text-sm text-muted-foreground">
                              <p>{order.descripcion || order.notes || 'Sin detalles adicionales.'}</p>
                            </div>
                            <div className="mt-4 flex items-center justify-between text-sm text-foreground">
                              <span>Total estimado</span>
                              <span className="font-semibold">{formatCLP(Number(order.precio ?? order.price ?? 0))}</span>
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const normalized = {
                                    ...order,
                                    feedback: order.feedback ?? order.notasTecnico ?? order.notastecnico ?? order.notas_tecnico ?? order.notes ?? null,
                                  }
                                  setModalOrder(normalized)
                                  setModalOpen(true)
                                }}
                                className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-white hover:opacity-95"
                              >
                                Ver cotización
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {tab === 'historial' && <ClienteHistorial orders={orders} />}
                {tab === 'zeroia' && (
                  <ZeroIA
                    orders={orders}
                    compact
                    onGoTab={setTab}
                    onSelectService={openService}
                  />
                )}
              </>
            )}
          </main>

          {modalOpen && modalOrder ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4">
              <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-border bg-card p-6">
                <QuotePreview quote={modalOrder} onClose={() => setModalOpen(false)} />
              </div>
            </div>
          ) : null}

          <nav className="absolute inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur lg:hidden">
            <div className="flex items-center justify-around px-2 py-2">
              {tabs.map((t) => {
                const active = tab === t.id && !selectedService
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedService(null)
                      setTab(t.id)
                    }}
                    className={cn(
                      'flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    <t.icon className={cn('size-5', active && 'drop-shadow-[0_0_8px_var(--primary)]')} />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </nav>

        </div>
      </div>
    </div>
  )
}

function ClienteProfilePanel({
  user,
  orders,
  onClose,
  onLogout,
}: {
  user: {
    name?: string
    email?: string
    phone?: string
    role?: string
    clientType?: string
    companyName?: string
    companyRut?: string
    companyEmail?: string
    companyPhone?: string
    companyAddress?: string
  }
  orders: any[]
  onClose: () => void
  onLogout: () => Promise<void>
}) {
  const requested = orders.length
  const inProgress = orders.filter((o) => {
    const status = String(o.status ?? o.estado ?? '').toLowerCase()
    return status === 'pendiente' || status === 'en camino' || status === 'en curso' || status === 'en proceso'
  }).length
  const completed = orders.filter((o) => String(o.status ?? o.estado ?? '').toLowerCase() === 'finalizado').length
  const latestOrderDate = orders
    .map((order) => new Date(order.date || order.createdAt || order.localDate || order.created_at || order.createdAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0]

  return (
    <div className="fixed right-4 top-20 z-50 w-[320px] rounded-3xl border border-border bg-card p-4 shadow-2xl lg:right-16">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <span className="text-lg font-semibold">{user.name?.[0] ?? 'C'}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cuenta cliente</p>
          <p className="text-lg font-semibold leading-tight">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Cliente'}</p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-border bg-background/80 p-4 text-sm text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">Email</span>
          <span className="truncate text-right">{user.email ?? 'no disponible'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-muted-foreground">Teléfono</span>
          <span className="truncate text-right">{user.phone ?? 'no disponible'}</span>
        </div>
        <div className="mt-4 grid gap-3 rounded-3xl bg-card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tipo de cliente</p>
          <p className="font-semibold">{user.clientType === 'empresa' ? 'Empresa' : 'Particular'}</p>

          {user.clientType === 'empresa' ? (
            <div className="space-y-3 pt-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="font-medium">Empresa</span>
                <span className="truncate text-right">{user.companyName ?? 'No registrada'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">RUT</span>
                <span className="truncate text-right">{user.companyRut ?? 'No registrada'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Email empresa</span>
                <span className="truncate text-right">{user.companyEmail ?? 'No registrada'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Teléfono empresa</span>
                <span className="truncate text-right">{user.companyPhone ?? 'No disponible'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Dirección empresa</span>
                <span className="truncate text-right">{user.companyAddress ?? 'No disponible'}</span>
              </div>
            </div>
          ) : (
            <p className="pt-3 text-sm text-muted-foreground">Te mostramos los datos de contacto usados para tus solicitudes.</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-3xl bg-primary/5 p-3">
          <p className="text-lg font-semibold text-primary">{requested}</p>
          <p className="text-[11px] text-muted-foreground">Solicitadas</p>
        </div>
        <div className="rounded-3xl bg-secondary/5 p-3">
          <p className="text-lg font-semibold">{inProgress}</p>
          <p className="text-[11px] text-muted-foreground">En curso</p>
        </div>
        <div className="rounded-3xl bg-accent/5 p-3">
          <p className="text-lg font-semibold">{completed}</p>
          <p className="text-[11px] text-muted-foreground">Finalizadas</p>
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
