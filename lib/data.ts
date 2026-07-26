import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Wrench,
  PlugZap,
  ShieldCheck,
  CalendarClock,
  Factory,
  LayoutGrid,
  Lightbulb,
  Cpu,
  Building2,
  Home,
} from 'lucide-react'

const defaultServiceDefinitions = {
  diagnostico: {
    name: 'Diagnóstico eléctrico',
    short: 'Detección de fallas',
    description: 'Revisión técnica completa para detectar fallas, sobrecargas y riesgos en tu instalación.',
    icon: Activity,
    from: 29990,
  },
  reparaciones: {
    name: 'Reparaciones eléctricas',
    short: 'Solución de fallas',
    description: 'Reparación de cortocircuitos, tomas, cables y equipos con repuestos certificados.',
    icon: Wrench,
    from: 34990,
    emergency: true,
  },
  instalaciones: {
    name: 'Instalaciones eléctricas',
    short: 'Nuevas conexiones',
    description: 'Instalación de puntos, enchufes, circuitos y equipos según normativa vigente.',
    icon: PlugZap,
    from: 39990,
  },
  certificacion: {
    name: 'Certificación SEC',
    short: 'TE1 / TE2',
    description: 'Emisión y tramitación de certificados SEC para tu propiedad o negocio.',
    icon: ShieldCheck,
    from: 59990,
  },
  mantenimiento: {
    name: 'Mantenimiento preventivo',
    short: 'Planes periódicos',
    description: 'Inspecciones programadas para evitar fallas y prolongar la vida útil de tus equipos.',
    icon: CalendarClock,
    from: 24990,
  },
  industrial: {
    name: 'Mantenimiento industrial',
    short: 'Plantas y faenas',
    description: 'Mantenimiento especializado para maquinaria y sistemas de alto consumo.',
    icon: Factory,
    from: 89990,
  },
  tableros: {
    name: 'Tableros eléctricos',
    short: 'Diseño y armado',
    description: 'Diseño, armado y normalización de tableros de distribución y control.',
    icon: LayoutGrid,
    from: 69990,
  },
  iluminacion: {
    name: 'Iluminación LED',
    short: 'Eficiencia energética',
    description: 'Recambio y proyectos de iluminación LED para ahorro y confort.',
    icon: Lightbulb,
    from: 19990,
  },
  automatizacion: {
    name: 'Automatización',
    short: 'Domótica e industria',
    description: 'Automatización de procesos, domótica y control inteligente de energía.',
    icon: Cpu,
    from: 79990,
  },
  empresas: {
    name: 'Soluciones para empresas',
    short: 'Proyectos a medida',
    description: 'Planes integrales de energía y mantenimiento para comercios e industrias.',
    icon: Building2,
    from: 0,
  },
  hogares: {
    name: 'Soluciones para hogares',
    short: 'Tu casa segura',
    description: 'Servicios completos para mantener tu hogar seguro y eficiente.',
    icon: Home,
    from: 0,
  },
} as const

export type Service = {
  id: string
  name: string
  short: string
  description: string
  icon: LucideIcon
  from: number
  visitPrice?: number
  markupPercent?: number
  ivaPercent?: number
  emergency?: boolean
}

export const serviceDefinitions: Record<string, Omit<Service, 'id'>> = defaultServiceDefinitions

function resolveServiceDefinitions(overrides?: Array<{ id?: string; name?: string; short?: string; description?: string; from?: number; visitPrice?: number; markupPercent?: number; ivaPercent?: number; emergency?: boolean }>) {
  const fallback = defaultServiceDefinitions

  if (!Array.isArray(overrides) || overrides.length === 0) {
    return { ...fallback }
  }

  const merged: Record<string, Omit<Service, 'id'>> = {}

  overrides.forEach((service, index) => {
    const id = String(service.id || `servicio-${index + 1}`)
    const key = id.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
      const fallbackDefinition: any = (fallback as any)[key] ?? (fallback as any)[Object.keys(fallback)[0] as keyof typeof fallback]

    merged[key] = {
      name: service.name || fallbackDefinition?.name || 'Servicio',
      short: service.short || fallbackDefinition?.short || 'Servicio',
      description: service.description || fallbackDefinition?.description || '',
      icon: fallbackDefinition?.icon || Activity,
      from: Number(service.from ?? fallbackDefinition?.from ?? 0),
        visitPrice: Number((service as any).visitPrice ?? fallbackDefinition?.visitPrice ?? 12000),
        markupPercent: Number((service as any).markupPercent ?? fallbackDefinition?.markupPercent ?? 0),
        ivaPercent: Number((service as any).ivaPercent ?? fallbackDefinition?.ivaPercent ?? 19),
        emergency: Boolean((service as any).emergency ?? fallbackDefinition?.emergency),
    }
  })

  return merged
}

