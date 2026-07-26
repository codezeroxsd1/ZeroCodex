import { promises as fs } from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { NextResponse } from 'next/server'

const settingsPath = path.join(process.cwd(), 'app', 'data', 'admin-settings.json')

// Admin settings configuration with service checklists
const defaultSettings = {
  blockedDays: [] as string[],
  blockedHours: [] as string[],
  maxRequestsPerSlot: 3,
  maxAdvanceDays: 3,
  minAdvanceDays: 1,
  services: [
    {
      id: 'diagnostico',
      name: 'Diagnóstico eléctrico',
      short: 'Detección de fallas',
      description: 'Revisión técnica completa para detectar fallas, sobrecargas y riesgos.',
      from: 29990,
      visitPrice: 12000,
      markupPercent: 20,
      ivaPercent: 19,
      emergency: false,
    },
    {
      id: 'reparaciones',
      name: 'Reparaciones eléctricas',
      short: 'Solución de fallas',
      description: 'Reparación de cortocircuitos, tomas, cables y equipos.',
      from: 34990,
      visitPrice: 12000,
      markupPercent: 15,
      ivaPercent: 19,
      emergency: true,
    },
    {
      id: 'instalaciones',
      name: 'Instalaciones eléctricas',
      short: 'Nuevas conexiones',
      description: 'Instalación de puntos, enchufes, circuitos y equipos.',
      from: 39990,      visitPrice: 12000,      markupPercent: 20,
      ivaPercent: 19,
      emergency: false,
    },
  ],
  materials: [
    { id: 'cable-2x1-5', name: 'Cable 2x1.5 mm', price: 1800, stock: 24, markupPercent: 10, ivaPercent: 19, provider: 'ElectroSupply', internalCode: 'C215-ES', purchaseUrl: '' },
    { id: 'disyuntor-20a', name: 'Disyuntor 20A', price: 14500, stock: 8, markupPercent: 12, ivaPercent: 19, provider: 'SegurTec', internalCode: 'D20-SG', purchaseUrl: '' },
  ],
  promotions: [],
  checklists: {
    diagnostico: [
      { id: '1', text: 'Verificar voltaje de entrada', required: true },
      { id: '2', text: 'Inspeccionar tomas y conexiones', required: true },
      { id: '3', text: 'Pruebas de continuidad', required: true },
    ],
    reparaciones: [
      { id: '1', text: 'Desconectar alimentación', required: true },
      { id: '2', text: 'Inspeccionar daños', required: true },
      { id: '3', text: 'Reparar o reemplazar', required: true },
      { id: '4', text: 'Pruebas de funcionamiento', required: true },
    ],
    instalaciones: [
      { id: '1', text: 'Marcar puntos de instalación', required: true },
      { id: '2', text: 'Pasar cables y tuberías', required: true },
      { id: '3', text: 'Instalar cajas y enchufes', required: true },
      { id: '4', text: 'Conexión a circuito', required: true },
      { id: '5', text: 'Pruebas finales', required: true },
    ],
  },
  orderChecklist: [
    { id: 'order-1', text: 'Confirmar datos de la solicitud', required: true },
    { id: 'order-2', text: 'Verificar dirección y acceso', required: true },
    { id: 'order-3', text: 'Revisar notas especiales del cliente', required: false },
  ],
  blockedRequestsChecklist: [
    { id: 'blocked-1', text: 'Confirmar si falta información del cliente', required: true },
    { id: 'blocked-2', text: 'Registrar la causa del bloqueo para seguimiento', required: true },
  ],
} as const

