'use client'

import { ShieldCheck, Download, FileText } from 'lucide-react'
import { formatCLP } from '@/lib/data'
import { cn } from '@/lib/utils'

export function ClienteHistorial({ orders }: { orders: any[] }) {
  const normalizeOrderStatus = (order: any) => {
    const raw = String(order?.estado ?? order?.status ?? '').trim().toLowerCase()
    if (!raw) return 'pendiente'
    if (raw.includes('rechaz') || raw.includes('cancel')) return 'rechazado'
    if (raw.includes('final') || raw.includes('termin') || raw.includes('complet') || raw.includes('pagad')) return 'finalizado'
    if (raw.includes('camino')) return 'en camino'
    if (raw.includes('proceso') || raw.includes('progreso') || raw.includes('curso')) return 'en proceso'
    return raw
  }

  const normalizedOrders = [...orders]
    .filter((order) => order && (order.id || order.categoria || order.descripcion || order.service))
    .sort((a, b) => {
      const aDate = new Date(a.date || a.createdAt || a.localDate || a.created_at || 0).getTime()
      const bDate = new Date(b.date || b.createdAt || b.localDate || b.created_at || 0).getTime()
      return bDate - aDate
    })

  const completedOrders = normalizedOrders.filter((order) => normalizeOrderStatus(order) === 'finalizado')

  const totalSpent = completedOrders.reduce((sum, order) => sum + Number(order.precio ?? order.price ?? 0), 0)

  const getStatusLabel = (order: any) => {
    const status = normalizeOrderStatus(order)
    if (status === 'finalizado') return 'Finalizado'
    if (status === 'en camino') return 'En camino'
    if (status === 'en proceso') return 'En proceso'
    if (status === 'rechazado') return 'Rechazado'
    return 'Pendiente'
  }

  const getStatusClasses = (order: any) => {
    const status = normalizeOrderStatus(order)
    if (status === 'finalizado') {
      return 'bg-primary/15 text-primary'
    }
    if (status === 'rechazado') {
      return 'bg-destructive/10 text-destructive'
    }
    return 'bg-secondary text-muted-foreground'
  }

  const getRejectionReason = (order: any) => {
    const raw = order?.notasTecnico ?? order?.feedback ?? order?.motivo ?? order?.reason ?? order?.rejectionReason ?? ''
    if (!raw) return null
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed)
          if (parsed?.type === 'rejection_report') {
            const reasons = Array.isArray(parsed.reasons) ? parsed.reasons : []
            const reasonLabels = reasons.map((reason: string) => reason === 'sin_materiales' ? 'No tenía todos los materiales' : reason === 'falla_incoherente' ? 'La falla no era coherente con la solicitud' : reason === 'cliente_no_responde' ? 'El cliente no respondió' : reason)
            const details = parsed.details ? `Detalle: ${parsed.details}` : ''
            return [...reasonLabels, details].filter(Boolean).join(' • ')
          }
        } catch {
          // ignore
        }
      }
      return trimmed.startsWith('Rechazado por') ? trimmed : `Motivo: ${trimmed}`
    }
    return 'Motivo disponible'
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Solicitudes registradas</p>
            <p className="mt-1 font-display text-2xl font-bold">{normalizedOrders.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Inversión total</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">
              {formatCLP(totalSpent)}
            </p>
          </div>
        </div>

        {normalizedOrders.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">Aún no hay solicitudes registradas.</p>
            <p className="mt-2 text-base font-semibold">Cuando hagas una solicitud, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {normalizedOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{String(order.categoria || order.service || order.descripcion || 'Servicio')}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.date || order.createdAt || order.localDate || order.created_at || '').toLocaleDateString('es-CL')} · Orden {order.id}
                    </p>
                    {order.direccion ? (
                      <p className="mt-1 text-xs text-muted-foreground">{String(order.direccion)}</p>
                    ) : null}
                  </div>
                  <span className="font-display font-bold">{formatCLP(Number(order.precio ?? order.price ?? 0))}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', getStatusClasses(order))}>
                    <ShieldCheck className="size-3.5" />
                    {getStatusLabel(order)}
                  </span>
                </div>

                {normalizeOrderStatus(order) === 'finalizado' ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary py-2 text-xs font-medium"
                      disabled={!order.pdfUrl}
                    >
                      <FileText className="size-3.5 text-primary" /> Ver informe
                    </button>
                    <button
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary py-2 text-xs font-medium"
                      disabled={!order.pdfUrl}
                    >
                      <Download className="size-3.5 text-primary" /> PDF
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {normalizeOrderStatus(order) === 'rechazado' ? (
                      <>
                        <p className="text-sm text-muted-foreground">Esta solicitud fue rechazada.</p>
                        {(() => {
                          const reason = getRejectionReason(order)
                          return reason ? (
                            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-destructive">Motivo del rechazo</p>
                              <p className="mt-1 text-sm text-foreground">{reason}</p>
                            </div>
                          ) : null
                        })()}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Tu solicitud está siendo gestionada.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
