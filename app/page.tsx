import { promises as fs } from 'fs'
import path from 'path'
import Link from 'next/link'
import {
  User,
  HardHat,
  LayoutDashboard,
  ArrowRight,
  Zap,
  ShieldCheck,
  Clock,
  Bot,
  Phone,
} from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { services } from '@/lib/data'

const roles = [
  {
    href: '/sign-up/cliente',
    title: 'Cliente',
    desc: 'Crea tu cuenta abierta para solicitar servicios, agendar visitas y seguir tu trabajo en tiempo real.',
    icon: User,
  },
  {
    href: '/sign-in/tecnico',
    title: 'Técnico',
    desc: 'Acceso restringido para técnicos aprobados por la empresa; las cuentas se entregan o activan internamente.',
    icon: HardHat,
  },
]

const highlights = [
  { icon: Clock, label: 'Emergencias 24/7' },
  { icon: ShieldCheck, label: 'Certificación SEC' },
  { icon: Bot, label: 'Asistente Zero IA' },
  { icon: Zap, label: 'Estado en tiempo real' },
]

async function getSettingsValue(key: 'contactLink' | 'primaryCtaLink' | 'primaryCtaLabel' | 'secondaryCtaLink' | 'secondaryCtaLabel') {
  try {
    const settingsPath = path.join(process.cwd(), 'app', 'data', 'admin-settings.json')
    const raw = await fs.readFile(settingsPath, 'utf8')
    const parsed = JSON.parse(raw)
    const value = typeof parsed?.[key] === 'string' ? parsed[key].trim() : ''
    if (key === 'contactLink') return value || 'https://wa.me/56900000000'
    if (key === 'primaryCtaLink') return value || '/cliente'
    if (key === 'secondaryCtaLink') return value || '/admin'
    if (key === 'primaryCtaLabel') return value || 'Solicitar servicio'
    return value || 'Ver panel de gestión'
  } catch {
    if (key === 'contactLink') return 'https://wa.me/56900000000'
    if (key === 'primaryCtaLink') return '/cliente'
    if (key === 'secondaryCtaLink') return '/admin'
    if (key === 'primaryCtaLabel') return 'Solicitar servicio'
    return 'Ver panel de gestión'
  }
}

export default async function Page() {
  const contactLink = await getSettingsValue('contactLink')
  const primaryCtaLink = await getSettingsValue('primaryCtaLink')
  const primaryCtaLabel = await getSettingsValue('primaryCtaLabel')
  const secondaryCtaLink = await getSettingsValue('secondaryCtaLink')
  const secondaryCtaLabel = await getSettingsValue('secondaryCtaLabel')

  return (
    <>
      <main className="relative min-h-screen overflow-hidden">
        {/* ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
        />

        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
          <Logo size={40} withText />
          <a
            href={contactLink}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-all hover:scale-[1.02] hover:bg-primary/20"
          >
            <Phone className="size-4" />
            <span>Contacto</span>
          </a>
        </header>

        <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-5 pt-10 pb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Zap className="size-3.5" />
            Energía profesional para Chile
          </span>
          <h1 className="mt-6 max-w-3xl text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Servicios eléctricos <span className="text-primary text-glow">rápidos</span>, seguros y
            certificados
          </h1>
          <p className="mt-5 max-w-xl text-pretty leading-relaxed text-muted-foreground">
            Zero Industries conecta hogares, comercios e industrias con técnicos expertos. Diagnóstico,
            reparaciones, certificación SEC y mantenimiento, todo desde una sola app.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={primaryCtaLink}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              {primaryCtaLabel}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={secondaryCtaLink}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent"
            >
              {secondaryCtaLabel}
            </Link>
          </div>

          <div className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {highlights.map((h) => (
              <div
                key={h.label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-4"
              >
                <h.icon className="size-5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">{h.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Role selector */}
        <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-10">
          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight">Elige tu perfil</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Explora la experiencia completa de cada usuario en la plataforma.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((role) => (
              <Link
                key={role.href}
                href={role.href}
                className="group relative flex flex-col rounded-3xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-glow"
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <role.icon className="size-6" />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">{role.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{role.desc}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Entrar
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Services strip */}
        <section className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16">
          <h2 className="mb-4 font-display text-lg font-bold tracking-tight">Nuestros servicios</h2>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted-foreground"
              >
                <s.icon className="size-4 text-primary" />
                {s.name}
              </span>
            ))}
          </div>
        </section>

        <footer className="relative z-10 border-t border-border py-6 text-center text-xs text-muted-foreground">
          Zero Industries · Servicios eléctricos · Santiago de Chile
        </footer>
      </main>
    </>
  )
}