async function readSettings() {
  try {
    let raw = await fs.readFile(settingsPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed?.materialCatalogVersion !== 2) {
      try {
        execFileSync(process.execPath, [path.join(process.cwd(), 'scripts', 'seed-material-catalog.mjs')], { stdio: 'ignore' })
        raw = await fs.readFile(settingsPath, 'utf8')
      } catch {
        // Keep the existing settings if the optional catalog migration cannot run.
      }
    }
    const normalized = JSON.parse(raw)
    return {
      ...defaultSettings,
      ...normalized,
      materialCatalogVersion: normalized?.materialCatalogVersion ?? 1,
      services: Array.isArray(normalized?.services) && normalized.services.length ? normalized.services : defaultSettings.services,
      materials: Array.isArray(normalized?.materials) && normalized.materials.length
        ? normalized.materials.map((material: any) => ({ category: material.category || 'Otros', purchaseUrl: material.purchaseUrl || '', ...material }))
        : defaultSettings.materials,
      promotions: Array.isArray(normalized?.promotions) ? normalized.promotions : defaultSettings.promotions,
      blockedDays: Array.isArray(normalized?.blockedDays) ? normalized.blockedDays : [],
      blockedHours: Array.isArray(normalized?.blockedHours) ? normalized.blockedHours : [],
      maxRequestsPerSlot: Number.isFinite(Number(normalized?.maxRequestsPerSlot)) ? Number(normalized.maxRequestsPerSlot) : defaultSettings.maxRequestsPerSlot,
      maxAdvanceDays: Number.isFinite(Number(normalized?.maxAdvanceDays)) ? Number(normalized.maxAdvanceDays) : defaultSettings.maxAdvanceDays,
      minAdvanceDays: Number.isFinite(Number(normalized?.minAdvanceDays)) ? Number(normalized.minAdvanceDays) : defaultSettings.minAdvanceDays,
      // Normalize checklist items to include materials and evidence requirements
      checklists: (typeof normalized?.checklists === 'object' && normalized.checklists) ? Object.fromEntries(
        Object.entries(normalized.checklists).map(([svc, items]: any) => [
          svc,
          Array.isArray(items)
            ? items.map((it: any) => ({
                id: it.id,
                text: it.text,
                required: !!it.required,
                materials: Array.isArray(it.materials) ? it.materials : [],
                evidence: it.evidence || { photosBefore: false, photosAfter: false, measurements: false },
              }))
            : [],
        ])
      ) : defaultSettings.checklists,
      orderChecklist: Array.isArray(normalized?.orderChecklist) ? normalized.orderChecklist.map((it: any) => ({
        id: it.id,
        text: it.text,
        required: !!it.required,
      })) : defaultSettings.orderChecklist,
      blockedRequestsChecklist: Array.isArray(normalized?.blockedRequestsChecklist) ? normalized.blockedRequestsChecklist.map((it: any) => ({
        id: it.id,
        text: it.text,
        required: !!it.required,
      })) : defaultSettings.blockedRequestsChecklist,
    }
  } catch {
    await fs.mkdir(path.dirname(settingsPath), { recursive: true })
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf8')
    return defaultSettings
  }
}

async function writeSettings(settings: any) {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true })
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
  return settings
}

export async function GET() {
  const settings = await readSettings()
  return NextResponse.json({ success: true, settings })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const nextSettings = {
      ...defaultSettings,
      ...body,
      blockedDays: Array.isArray(body?.blockedDays) ? body.blockedDays : [],
      blockedHours: Array.isArray(body?.blockedHours) ? body.blockedHours : [],
      maxRequestsPerSlot: Number.isFinite(Number(body?.maxRequestsPerSlot)) ? Number(body.maxRequestsPerSlot) : defaultSettings.maxRequestsPerSlot,
      maxAdvanceDays: Number.isFinite(Number(body?.maxAdvanceDays)) ? Number(body.maxAdvanceDays) : defaultSettings.maxAdvanceDays,
      minAdvanceDays: Number.isFinite(Number(body?.minAdvanceDays)) ? Number(body.minAdvanceDays) : defaultSettings.minAdvanceDays,
      checklists: (typeof body?.checklists === 'object' && body.checklists) ? Object.fromEntries(
        Object.entries(body.checklists).map(([svc, items]: any) => [
          svc,
          Array.isArray(items)
            ? items.map((it: any) => ({
                id: it.id,
                text: it.text,
                required: !!it.required,
                materials: Array.isArray(it.materials) ? it.materials : [],
                evidence: it.evidence || { photosBefore: false, photosAfter: false, measurements: false },
              }))
            : [],
        ])
      ) : defaultSettings.checklists,
      orderChecklist: Array.isArray(body?.orderChecklist) ? body.orderChecklist.map((it: any) => ({
        id: it.id,
        text: it.text,
        required: !!it.required,
      })) : defaultSettings.orderChecklist,
      blockedRequestsChecklist: Array.isArray(body?.blockedRequestsChecklist) ? body.blockedRequestsChecklist.map((it: any) => ({
        id: it.id,
        text: it.text,
        required: !!it.required,
      })) : defaultSettings.blockedRequestsChecklist,
      services: Array.isArray(body?.services) ? body.services : defaultSettings.services,
      materials: Array.isArray(body?.materials)
        ? body.materials.map((material: any) => ({ category: material.category || 'Otros', purchaseUrl: material.purchaseUrl || '', ...material }))
        : defaultSettings.materials,
      promotions: Array.isArray(body?.promotions) ? body.promotions : defaultSettings.promotions,
    }
    const saved = await writeSettings(nextSettings)
    return NextResponse.json({ success: true, settings: saved })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 })
  }
}
