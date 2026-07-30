'use client'

import { ChevronRight, Zap } from 'lucide-react'
import { calcPriceWithIva, calcPriceWithMarkup, formatCLP } from '@/lib/data'
import { useConfiguredServices } from './use-configured-services'

export function ClienteServicios({ onSelectService }: { onSelectService: (id: string) => void }) {
  const { services, loading } = useConfiguredServices()

  return (
    <div className="space-y-3 p-2 sm:p-4 md:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-sm text-muted-foreground sm:text-[15px]">
          Elige un servicio para solicitarlo o agendar una visita.
        </p>
        {loading ? (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Cargando servicios disponibles…
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            {services.filter((s) => !s.hiddenFromClient).map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectService(s.id)}
                className="flex w-full flex-col items-start gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:gap-4 sm:p-4 md:min-h-[136px]"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <s.icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words font-semibold leading-tight">{s.name}</p>
                    {s.emergency && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        <Zap className="size-3" /> 24/7
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground sm:line-clamp-1 md:line-clamp-2">
                    {s.description}
                  </p>
                  <p className="mt-1 text-xs font-medium text-primary">
                    {s.from > 0 ? `Desde ${formatCLP(calcPriceWithMarkup(s.from, s.markupPercent))}` : 'Cotización a medida'}
                  </p>
                  {s.from > 0 && (
                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                      {s.ivaPercent ?? 19}% IVA → {formatCLP(calcPriceWithIva(calcPriceWithMarkup(s.from, s.markupPercent), s.ivaPercent))}
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-0.5 size-5 shrink-0 self-center text-muted-foreground sm:ml-auto" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
