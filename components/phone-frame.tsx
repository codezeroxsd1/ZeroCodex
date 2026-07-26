import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-[420px]', className)}>
      <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-card shadow-glow sm:border-4 sm:border-secondary">
        {/* status bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-medium text-muted-foreground">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded-[2px] border border-current" />
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
