'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Phone, MessageCircle, Navigation, Star } from 'lucide-react'
import { statusOrder, formatCLP, type ServiceStatus } from '@/lib/data'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import { updateOrdenStatus } from '@/app/actions/orden'

export function ClienteEstado({ orders }: { orders: any[] }) {
  const router = useRouter()
  const [reviewMode, setReviewMode] = useState<'approve' | 'reclaim' | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reclaimReason, setReclaimReason] = useState('El técnico no se presentó / No realizó el trabajo')
  const [reclaimDetails, setReclaimDetails] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null)

  const activeOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const status = String(o.estado || o.status || '').toLowerCase()
        return status !== 'finalizado' && status !== 'rechazado'
      })
      .filter((o) => Boolean(o.estado || o.status || o.id))
  }, [orders])

  const latestOrder = useMemo(() => {
    return activeOrders
      .sort((a, b) => {
        const aDate = new Date(a.date || a.createdAt || a.localDate || a.created_at || 0).getTime()
        const bDate = new Date(b.date || b.createdAt || b.localDate || b.created_at || 0).getTime()
        return bDate - aDate
      })[0]
  }, [activeOrders])

  const shouldShowValidationCard = useMemo(() => {
    const status = String(latestOrder?.estado || latestOrder?.status || '').toLowerCase()
    const isQuoteLike = Boolean(latestOrder?.quote || latestOrder?.cotizacion || latestOrder?.isQuote || latestOrder?.quoteId || latestOrder?.quoteStatus)
    const isRequestLike = !isQuoteLike && (status === 'por_validar' || status === 'en_reclamo')

    return isRequestLike
  }, [latestOrder])

  const hasOrder = Boolean(latestOrder)
  const currentStatus = (String(latestOrder?.estado || latestOrder?.status || 'pendiente').toLowerCase() as ServiceStatus)
  const effectiveStatus = (submittedStatus ?? currentStatus) as ServiceStatus
  const currentIdx = Math.max(0, statusOrder.indexOf(effectiveStatus))

  const trackingSteps = useMemo(() => {
    const normalized = String(effectiveStatus).toLowerCase()
    const safeSteps = [
      { key: 'pendiente', label: 'Solicitud recibida' },
      { key: 'en camino', label: 'Técnico en camino' },
      { key: 'en proceso', label: 'Servicio en proceso' },
      { key: 'cotizando', label: 'Cotización en preparación' },
      { key: 'cotizado', label: 'Cotización enviada' },
      { key: 'aceptada', label: 'Cotización aceptada' },
      { key: 'pendiente_pago', label: 'Pago pendiente' },
      { key: 'pagada', label: 'Pago recibido' },
      { key: 'por_validar', label: 'Esperando tu confirmación' },
      { key: 'finalizado', label: 'Servicio finalizado' },
      { key: 'en_reclamo', label: 'Reclamo abierto' },
    ]

    const baseIndex = Math.max(0, safeSteps.findIndex((step) => step.key === normalized))
    const steps = safeSteps.slice(Math.max(0, baseIndex - 1), baseIndex + 3)

    if (!steps.some((step) => step.key === normalized)) {
      steps.unshift({ key: 'pendiente', label: 'Solicitud recibida' })
    }

    return steps
  }, [effectiveStatus])
  const technicianName = latestOrder?.tecnicoNombre ? String(latestOrder.tecnicoNombre) : 'Pendiente de asignar'
  const technicianPhone = String(latestOrder?.tecnicoTelefono || latestOrder?.tecnico?.phone || '')
  const serviceName = String(latestOrder?.categoria || latestOrder?.service || 'Sin servicio')
  const orderId = latestOrder?.id ?? 'N/A'
  const orderPrice = Number(latestOrder?.precio ?? latestOrder?.price ?? 0)
  const eta = latestOrder?.eta || 'Próximamente'

  const handleClientValidation = async (action: 'approve' | 'reclaim') => {
    const orderIdToUse = latestOrder?.id ?? latestOrder?.orderId ?? latestOrder?.ordenId
    if (!orderIdToUse) return
    setSubmittingReview(true)
    try {
      const feedback = action === 'approve'
        ? {
            type: 'client_completion_confirmation',
            approved: true,
            rating: reviewRating,
            comment: reviewComment.trim(),
            timestamp: new Date().toISOString(),
          }
        : {
            type: 'client_reclaim',
            approved: false,
            reason: reclaimReason,
            details: reclaimDetails.trim(),
            timestamp: new Date().toISOString(),
          }

      const result = await updateOrdenStatus(String(orderIdToUse), action === 'approve' ? 'finalizado' : 'en_reclamo', {
        feedback: JSON.stringify(feedback),
      })

      if (!result?.success) {
        window.alert(result?.error || 'No se pudo procesar la validación.')
        return
      }

      setSubmittedStatus(action === 'approve' ? 'finalizado' : 'en_reclamo')
      setReviewMode(null)
      setReviewComment('')
      setReviewRating(5)
      setReclaimReason('El técnico no se presentó / No realizó el trabajo')
      setReclaimDetails('')
      router.refresh()
    } catch (error) {
      console.error(error)
      window.alert('No se pudo procesar la validación del servicio.')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (!hasOrder) {
    return (
      <div className="space-y-5 p-4 lg:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Estado del servicio</p>
            <h2 className="mt-4 text-2xl font-bold">Aún no tienes solicitudes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Envía una solicitud desde el menú de servicios para ver el seguimiento de tu orden.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-5">
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
            <div className="relative h-44 bg-[radial-gradient(circle_at_30%_30%,var(--secondary),var(--card))]">
              <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:28px_28px]" />
              <div className="absolute left-6 top-8 flex flex-col items-center">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
                  <Navigation className="size-4" />
                </span>
                <span className="mt-1 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium">
                  Técnico
                </span>
              </div>
              <div className="absolute bottom-8 right-8 flex flex-col items-center">
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
                  <MapPin className="size-4 text-primary" />
                </span>
                <span className="mt-1 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium">Tú</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Orden {orderId}</p>
                <p className="font-display text-base font-bold">{serviceName}</p>
              </div>
              <StatusBadge status={effectiveStatus} />
            </div>
          </section>

          {shouldShowValidationCard && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm">
              <p className="text-sm font-semibold text-amber-700">
                {effectiveStatus === 'en_reclamo'
                  ? 'Tu reclamo fue recibido'
                  : effectiveStatus === 'finalizado'
                    ? 'Servicio cerrado y confirmado'
                    : 'Servicio reportado como terminado — Requiere tu confirmación'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {effectiveStatus === 'en_reclamo'
                  ? 'Un administrador revisará el caso y tomará las medidas necesarias.'
                  : effectiveStatus === 'finalizado'
                    ? 'El trabajo quedó cerrado y confirmado por ti.'
                    : 'Confirma que el trabajo quedó bien o reporta un problema para abrir un reclamo formal.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReviewMode('approve')}
                  className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  Aprobar y conformar
                </button>
                <button
                  type="button"
                  onClick={() => setReviewMode('reclaim')}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium"
                >
                  Reportar problema
                </button>
              </div>

              {reviewMode === 'approve' && (
                <div className="mt-3 space-y-3 rounded-2xl border border-border bg-background/70 p-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Calificación</span>
                    <select
                      value={reviewRating}
                      onChange={(event) => setReviewRating(Number(event.target.value))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2"
                    >
                      {[5,4,3,2,1].map((value) => (
                        <option key={value} value={value}>{value} estrella{value === 1 ? '' : 's'}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Comentario</span>
                    <textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2"
                      placeholder="Describe tu experiencia con el trabajo realizado"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleClientValidation('approve')}
                      disabled={submittingReview}
                      className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    >
                      {submittingReview ? 'Procesando...' : 'Confirmar aprobación'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewMode(null)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {reviewMode === 'reclaim' && (
                <div className="mt-3 space-y-3 rounded-2xl border border-border bg-background/70 p-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Motivo del reclamo</span>
                    <select
                      value={reclaimReason}
                      onChange={(event) => setReclaimReason(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2"
                    >
                      <option>El técnico no se presentó / No realizó el trabajo</option>
                      <option>El trabajo quedó incompleto</option>
                      <option>Falla técnica o mala calidad en la instalación</option>
                      <option>Daños materiales o cobro no autorizado</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detalle</span>
                    <textarea
                      value={reclaimDetails}
                      onChange={(event) => setReclaimDetails(event.target.value)}
                      className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2"
                      placeholder="Explica brevemente el problema que detectaste"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleClientValidation('reclaim')}
                      disabled={submittingReview || !reclaimDetails.trim()}
                      className="rounded-full bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground disabled:opacity-60"
                    >
                      {submittingReview ? 'Procesando...' : 'Enviar reclamo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewMode(null)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 font-display text-lg font-bold text-primary">
              {technicianName?.charAt(0) ?? 'T'}
            </span>
            <div className="flex-1">
              <p className="font-semibold">{technicianName}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-warning text-warning" /> Técnico asignado
              </p>
            </div>
            {technicianPhone ? (
              <a
                href={`tel:${technicianPhone}`}
                className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary"
                aria-label="Llamar"
              >
                <Phone className="size-4" />
              </a>
            ) : null}
            {technicianPhone ? (
              <a
                href={`https://wa.me/${technicianPhone.replace(/[^0-9]/g, '')}`}
                className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
                aria-label="WhatsApp"
              >
                <MessageCircle className="size-4" />
              </a>
            ) : null}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-4 text-sm font-semibold">Seguimiento en tiempo real</p>
            <ol className="relative space-y-5 pl-2">
              {trackingSteps.map((step, i) => {
                const currentStepKey = String(effectiveStatus).toLowerCase()
                const isActive = step.key === currentStepKey
                const activeIndex = trackingSteps.findIndex((item) => item.key === currentStepKey)
                const isDone = activeIndex > i
                return (
                  <li key={`${step.key}-${i}`} className="relative flex items-start gap-3">
                    {i < trackingSteps.length - 1 && (
                      <span
                        className={cn(
                          'absolute left-[11px] top-6 h-[calc(100%+4px)] w-0.5',
                          isDone ? 'bg-primary' : 'bg-secondary',
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                        isDone || isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card',
                        isActive && 'shadow-glow',
                      )}
                    >
                      {isActive && <span className="size-2 animate-ping rounded-full bg-primary-foreground" />}
                    </span>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-medium',
                          isDone || isActive ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {step.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-primary">{eta}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <span className="text-sm text-muted-foreground">Total del servicio</span>
            <span className="font-display text-lg font-bold text-primary">
              {formatCLP(orderPrice)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
