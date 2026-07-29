'use client'

import { useMemo, useState } from 'react'
import { Copy, Calculator as CalculatorIcon, Zap, ShieldCheck, Ruler } from 'lucide-react'

type SystemType = 'monofasico' | 'trifasico'
type LoadType = 'alumbrado' | 'enchufes' | 'fuerza' | 'climatizacion'
type InstallationMethod = 'embutida' | 'vista'
type InsulationType = 'EVA' | 'THHN' | 'NYA'
type GroupingMode = 'bajo' | 'medio' | 'alto'

type Result = {
  current: number
  section: number
  finalSection: number
  ampacity: number
  voltageDrop: number
  maxDropPercent: number
  breaker: number
  curve: 'B' | 'C' | 'D'
  differential: string
  conduit: string
  conduitMetric: string
  awg: string
  minSectionByCode: number
  notes: string[]
}

const sectionOptions = [1.5, 2.5, 4, 6, 10, 16, 25, 35]
const breakerOptions = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100]

const getDefaultPf = (loadType: LoadType) => (loadType === 'fuerza' ? 0.85 : 0.93)
const getMinSectionByCode = (loadType: LoadType) => (loadType === 'alumbrado' ? 1.5 : 2.5)

const getAmpacity = (section: number, insulation: InsulationType, installation: InstallationMethod, grouping: GroupingMode, temperature: number) => {
  const baseByInsulation: Record<InsulationType, number[]> = {
    EVA: [15, 20, 25, 32, 45, 60, 80, 100],
    THHN: [16, 21, 27, 35, 49, 65, 87, 110],
    NYA: [12, 16, 20, 26, 36, 50, 68, 85],
  }

  const sectionIndex = sectionOptions.indexOf(section)
  const base = baseByInsulation[insulation][sectionIndex] ?? 0
  const installationFactor = installation === 'embutida' ? 0.9 : 1
  const tempFactor = temperature > 30 ? Math.max(0.75, 1 - (temperature - 30) * 0.01) : 1
  const groupingFactor = grouping === 'bajo' ? 1 : grouping === 'medio' ? 0.9 : 0.8
  return Math.round(base * installationFactor * tempFactor * groupingFactor)
}

const getVoltageDropPct = (system: SystemType, current: number, section: number, length: number, voltage: number) => {
  const rho = 0.0172
  const factor = system === 'monofasico' ? 2 : 1.732
  const dropVolts = (factor * current * rho * length) / section
  return Number(((dropVolts / voltage) * 100).toFixed(2))
}

const getNextSection = (section: number) => {
  const index = sectionOptions.indexOf(section)
  return sectionOptions[Math.min(index + 1, sectionOptions.length - 1)]
}

const getBreaker = (current: number, ampacity: number, loadType: LoadType) => {
  const normalized = Math.max(current, 1)
  const candidates = breakerOptions.filter((value) => value >= Math.ceil(normalized) && value <= ampacity)
  const minimum = candidates[0] ?? breakerOptions[breakerOptions.length - 1]
  const curve: 'B' | 'C' | 'D' = loadType === 'alumbrado' ? 'B' : loadType === 'enchufes' ? 'C' : 'D'
  return { breaker: minimum, curve }
}

const getDifferential = (breaker: number, loadType: LoadType) => {
  if (loadType === 'enchufes') {
    return `Diferencial 2P ${Math.min(63, Math.max(25, breaker))}A 30mA`
  }
  if (loadType === 'alumbrado') {
    return `Diferencial 2P ${Math.min(40, Math.max(20, breaker))}A 30mA`
  }
  return 'Diferencial opcional según tipo de instalación'
}

const getConduit = (section: number, system: SystemType) => {
  const conductorCount = system === 'monofasico' ? 3 : 4
  const table: Record<number, { metric: string; imperial: string }> = {
    1.5: { metric: '20 mm', imperial: '3/4"' },
    2.5: { metric: '20 mm', imperial: '3/4"' },
    4: { metric: '25 mm', imperial: '1"' },
    6: { metric: '25 mm', imperial: '1"' },
    10: { metric: '32 mm', imperial: '1 1/4"' },
    16: { metric: '32 mm', imperial: '1 1/4"' },
    25: { metric: '40 mm', imperial: '1 1/2"' },
    35: { metric: '50 mm', imperial: '2"' },
  }

  if (conductorCount > 3) {
    return {
      metric: section >= 16 ? '40 mm' : '32 mm',
      imperial: section >= 16 ? '1 1/2"' : '1 1/4"',
    }
  }

  return table[section] ?? { metric: '25 mm', imperial: '1"' }
}

