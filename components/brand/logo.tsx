import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function Logo({
  size = 40,
  withText = false,
  className,
}: {
  size?: number
  withText?: boolean
  className?: string
}) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5', className)}>
      <Image
        src="/zero-logo.jpg"
        alt="Zero Industries"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-lg object-cover"
        priority
      />
      {withText && (
        <div className="leading-none">
          <span className="block font-display text-base font-bold tracking-tight">
            ZERO<span className="text-primary"> INDUSTRIES</span>
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Servicios Eléctricos
          </span>
        </div>
      )}
    </Link>
  )
}
