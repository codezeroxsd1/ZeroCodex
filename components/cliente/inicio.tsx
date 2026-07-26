'use client'

import { useMemo } from 'react'
import { Zap, Siren, CalendarPlus, ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react'
import { formatCLP, type ServiceStatus } from '@/lib/data'
import { StatusBadge } from '@/components/status-badge'
import type { ClienteTab } from './cliente-app'
import { useConfiguredServices } from './use-configured-services'

export function ClienteInicio({
  orders,
  userName,
  onSelectService,
  onGoTab,
}: {
  orders: any[]
  userName?: string | null
  onSelectService: (id: string) => void
  onGoTab: (tab: ClienteTab) => void
}) {
  const { services } = useConfiguredServices()
  const featured = services.slice(0, 6)

  const latestOrder = useMemo(() => {
    return orders
      .filter((o) => Boolean(o.estado || o.status || o.id))
      .sort((a, b) => {
        const aDate = new Date(a.date || a.createdAt || a.localDate || a.created_at || 0).getTime()
        const bDate = new Date(b.date || b.createdAt || b.localDate || b.created_at || 0).getTime()
        return bDate - aDate
      })[0]
  }, [orders])

  const hasActiveOrder = Boolean(latestOrder && String(latestOrder.estado || latestOrder.status || '').toLowerCase() !== 'finalizado')
  const activeStatus = (String(latestOrder?.estado || latestOrder?.status || 'pendiente').toLowerCase() as ServiceStatus)
  const activeServiceName = String(latestOrder?.categoria || latestOrder?.service || 'Sin servicio')
  const activeTechnician = latestOrder?.tecnicoNombre ? String(latestOrder.tecnicoNombre) : 'Pendiente de asignar'
  const activeEta = latestOrder?.eta || 'Próximamente'
  const greetingName = userName?.trim() || 'Cliente'

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 to-card p-5 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-6">
          <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/20 blur-2xl" />
          <div>
            <p className="text-sm text-muted-foreground">Hola, {greetingName} 👋</p>
            <h2 className="mt-1 max-w-[15rem] text-balance font-display text-2xl font-bold leading-tight lg:max-w-none">
              ¿Necesitas un electricista hoy?
            </h2>
            <button
              onClick={() => onSelectService('diagnostico')}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              <Zap className="size-4" />
              Solicitar servicio
            </button>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-background/60 p-4 text-sm text-muted-foreground lg:ml-auto lg:max-w-sm">
            Atención rápida, seguimiento claro y pagos sencillos desde cualquier dispositivo.
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            onClick={() => onSelectService('reparaciones')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-left"
          >
            <Siren className="size-6 text-destructive" />
            <span className="text-sm font-semibold text-destructive">Emergencia 24/7</span>
            <span className="text-xs text-muted-foreground">Atención inmediata</span>
          </button>
          <button
            onClick={() => onSelectService('mantenimiento')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left"
          >
            <CalendarPlus className="size-6 text-primary" />
            <span className="text-sm font-semibold">Agendar visita</span>
            <span className="text-xs text-muted-foreground">Elige fecha y hora</span>
          </button>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Servicio en curso</span>
              <StatusBadge status={activeStatus} />
            </div>
            <p className="font-display text-lg font-bold">{activeServiceName}</p>
            {hasActiveOrder ? (
              <p className="text-sm text-muted-foreground">
                Técnico {activeTechnician} · llega en {activeEta}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay servicio en curso. Envía una solicitud para comenzar.
              </p>
            )}
          </div>
          <button
            onClick={() => onGoTab('estado')}
            className="mt-3 flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium lg:mt-0"
          >
            Ver seguimiento en tiempo real
            <ArrowRight className="size-4 text-primary" />
          </button>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-bold">Servicios populares</h3>
            <button
              onClick={() => onGoTab('servicios')}
              className="flex items-center gap-0.5 text-xs font-medium text-primary"
            >
              Ver todos <ChevronRight className="size-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {featured.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectService(s.id)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center transition-colors hover:border-primary/40"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <s.icon className="size-5" />
                </span>
                <span className="text-[11px] font-medium leading-tight">{s.short}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <ShieldCheck className="size-8 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Trabajos garantizados</p>
            <p className="text-xs text-muted-foreground">
              Técnicos certificados y garantía escrita desde {formatCLP(19990)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