export function buildServicesFromConfig(overrides?: Array<{ id?: string; name?: string; short?: string; description?: string; from?: number; visitPrice?: number; markupPercent?: number; ivaPercent?: number; emergency?: boolean }>): Service[] {
  const definitions = resolveServiceDefinitions(overrides)
  return Object.entries(definitions).map(([id, service]) => ({ ...service, id }))
}

export function calcPriceWithMarkup(amount: number, markupPercent?: number) {
  const markup = Number(markupPercent ?? 0)
  return Math.round(amount * (1 + markup / 100))
}

export function calcPriceWithIva(amount: number, ivaPercent?: number) {
  const iva = Number(ivaPercent ?? 19)
  return Math.round(amount * (1 + iva / 100))
}

export const services: Service[] = buildServicesFromConfig()

export const workOrders: WorkOrder[] = []
export const activeJob = null
export const electricianGoldenRules = [
  'Priorizar seguridad eléctrica y uso de EPP',
  'Validar ausencia de tensión antes de intervenir',
  'Documentar hallazgos y acciones realizadas',
  'Comunicarse de forma clara con el cliente y la operación',
]

export const serviceChecklists: Record<string, string[]> = {
  diagnostico: [
    'Verificar alimentación y consumo del circuito',
    'Inspeccionar protecciones (breakers, fusibles)',
    'Medir continuidad y resistencia en conductores críticos',
    'Detectar puntos calientes o conexiones flojas',
    'Registrar observaciones y tomar fotografías relevantes',
    'Informar posible causa raíz y recomendaciones',
  ],
  reparaciones: [
    'Aislar circuito y comprobar ausencia de tensión',
    'Reemplazar conductor, toma o elemento defectuoso',
    'Reparar conexiones y apretar bornes según torque recomendado',
    'Verificar puesta a tierra y continuidad',
    'Probar funcionamiento y medir parámetros eléctricos',
    'Registrar repuestos usados y fotografiar trabajo',
  ],
  certificacion: [
    'Revisar antecedentes del equipo y normativa aplicable',
    'Realizar inspección visual completa',
    'Mediciones de aislamiento y resistencia según protocolo',
    'Verificar protecciones y selectividad',
    'Completar formularios de certificación y adjuntar fotos',
    'Firmar y entregar copia del informe al cliente',
  ],
  mantenimiento: [
    'Desenergizar equipo y señalizar área de trabajo',
    'Limpiar y lubricar componentes según procedimiento',
    'Ajustes y calibraciones necesarios',
    'Verificar consumibles y estado general',
    'Probar operación bajo carga y registrar resultados',
    'Recomendar acciones preventivas y próxima fecha',
  ],
  instalaciones: [
    'Confirmar ubicación y requisitos del cliente',
    'Verificar ruta de cableado y puntos de fijación',
    'Realizar conexionado según esquema y normas',
    'Probar circuitos e indicadores',
    'Asegurar documentación y planos actualizados',
    'Entregar instructivo básico al cliente',
  ],
  'instalacion-empalme-monofasico': [
    'Verificar estado de la acometida y continuidad de fase',
    'Asegurar anclajes y fijación del empalme en la red',
    'Conectar protecciones adecuadas según normativa',
    'Medir tensión y continuidad después del montaje',
    'Confirmar estado del tablero antes y después del empalme',
  ],
  'aumento-capacidad-electrica': [
    'Revisar demanda actual y capacidad instalada',
    'Verificar acometida y conductor existente',
    'Dimensionar nueva protección y medidor según potencia',
    'Instalar y conectar elementos de refuerzo',
    'Probar funcionamiento bajo carga y documentar cambios',
  ],
  'instalacion-tableros-tda': [
    'Inspeccionar ubicación y condiciones de montaje',
    'Verificar cableado de entrada y salidas de tablero',
    'Conectar y etiquetar fases, neutro y tierra',
    'Comprobar protecciones termomagnéticas y diferenciales',
    'Probar tablero con carga simulada y revisar alarma',
  ],
  'spt-domiciliario': [
    'Comprobar diseño de puesta a tierra y electrodos',
    'Medir resistencia de tierra antes de la conexión',
    'Conectar varillas y conductores de tierra correctamente',
    'Verificar continuidad de la red de puesta a tierra',
    'Registrar resultados y ubicación de las conexiones',
  ],
  'normalizacion-te1': [
    'Inspeccionar toda la instalación eléctrica del inmueble',
    'Medir aislamiento y resistencia a tierra según protocolo',
    'Verificar protecciones y esquemas de circuito',
    'Detectar incumplimientos normativos y documentarlos',
    'Completar informe de normalización y entregarlo al cliente',
  ],
  'canalizaciones-alumbrado-led': [
    'Revisar recorrido de canalizaciones y soportes',
    'Instalar luminarias y conectarlas según plano',
    'Comprobar continuidad y polaridad de las líneas',
    'Verificar que las protecciones sean adecuadas',
    'Probar el encendido y la operación de luminarias',
  ],
  'circuitos-enchufes': [
    'Ubicar puntos de toma y verificar sus condiciones',
    'Conectar circuitos con protección diferencial',
    'Inspeccionar conexión de tierra en cada toma',
    'Medir continuidad y verificar polaridad correcta',
    'Probar cada enchufe con carga adecuada',
  ],
  'localizacion-fugas-aislamiento': [
    'Aislar circuitos y revisar estado de aislamiento',
    'Usar equipos de medición para detectar fugas',
    'Localizar el punto exacto de la falla',
    'Reparar conductor o aislación dañada',
    'Verificar que la fuga haya desaparecido tras la reparación',
  ],
  'recableado-residencial': [
    'Retirar conductores antiguos y verificar rutas',
    'Instalar nuevos cables EVA según normativa',
    'Asegurar unión y fijación de los conductores',
    'Probar continuidad, aislamiento y polaridad',
    'Documentar cambios en planos y material usado',
  ],
  'actualizacion-protecciones': [
    'Identificar protecciones existentes y capacidad requerida',
    'Reemplazar automáticos y diferenciales defectuosos',
    'Verificar coordinación entre protecciones',
    'Probar disparo y restauración de cada circuito',
    'Registrar modelos y ajustes de las nuevas protecciones',
  ],
  'instalacion-cargadores-ev': [
    'Verificar circuito dedicado y capacidad disponible',
    'Instalar protecciones diferenciales y automáticos',
    'Conectar la estación de carga según fabricante',
    'Comprobar continuidad y puesta a tierra',
    'Realizar prueba de carga con el vehículo si es posible',
  ],
  'integracion-domotica': [
    'Revisar comunicaciones y controladores presentes',
    'Verificar conexiones de sensores y actuadores',
    'Configurar escenas o automatizaciones básicas',
    'Probar respuesta de cada dispositivo integrado',
    'Asegurar respaldos y documentación de la configuración',
  ],
  'iluminacion-emergencia': [
    'Inspeccionar luminarias de emergencia y baterías',
    'Verificar alimentación auxiliar y tiempos de encendido',
    'Probar el cambio automático en falla de red',
    'Confirmar señalización y rutas de evacuación visibles',
    'Registrar resultados de la prueba de emergencia',
  ],
  'canalizacion-datos-cctv': [
    'Revisar la ruta de canalización y puntos de paso',
    'Instalar y fijar canaletas de datos y CCTV',
    'Comprobar la integridad y continuidad del cableado',
    'Verificar polaridad y par trenzado correcto',
    'Realizar prueba de señal o transmisión de datos',
  ],
  'conexion-piscinas': [
    'Verificar conexión estanca en el tablero de piscina',
    'Instalar protecciones dedicadas para bombas y equipos',
    'Asegurar aislamiento y puesta a tierra correcta',
    'Probar encendido y funcionamiento de la bomba',
    'Inspeccionar componentes contra humedad y corrosión',
  ],
  'tgdf-trifasico': [
    'Comprobar distribución trifásica y balance de cargas',
    'Verificar conexión correcta de las tres fases',
    'Instalar protecciones apropiadas para el TGDF',
    'Medir tensiones y corrientes en el tablero',
    'Probar operación con carga nominal si aplica',
  ],
  'banco-condensadores-automatico': [
    'Verificar estado de las baterías de condensadores',
    'Conectar unidades automáticas según esquema',
    'Medir factor de potencia antes y después',
    'Probar maniobra automática de conmutación',
    'Registrar ajustes y resultados de la puesta en marcha',
  ],
  'malla-tierra-industrial': [
    'Revisar diseño de malla y ubicación de electrodos',
    'Instalar conductores y varillas de puesta a tierra',
    'Medir resistividad del terreno y continuidad',
    'Asegurar empalmes y conexiones mecánicas seguras',
    'Documentar ubicación y resultados de la medición',
  ],
  'verificacion-inicial-ric19': [
    'Realizar inspección inicial completa de la instalación',
    'Medir aislamiento y puesta a tierra según RIC 19',
    'Verificar protecciones y esquemas de seguridad',
    'Registrar no conformidades y acciones necesarias',
    'Entregar informe preliminar al cliente',
  ],
  'tta-tableros-transferencia-automatica': [
    'Verificar conexiones de entrada de red y grupo electrógeno',
    'Comprobar operación de la transferencia automática',
    'Probar cambio de alimentación manual y automática',
    'Medir tensiones en cada posición del tablero',
    'Asegurar señalización y alarma de estado',
  ],
  empresas: [
    'Verificar requisitos eléctricos del área industrial o comercial',
    'Asegurar coordinación de protecciones y cargas',
    'Comprobar documentación y planos del proyecto',
    'Probar funcionamiento con las cargas representativas',
    'Comunicar recomendaciones específicas al cliente',
  ],
  hogares: [
    'Inspeccionar conexiones principales y circuitos domésticos',
    'Verificar toma de tierra y protecciones diferenciales',
    'Asegurar condiciones de seguridad en enchufes e iluminación',
    'Probar funcionamiento general de la instalación',
    'Registrar observaciones y recomendaciones al cliente',
  ],
  default: [
    'Inspección visual inicial',
    'Confirmar datos de cliente y ubicación',
    'Tomar fotografías del sitio y del problema',
    'Registrar acciones ejecutadas y repuestos usados',
    'Solicitar firma del cliente al finalizar',
  ],
}

