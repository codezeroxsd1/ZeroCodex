'use client'

import { useEffect, useState } from 'react'
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { calcPriceWithIva, calcPriceWithMarkup, formatCLP, getApplicablePromotions, applyPromotionToAmount } from '@/lib/data'
import { cn } from '@/lib/utils'
import { buildDateKeyFromParts } from '@/lib/booking-date'
import { crearOrden } from '@/app/actions/orden'
import { useConfiguredServices } from './use-configured-services'

type Step = 'detalle' | 'agenda' | 'cotizacion' | 'pago' | 'listo'

const hours = ['09:00', '11:00', '13:00', '15:30', '17:00', '19:00']
const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const stepList: Step[] = ['detalle', 'agenda', 'cotizacion', 'pago', 'listo']

export function ClienteSolicitar({
  serviceId,
  onDone,
}: {
  serviceId: string
  onDone: () => void
}) {
  const { services } = useConfiguredServices()
  const service = services.find((s) => s.id === serviceId) ?? services[0]
  const [step, setStep] = useState<Step>('detalle')
  const [day, setDay] = useState(() => String(new Date().getDate()))
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const now = new Date()
    return buildDateKeyFromParts(now.getFullYear(), now.getMonth(), now.getDate())
  })
  const [hour, setHour] = useState('15:30')
  const [address, setAddress] = useState('Av. Providencia 1234, Santiago')
  const [notes, setNotes] = useState('')
  const [pay, setPay] = useState<'online' | 'terreno'>('online')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null)
  const [availability, setAvailability] = useState<Record<string, number>>({})
  const [blockedDays, setBlockedDays] = useState<string[]>([])
  const [blockedHours, setBlockedHours] = useState<string[]>([])
  const [maxRequestsPerSlot, setMaxRequestsPerSlot] = useState(3)
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(3)
  const [minAdvanceDays, setMinAdvanceDays] = useState(1)
  const [calendarOffset, setCalendarOffset] = useState(0)
  const [calendarDays, setCalendarDays] = useState<Array<{ d: string; n: string; dateKey: string }>>([])
  const [promotions, setPromotions] = useState<any[] | undefined>(undefined)

  const base = service.from > 0 ? service.from : 45000
  const visit = service.visitPrice ?? 12000
  const serviceWithMarkup = calcPriceWithMarkup(base, service.markupPercent)
  const totalBeforeIva = serviceWithMarkup + visit
  // apply active promotions that target total
  useEffect(() => {
    let active = true
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((j) => {
        if (!active) return
        setPromotions(Array.isArray(j?.settings?.promotions) ? j.settings.promotions : [])
      })
      .catch(() => {
        if (active) setPromotions([])
      })
    return () => {
      active = false
    }
  }, [])

  const promoCandidates = promotions ?? []
  const activePromos = getApplicablePromotions(promoCandidates, new Date(), service?.id)
  // pick one promotion — prefer service-specific then total; simple first-match logic
  let discounted = totalBeforeIva
  const servicePromos = activePromos.find((p) => p.applyTo === 'service' && Array.isArray(p.serviceIds) && p.serviceIds.includes(service.id))
  const totalPromo = servicePromos ?? activePromos.find((p) => p.applyTo === 'total') ?? null
  if (totalPromo) discounted = applyPromotionToAmount(totalBeforeIva, totalPromo)
  const total = calcPriceWithIva(discounted, service.ivaPercent)
  const idx = stepList.indexOf(step)

  async function handleConfirmReservation() {
    setIsSubmitting(true)
    setSubmissionMessage(null)
    try {
      const dateKey = selectedDateKey || buildDateKeyFromParts(new Date().getFullYear(), new Date().getMonth(), Number(day))

      const result = await crearOrden({
        categoria: service.name,
        descripcion: notes || `Solicitud de ${service.name}`,
        direccion: address,
        urgencia: 'normal',
        precio: total,
        date: dateKey,
        time: hour,
      })

      if (result?.success && result.ordenId) {
        setCreatedOrderId(String(result.ordenId))
        setSubmissionMessage(pay === 'online' ? 'Tu solicitud quedó registrada y ya puedes continuar con el pago.' : 'Tu reserva quedó confirmada. El administrador la revisará pronto.')
        // refresh availability for selected day so UI blocks if capacity reached
        try {
          const resp = await fetch(`/api/agenda/availability?date=${encodeURIComponent(selectedDateKey)}`)
          const json = await resp.json()
          if (json?.success && json.counts) setAvailability(json.counts)
        } catch (e) {
          // ignore
        }
        setStep('listo')
      } else {
        setSubmissionMessage(result?.error || 'No se pudo registrar la solicitud. Intenta nuevamente.')
      }
    } catch (error) {
      console.error(error)
      setSubmissionMessage('No se pudo registrar la solicitud. Intenta nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const json = await res.json()
        setBlockedDays(json?.settings?.blockedDays ?? [])
        setBlockedHours(json?.settings?.blockedHours ?? [])
        const parsedMax = Number(json?.settings?.maxRequestsPerSlot)
        if (Number.isFinite(parsedMax) && parsedMax > 0) {
          setMaxRequestsPerSlot(Math.floor(parsedMax))
        }
        const parsedAdvance = Number(json?.settings?.maxAdvanceDays)
        if (Number.isFinite(parsedAdvance) && parsedAdvance >= 0) {
          setMaxAdvanceDays(Math.floor(parsedAdvance))
        }
        const parsedMinAdvance = Number(json?.settings?.minAdvanceDays)
        if (Number.isFinite(parsedMinAdvance) && parsedMinAdvance >= 0) {
          setMinAdvanceDays(Math.floor(parsedMinAdvance))
        }
      } catch {}
    }
    loadSettings()
  }, [])

  useEffect(() => {
    const now = new Date()
    const visibleDays = Math.max(1, Math.max(1, maxAdvanceDays - minAdvanceDays + 1))
    const baseDays = Array.from({ length: visibleDays }, (_, index) => {
      const next = new Date(now)
      next.setDate(now.getDate() + minAdvanceDays + index + calendarOffset)
      const isToday = index === 0 && calendarOffset === 0 && minAdvanceDays === 0
      return {
        d: isToday ? 'Hoy' : dayNames[next.getDay()],
        n: String(next.getDate()),
        dateKey: buildDateKeyFromParts(next.getFullYear(), next.getMonth(), next.getDate()),
      }
    })
    setCalendarDays(baseDays)
  }, [maxAdvanceDays, minAdvanceDays, calendarOffset])

  useEffect(() => {
    // fetch availability for selected date
    const abort = new AbortController()
    const dateKey = selectedDateKey

    fetch(`/api/agenda/availability?date=${encodeURIComponent(dateKey)}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.counts) setAvailability(json.counts)
      })
      .catch(() => {})

    return () => abort.abort()
  }, [selectedDateKey])

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
        <div className="space-y-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <service.icon className="size-6" />
            </span>
            <div>
              <p className="font-display text-lg font-bold leading-tight">{service.name}</p>
              <p className="text-xs text-muted-foreground">{service.short}</p>
            </div>
          </div>

          <div className="mb-6 flex items-center gap-1.5">
            {stepList.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i <= idx ? 'bg-primary' : 'bg-secondary',
                )}
              />
            ))}
          </div>

          {step === 'detalle' && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <MapPin className="size-4 text-primary" /> Dirección
                </span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <FileText className="size-4 text-primary" /> Describe el problema
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Ej: se corta la luz al conectar el horno..."
                  className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary/50"
                />
              </label>
              <PrimaryButton onClick={() => setStep('agenda')}>Continuar</PrimaryButton>
            </div>
          )}

          {step === 'agenda' && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="size-4 text-primary" /> Fecha
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCalendarOffset((value) => Math.max(0, value - 1))}
                      className="rounded-full border border-border px-2 py-1 text-xs"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarOffset((value) => value + 1)}
                      className="rounded-full border border-border px-2 py-1 text-xs"
                    >
                      →
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {calendarDays.map((d) => {
                    const blocked = blockedDays.includes(d.d) || blockedDays.includes(dayNames[new Date(new Date().getFullYear(), new Date().getMonth(), Number(d.n)).getDay()])
                    const isSelected = selectedDateKey === d.dateKey
                    return (
                      <button
                        key={d.dateKey}
                        onClick={() => !blocked && (setDay(d.n), setSelectedDateKey(d.dateKey))}
                        disabled={blocked}
                        className={cn(
                          'flex flex-1 flex-col items-center rounded-xl border py-2 text-sm',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground',
                          blocked ? 'cursor-not-allowed opacity-50 line-through' : '',
                        )}
                      >
                        <span className="text-[11px]">{d.d}</span>
                        <span className="font-bold">{d.n}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Clock className="size-4 text-primary" /> Hora
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {hours.map((h) => {
                    const count = availability[h] ?? 0
                    const adminBlocked = blockedHours.includes(h)
                    const blocked = adminBlocked || count >= maxRequestsPerSlot
                    return (
                      <button
                        key={h}
                        onClick={() => !blocked && setHour(h)}
                        disabled={blocked}
                        className={cn(
                          'rounded-xl border py-2.5 text-sm font-medium',
                          hour === h
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground',
                          blocked ? 'opacity-50 line-through cursor-not-allowed' : '',
                        )}
                        title={blocked ? 'Bloqueado: capacidad completa' : ''}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span>{h}</span>
                        </div>
                        {blocked && <div className="text-[10px] text-destructive">Bloqueado</div>}
                      </button>
                    )
                  })}
                </div>
              </div>
              <PrimaryButton disabled={!hour} onClick={() => setStep('cotizacion')}>
                Generar cotización
              </PrimaryButton>
            </div>
          )}

          {step === 'cotizacion' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Cotización preliminar</p>
                <p className="text-xs text-muted-foreground">
                  {day} de Julio · {hour || '15:30'} hrs
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <Row label={service.name} value={formatCLP(serviceWithMarkup)} />
                  <Row label="Visita técnica" value={formatCLP(visit)} />
                  <Row label="Total antes de IVA" value={formatCLP(totalBeforeIva)} />
                  <Row label={`IVA ${service.ivaPercent ?? 19}%`} value={formatCLP(total - totalBeforeIva)} />
                  <div className="my-2 border-t border-border" />
                  <Row label="Total estimado" value={formatCLP(total)} strong />
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-xs text-primary">
                  <ShieldCheck className="size-4 shrink-0" />
                  Incluye garantía escrita de 6 meses
                </div>
              </div>
              <PrimaryButton onClick={() => setStep('pago')}>Aprobar cotización</PrimaryButton>
              <button
                onClick={onDone}
                className="w-full rounded-full py-2 text-sm font-medium text-muted-foreground"
              >
                Rechazar
              </button>
            </div>
          )}

          {step === 'pago' && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Método de pago</p>
              <button
                onClick={() => setPay('online')}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-4 text-left',
                  pay === 'online' ? 'border-primary bg-primary/10' : 'border-border',
                )}
              >
                <CreditCard className="size-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Pago en línea</p>
                  <p className="text-xs text-muted-foreground">Tarjeta de crédito / débito · Webpay</p>
                </div>
                <Radio active={pay === 'online'} />
              </button>
              <button
                onClick={() => setPay('terreno')}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-4 text-left',
                  pay === 'terreno' ? 'border-primary bg-primary/10' : 'border-border',
                )}
              >
                <Wallet className="size-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Pago en terreno</p>
                  <p className="text-xs text-muted-foreground">Al finalizar el trabajo</p>
                </div>
                <Radio active={pay === 'terreno'} />
              </button>
              <div className="rounded-2xl border border-border bg-card p-4">
                <Row label="Total a pagar" value={formatCLP(total)} strong />
              </div>
              {submissionMessage ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                  {submissionMessage}
                </div>
              ) : null}
              <PrimaryButton onClick={handleConfirmReservation} loading={isSubmitting}>
                {isSubmitting
                  ? 'Procesando...'
                  : pay === 'online'
                    ? `Pagar ${formatCLP(total)}`
                    : 'Confirmar reserva'}
              </PrimaryButton>
            </div>
          )}

          {step === 'listo' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary shadow-glow">
                <CheckCircle2 className="size-10" />
              </div>
              <div>
                <p className="font-display text-xl font-bold">¡Servicio agendado!</p>
                <p className="mt-1 text-sm text-muted-foreground text-balance">
                  Tu {service.name.toLowerCase()} quedó reservado para el {day} de Julio a las{' '}
                  {hour || '15:30'} hrs. Te avisaremos cuando el técnico esté en camino.
                </p>
              </div>
              <div className="w-full rounded-2xl border border-border bg-card p-4 text-left text-sm">
                <Row label="Orden" value={createdOrderId ? `ZI-${createdOrderId}` : 'ZI-2044'} />
                <Row label="Total" value={formatCLP(total)} />
                <Row label="Estado" value="Pendiente de revisión" />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Esta solicitud ya quedó registrada para que el administrador la vea en el dashboard.
              </p>
              <PrimaryButton onClick={onDone}>Ver estado del servicio</PrimaryButton>
            </div>
          )}
        </div>

        <aside className="mt-6 space-y-4 lg:mt-0">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Resumen</p>
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Servicio" value={service.name} />
              <Row label="Fecha" value={`${day} de Julio`} />
              <Row label="Hora" value={hour || '15:30'} />
              <Row label="Total estimado" value={formatCLP(total)} strong />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            El formulario se adapta automáticamente para que sea más cómodo en escritorio y más rápido en móvil.
          </div>
        </aside>
      </div>
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-40"
    >
      {loading ? 'Procesando...' : children}
    </button>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={cn('text-sm', strong ? 'font-semibold' : 'text-muted-foreground')}>
        {label}
      </span>
      <span className={cn('text-sm', strong ? 'font-display text-base font-bold text-primary' : 'font-medium')}>
        {value}
      </span>
    </div>
  )
}

function Radio({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'flex size-5 items-center justify-center rounded-full border',
        active ? 'border-primary' : 'border-border',
      )}
    >
      {active && <span className="size-2.5 rounded-full bg-primary" />}
    </span>
  )
}