const getAwg = (section: number) => {
  const mapping: Record<number, string> = {
    1.5: '16 AWG',
    2.5: '14 AWG',
    4: '12 AWG',
    6: '10 AWG',
    10: '8 AWG',
    16: '6 AWG',
    25: '4 AWG',
    35: '2 AWG',
  }

  return mapping[section] ?? 'AWG según tabla específica'
}

export function CircuitCalculator({ onUseSummary }: { onUseSummary?: (summary: string) => void }) {
  const [system, setSystem] = useState<SystemType>('monofasico')
  const [loadType, setLoadType] = useState<LoadType>('enchufes')
  const [power, setPower] = useState('2000')
  const [powerUnit, setPowerUnit] = useState<'W' | 'kW'>('W')
  const [powerFactor, setPowerFactor] = useState(getDefaultPf('enchufes').toString())
  const [length, setLength] = useState('20')
  const [maxDropPercent, setMaxDropPercent] = useState('3')
  const [installation, setInstallation] = useState<InstallationMethod>('embutida')
  const [insulation, setInsulation] = useState<InsulationType>('EVA')
  const [grouping, setGrouping] = useState<GroupingMode>('bajo')
  const [temperature, setTemperature] = useState('30')
  const [result, setResult] = useState<Result | null>(null)

  const calculate = () => {
    const numericPower = Number(power)
    const numericPf = Number(powerFactor) || getDefaultPf(loadType)
    const numericLength = Number(length) || 1
    const numericDrop = Number(maxDropPercent) || 3
    const numericTemperature = Number(temperature) || 30
    const normalizedPower = powerUnit === 'kW' ? numericPower * 1000 : numericPower
    const voltage = system === 'monofasico' ? 220 : 380

    const current = system === 'monofasico'
      ? normalizedPower / (voltage * numericPf)
      : normalizedPower / (Math.sqrt(3) * voltage * numericPf)

    let selectedSection = sectionOptions.find((section) => section >= getMinSectionByCode(loadType)) ?? 1.5
    let ampacity = getAmpacity(selectedSection, insulation, installation, grouping, numericTemperature)

    while (ampacity < current && selectedSection < sectionOptions[sectionOptions.length - 1]) {
      selectedSection = getNextSection(selectedSection)
      ampacity = getAmpacity(selectedSection, insulation, installation, grouping, numericTemperature)
    }

    let finalSection = selectedSection
    let voltageDrop = getVoltageDropPct(system, current, finalSection, numericLength, voltage)
    while (voltageDrop > numericDrop && finalSection < sectionOptions[sectionOptions.length - 1]) {
      finalSection = getNextSection(finalSection)
      voltageDrop = getVoltageDropPct(system, current, finalSection, numericLength, voltage)
    }

    const ampacityAfterDrop = getAmpacity(finalSection, insulation, installation, grouping, numericTemperature)
    const breakerData = getBreaker(current, ampacityAfterDrop, loadType)
    const conduit = getConduit(finalSection, system)
    const awg = getAwg(finalSection)
    const notes: string[] = []

    if (voltageDrop > numericDrop) {
      notes.push(`Sección aumentada a ${finalSection} mm² por caída de tensión superior al ${numericDrop}%`)
    }

    if (finalSection === 1.5 || finalSection === 2.5) {
      notes.push('Cumple con el mínimo de sección por normativa para la carga seleccionada')
    }

    setResult({
      current: Number(current.toFixed(2)),
      section: selectedSection,
      finalSection,
      ampacity: ampacityAfterDrop,
      voltageDrop: Number(voltageDrop.toFixed(2)),
      maxDropPercent: numericDrop,
      breaker: breakerData.breaker,
      curve: breakerData.curve,
      differential: getDifferential(breakerData.breaker, loadType),
      conduit: `${conduit.metric} (${conduit.imperial})`,
      conduitMetric: conduit.metric,
      awg,
      minSectionByCode: getMinSectionByCode(loadType),
      notes,
    })
  }

  const summary = useMemo(() => {
    if (!result) return ''
    return [
      `Circuito ${system === 'monofasico' ? 'monofásico' : 'trifásico'} · ${loadType}`,
      `Conductor ${insulation} ${result.finalSection} mm² (${result.awg})`,
      `Disyuntor ${result.breaker}A curva ${result.curve}`,
      result.differential,
      `Ducto mínimo ${result.conduitMetric} / ${result.conduit}`,
      `I = ${result.current} A · ΔV = ${result.voltageDrop}% · Ampacidad disponible ${result.ampacity - result.current} A`,
    ].join(' | ')
  }, [result, system, loadType, insulation])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CalculatorIcon className="size-4 text-primary" />
          <p className="text-sm font-semibold">Calculadora RIC de circuitos</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Calcula la sección del conductor, la protección termomagnética y el ducto mínimo según criterios rápidos de RIC para terreno.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sistema</span>
          <select value={system} onChange={(event) => setSystem(event.target.value as SystemType)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <option value="monofasico">Monofásico 220 V</option>
            <option value="trifasico">Trifásico 380 V</option>
          </select>
        </label>

        <label className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Carga</span>
          <select value={loadType} onChange={(event) => setLoadType(event.target.value as LoadType)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <option value="alumbrado">Alumbrado</option>
            <option value="enchufes">Enchufes uso general</option>
            <option value="fuerza">Fuerza / Motor</option>
            <option value="climatizacion">Climatización</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Potencia</span>
          <div className="flex gap-2">
            <input value={power} onChange={(event) => setPower(event.target.value)} type="number" min="1" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
            <select value={powerUnit} onChange={(event) => setPowerUnit(event.target.value as 'W' | 'kW')} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <option value="W">W</option>
              <option value="kW">kW</option>
            </select>
          </div>
        </label>

        <label className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Factor de potencia</span>
          <input value={powerFactor} onChange={(event) => setPowerFactor(event.target.value)} type="number" step="0.01" min="0.5" max="1" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Longitud del circuito (m)</span>
          <input value={length} onChange={(event) => setLength(event.target.value)} type="number" min="1" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
        </label>

        <label className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Caída máxima (%)</span>
          <input value={maxDropPercent} onChange={(event) => setMaxDropPercent(event.target.value)} type="number" min="1" max="10" step="0.1" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Instalación</span>
          <select value={installation} onChange={(event) => setInstallation(event.target.value as InstallationMethod)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <option value="embutida">Embutida / tubería</option>
            <option value="vista">A la vista</option>
          </select>
        </label>

        <label className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Aislamiento</span>
          <select value={insulation} onChange={(event) => setInsulation(event.target.value as InsulationType)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <option value="EVA">EVA</option>
            <option value="THHN">THHN</option>
            <option value="NYA">NYA</option>
          </select>
        </label>

        <label className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Agrupación / temp.</span>
          <div className="flex gap-2">
            <select value={grouping} onChange={(event) => setGrouping(event.target.value as GroupingMode)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <option value="bajo">Bajo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
            </select>
            <input value={temperature} onChange={(event) => setTemperature(event.target.value)} type="number" min="20" max="60" className="w-20 rounded-xl border border-border bg-card px-2 py-2 text-sm" />
          </div>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={calculate} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Zap className="size-4" /> Calcular</button>
        <button type="button" onClick={() => onUseSummary?.(summary)} disabled={!result} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-50">
          Agregar a materiales
        </button>
        <button type="button" onClick={() => navigator.clipboard?.writeText(summary)} disabled={!result} className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-50">
          <Copy className="size-4" /> Copiar resumen
        </button>
      </div>

      {result ? (
        <div className="space-y-3 rounded-2xl border border-border bg-background/80 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" /> Protección recomendada
              </div>
              <p className="mt-2 text-sm">Disyuntor termomagnético {result.breaker}A curva {result.curve}</p>
              <p className="mt-1 text-xs text-muted-foreground">{result.differential}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Ruler className="size-4 text-primary" /> Conductor y canalización
              </div>
              <p className="mt-2 text-sm">Conductor {insulation} {result.finalSection} mm² ({result.awg})</p>
              <p className="mt-1 text-xs text-muted-foreground">Ducto mínimo recomendado: {result.conduit}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-semibold">Resumen técnico rápido</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>• Corriente calculada: {result.current} A</li>
              <li>• Caída de tensión estimada: {result.voltageDrop}% (límite {result.maxDropPercent}%)</li>
              <li>• Ampacidad disponible: {result.ampacity - result.current} A</li>
              <li>• Sección mínima por normativa: {result.minSectionByCode} mm²</li>
            </ul>
          </div>

          {result.notes.length > 0 && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700">
              {result.notes.map((note) => (
                <p key={note}>• {note}</p>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground">
            {summary}
          </div>
        </div>
      ) : null}
    </div>
  )
}
