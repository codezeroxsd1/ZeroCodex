'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getFriendlyServiceName } from '@/lib/data'

const green = 'oklch(0.83 0.24 138)'
const blue = 'oklch(0.7 0.15 200)'
const yellow = 'oklch(0.85 0.18 92)'
const gray = 'oklch(0.55 0.02 250)'

const currencyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

function toDate(value: string | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function monthKey(value: string | undefined) {
  const date = toDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function monthLabel(key: string) {
  if (!key) return 'Desconocido'
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Date(year, month - 1).toLocaleString('es-CL', {
    month: 'short',
    year: '2-digit',
  })
}

function dayKey(value: string | undefined) {
  const date = toDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayLabel(key: string) {
  if (!key) return 'Desconocido'
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return key
  return new Date(year, month - 1, day).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
  })
}

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-glow">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{currencyFormatter.format(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function isPaidOrder(order: any) {
  const status = String(order.estado || order.status || '').toLowerCase()
  return (
    status === 'finalizado' ||
    status === 'pagada' ||
    status === 'pagado' ||
    status === 'completado'
  )
}

export function RevenueChart({ orders = [], quotes = [] }: { orders?: any[]; quotes?: any[] }) {
  const [view, setView] = useState<'monthly' | 'annual' | 'daily'>('daily')

  const { monthlyRevenue, annualRevenue, dailyRevenue } = useMemo(() => {
    const monthlySums: Record<string, number> = {}
    const annualSums: Record<string, number> = {}
    const dailySums: Record<string, number> = {}
    const allEntries: { date?: string; amount: number }[] = []

    for (const o of orders) {
      if (!isPaidOrder(o)) continue
      const dateValue = o.date || o.createdAt || o.localDate || o.local_date || o.created_at
      if (dateValue && (o.precio || o.precio === 0 || o.price || o.total || o.amount)) {
        const amount = Number(o.precio ?? o.price ?? o.total ?? o.amount ?? 0)
        if (!Number.isNaN(amount)) allEntries.push({ date: dateValue, amount })
      }
    }

    for (const entry of allEntries) {
      const monthKeyValue = monthKey(entry.date)
      const date = toDate(entry.date)
      const dayKeyValue = dayKey(entry.date)
      if (!monthKeyValue || !date || !dayKeyValue) continue
      monthlySums[monthKeyValue] = (monthlySums[monthKeyValue] || 0) + entry.amount
      annualSums[String(date.getFullYear())] = (annualSums[String(date.getFullYear())] || 0) + entry.amount
      dailySums[dayKeyValue] = (dailySums[dayKeyValue] || 0) + entry.amount
    }

    const monthlyData = Object.keys(monthlySums)
      .sort()
      .map((key) => ({ label: monthLabel(key), value: monthlySums[key] }))

    const annualData = Object.keys(annualSums)
      .sort()
      .map((year) => ({ label: year, value: annualSums[year] }))

    const dailyData = Object.keys(dailySums)
      .sort()
      .map((key) => ({ label: dayLabel(key), value: dailySums[key] }))

    return { monthlyRevenue: monthlyData, annualRevenue: annualData, dailyRevenue: dailyData }
  }, [orders, quotes])

  const activeData = view === 'monthly' ? monthlyRevenue : view === 'annual' ? annualRevenue : dailyRevenue
  const title = view === 'monthly' ? 'Ingresos mensuales' : view === 'annual' ? 'Ingresos anuales' : 'Ingresos diarios'
  const subtitle =
    view === 'monthly'
      ? 'Ingresos totales por mes en pesos CLP'
      : view === 'annual'
      ? 'Ingresos totales por año en pesos CLP'
      : 'Ingresos totales por día en pesos CLP'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex gap-2 rounded-full border border-border bg-muted p-1">
          {([
            { value: 'monthly', label: 'Mensual' },
            { value: 'annual', label: 'Anual' },
            { value: 'daily', label: 'Diario' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setView(option.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                view === option.value
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={activeData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={green} stopOpacity={0.35} />
              <stop offset="100%" stopColor={green} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'oklch(0.68 0.01 250)', fontSize: 11 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'oklch(0.68 0.01 250)', fontSize: 11 }}
            tickFormatter={(value) => currencyFormatter.format(Number(value))}
          />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: green, strokeOpacity: 0.15 }} />
          <Area type="monotone" dataKey="value" name={title} stroke={green} strokeWidth={2.5} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function JobsChart({ orders = [] }: { orders?: any[] }) {
  const jobsByType = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of orders) {
      if (!isPaidOrder(o)) continue
      const key = getFriendlyServiceName(o.service || o.categoria || o.descripcion || 'Otro')
      map[key] = (map[key] || 0) + 1
    }
    return Object.entries(map).map(([t, n]) => ({ t, n }))
  }, [orders])

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={jobsByType} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <XAxis dataKey="t" tickLine={false} axisLine={false} tick={{ fill: 'oklch(0.68 0.01 250)', fontSize: 11 }} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'oklch(1 0 0 / 5%)' }} />
        <Bar dataKey="n" name="Trabajos" radius={[6, 6, 0, 0]}>
          {jobsByType.map((_, i) => (
            <Cell key={i} fill={i % 2 === 0 ? green : gray} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SegmentsChart({ orders = [] }: { orders?: any[] }) {
  const segments = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const o of orders) {
      const status = String(o.estado || o.status || 'pendiente').toLowerCase()
      const normalized =
        status === 'finalizado' || status === 'pagada' || status === 'pagado' || status === 'completado'
          ? 'Pagadas'
          : status === 'rechazado' || status === 'cancelada'
          ? 'Canceladas'
          : 'Pendientes'
      totals[normalized] = (totals[normalized] || 0) + 1
    }
    const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1
    const colors = [green, blue, yellow]
    return Object.keys(totals).map((k, i) => ({ name: k, value: Math.round((totals[k] / sum) * 100), count: totals[k], color: colors[i % colors.length] }))
  }, [orders])

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={180}>
        <PieChart>
          <Tooltip content={<TooltipBox />} />
          <Pie data={segments} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3} stroke="none">
            {segments.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-2">
        {segments.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span className="size-3 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 text-muted-foreground">{s.name}</span>
            <span className="font-semibold">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
