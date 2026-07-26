import type { ServiceStatus } from '@/lib/data'
import { cn } from '@/lib/utils'

const styles: Record<ServiceStatus, string> = {
  pendiente: 'bg-muted text-muted-foreground',
  'en camino': 'bg-warning/15 text-warning',
  'en proceso': 'bg-chart-2/15 text-chart-2',
  finalizado: 'bg-primary/15 text-primary',
  rechazado: 'bg-destructive/15 text-destructive',
  'en revision': 'bg-amber-500/15 text-amber-600',
}

export function StatusBadge({ status, className }: { status: ServiceStatus | string; className?: string }) {
  const normalizedStatus = String(status ?? '').toLowerCase().trim()
  const displayStatus = normalizedStatus === 'en revision' || normalizedStatus === 'en revisión' || normalizedStatus === 'revision'
    ? 'en revision'
    : normalizedStatus === 'en proceso' || normalizedStatus === 'en progreso'
      ? 'en proceso'
      : normalizedStatus === 'en camino'
        ? 'en camino'
        : normalizedStatus === 'finalizado'
          ? 'finalizado'
          : normalizedStatus === 'rechazado'
            ? 'rechazado'
            : 'pendiente'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        styles[displayStatus as ServiceStatus],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {displayStatus === 'en revision' ? 'En revisión' : displayStatus === 'en proceso' ? 'En proceso' : displayStatus === 'en camino' ? 'En camino' : displayStatus === 'finalizado' ? 'Finalizado' : displayStatus === 'rechazado' ? 'Rechazado' : 'Pendiente'}
    </span>
  )
}
