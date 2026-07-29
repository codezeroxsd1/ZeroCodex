import type { ServiceStatus } from '@/lib/data'
import { cn } from '@/lib/utils'

const styles: Record<string, string> = {
  pendiente: 'bg-muted text-muted-foreground',
  'en camino': 'bg-warning/15 text-warning',
  'en proceso': 'bg-chart-2/15 text-chart-2',
  'en revision': 'bg-amber-500/15 text-amber-600',
  cotizando: 'bg-amber-500/15 text-amber-600',
  cotizado: 'bg-sky-500/15 text-sky-600',
  recotizando: 'bg-violet-500/15 text-violet-600',
  aceptada: 'bg-primary/15 text-primary',
  pendiente_pago: 'bg-primary/15 text-primary',
  pagada: 'bg-emerald-500/15 text-emerald-700',
  rechazado: 'bg-destructive/15 text-destructive',
  por_validar: 'bg-amber-500/15 text-amber-700',
  finalizado: 'bg-primary/15 text-primary',
  en_reclamo: 'bg-destructive/15 text-destructive',
  anulada: 'bg-destructive/15 text-destructive',
}

export function StatusBadge({ status, className }: { status: ServiceStatus | string; className?: string }) {
  const normalizedStatus = String(status ?? '').toLowerCase().trim()
  const displayStatus = normalizedStatus === 'cotizado'
    ? 'cotizado'
    : normalizedStatus === 'cotizando'
      ? 'cotizando'
      : normalizedStatus === 'recotizando'
        ? 'recotizando'
        : normalizedStatus === 'aceptada' || normalizedStatus === 'pendiente_pago'
          ? normalizedStatus === 'aceptada' ? 'aceptada' : 'pendiente_pago'
          : normalizedStatus === 'pagada'
            ? 'pagada'
            : normalizedStatus === 'anulada'
              ? 'anulada'
              : normalizedStatus === 'en revision' || normalizedStatus === 'en revisión' || normalizedStatus === 'revision'
                ? 'en revision'
                : normalizedStatus === 'en proceso' || normalizedStatus === 'en progreso'
                  ? 'en proceso'
                  : normalizedStatus === 'en camino'
                    ? 'en camino'
                    : normalizedStatus === 'por_validar'
                      ? 'por_validar'
                      : normalizedStatus === 'finalizado'
                        ? 'finalizado'
                        : normalizedStatus === 'en_reclamo'
                          ? 'en_reclamo'
                          : normalizedStatus === 'rechazado'
                            ? 'rechazado'
                            : 'pendiente'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        styles[displayStatus as ServiceStatus | 'cotizado'],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {displayStatus === 'cotizando'
        ? 'Cotizando'
        : displayStatus === 'recotizando'
          ? 'Recotizando'
          : displayStatus === 'aceptada'
            ? 'Aceptada'
            : displayStatus === 'pendiente_pago'
              ? 'Pendiente de pago'
              : displayStatus === 'pagada'
                ? 'Pagada'
                : displayStatus === 'anulada'
                  ? 'Anulada'
                  : displayStatus === 'en revision'
                    ? 'En revisión'
                    : displayStatus === 'en proceso'
                      ? 'En proceso'
                      : displayStatus === 'en camino'
                        ? 'En camino'
                        : displayStatus === 'finalizado'
                          ? 'Finalizado'
                          : displayStatus === 'rechazado'
                            ? 'Rechazado'
                            : displayStatus === 'cotizado'
                              ? 'Cotizado'
                              : 'Pendiente'}
    </span>
  )
}