export function formatCLP(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)
}


export function getFriendlyServiceName(value: string | null | undefined) {
  const text = String(value ?? '').trim()
  if (!text) return 'Servicio'
  const normalized = text.toLowerCase()
  if (normalized.includes('diagn') || normalized.includes('elect')) return 'Diagnóstico eléctrico'
  if (normalized.includes('repar')) return 'Reparaciones eléctricas'
  if (normalized.includes('instalacion-empalme-monofasico')) return 'Instalación de Empalme Monofásico'
  if (normalized.includes('aumento-capacidad-electrica')) return 'Aumento de Capacidad Eléctrica'
  if (normalized.includes('instalacion-tableros-tda')) return 'Instalación de Tableros Eléctricos Residenciales (TDA)'
  if (normalized.includes('spt-domiciliario')) return 'Sistema de Puesta a Tierra Domiciliario'
  if (normalized.includes('normalizacion-te1')) return 'Normalización TE1 SEC'
  if (normalized.includes('canalizaciones-alumbrado-led')) return 'Canalizaciones y Alumbrado LED'
  if (normalized.includes('circuitos-enchufes')) return 'Circuitos y Enchufes'
  if (normalized.includes('localizacion-fugas-aislamiento')) return 'Localización de Fugas y Aislamiento'
  if (normalized.includes('recableado-residencial')) return 'Recableado Residencial'
  if (normalized.includes('actualizacion-protecciones')) return 'Actualización de Protecciones'
  if (normalized.includes('instalacion-cargadores-ev')) return 'Instalación de Cargadores EV'
  if (normalized.includes('integracion-domotica')) return 'Integración Domótica'
  if (normalized.includes('iluminacion-emergencia')) return 'Iluminación de Emergencia'
  if (normalized.includes('canalizacion-datos-cctv')) return 'Canalización de Datos y CCTV'
  if (normalized.includes('conexion-piscinas')) return 'Conexión Piscinas'
  if (normalized.includes('tgdf-trifasico')) return 'TGDF Trifásico'
  if (normalized.includes('banco-condensadores-automatico')) return 'Banco de Condensadores Automático'
  if (normalized.includes('malla-tierra-industrial')) return 'Malla de Tierra Industrial'
  if (normalized.includes('verificacion-inicial-ric19')) return 'Verificación Inicial RIC19'
  if (normalized.includes('tta-tableros-transferencia-automatica')) return 'TTA Tableros Transferencia Automática'
  if (normalized.includes('cert')) return 'Certificación SEC'
  if (normalized.includes('mant')) return 'Mantenimiento preventivo'
  if (normalized.includes('industrial')) return 'Mantenimiento industrial'
  if (normalized.includes('tablero')) return 'Tableros eléctricos'
  if (normalized.includes('ilumin')) return 'Iluminación LED'
  if (normalized.includes('automat')) return 'Automatización'
  const cleaned = String(text)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export type Promotion = {
  id: string
  name?: string
  description?: string
  active?: boolean
  applyTo?: 'total' | 'service'
  discountType?: 'percent' | 'fixed'
  discountValue?: number
  serviceIds?: string[]
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
}

function dateInRange(date: Date, start?: string, end?: string) {
  const d = new Date(date.toDateString())
  if (start) {
    const s = new Date(start)
    if (d < new Date(s.toDateString())) return false
  }
  if (end) {
    const e = new Date(end)
    if (d > new Date(e.toDateString())) return false
  }
  return true
}

export function getApplicablePromotions(promotions: Promotion[] | undefined, date: Date, serviceId?: string) {
  if (!Array.isArray(promotions) || promotions.length === 0) return [] as Promotion[]
  return promotions.filter((p) => {
    if (!p) return false
    if (!p.active) return false
    if (!dateInRange(date, p.startDate, p.endDate)) return false
    if (p.applyTo === 'service') {
      if (!serviceId) return false
      return Array.isArray(p.serviceIds) && p.serviceIds.includes(serviceId)
    }
    return true
  })
}

export function computeBestPromotionDiscount(amountBeforeIva: number, promotions: Promotion[] | undefined, date: Date, serviceId?: string) {
  const applicable = getApplicablePromotions(promotions, date, serviceId)
  if (applicable.length === 0) return { discount: 0, promotion: null as Promotion | null }

  let best = { discount: 0, promotion: null as Promotion | null }

  applicable.forEach((p) => {
    const val = Number(p.discountValue ?? 0)
    let discount = 0
    if (p.discountType === 'fixed') discount = Math.round(val)
    else discount = Math.round((amountBeforeIva * Math.max(0, val)) / 100)

    if (discount > best.discount) {
      best = { discount, promotion: p }
    }
  })

  // do not exceed amount
  if (best.discount > amountBeforeIva) best.discount = amountBeforeIva

  return best
}

export function applyPromotionToAmount(amount: number, promo: Promotion | null) {
  if (!promo) return amount
  const v = Number(promo.discountValue ?? 0)
  if (v <= 0) return amount
  if (promo.discountType === 'fixed') return Math.max(0, Math.round(amount - v))
  // percent
  return Math.round(amount * (1 - v / 100))
}

export const statusOrder = ['pendiente', 'en camino', 'en proceso', 'finalizado', 'rechazado', 'en revision'] as const

export type ServiceStatus = (typeof statusOrder)[number]
export type WorkOrder = {
  id: string
  title: string
  status: string
  client: string
  service: string
  scheduledAt: string
}

export function normalizeServiceValue(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '-')
}
