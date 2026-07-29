'use server'

import { promises as fs } from 'fs'
import path from 'path'
import { revalidatePath } from 'next/cache'
import { db, pool } from '@/lib/db'
import { orden } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/session'

const settingsPath = path.join(process.cwd(), 'app', 'data', 'admin-settings.json')

type HistoryEntry = {
  timestamp: string
  title: string
  details?: string
}

type AppNotificationMessage = {
  role: 'cliente' | 'admin'
  title: string
  message: string
  timestamp: string
}

function appendNotificationMessages(raw: unknown, messages: AppNotificationMessage[]) {
  const entries = parseHistorial(raw)
  const payload = entries.map((entry) => ({
    timestamp: entry.timestamp,
    title: entry.title,
    details: entry.details,
  }))

  for (const message of messages) {
    payload.push({
      timestamp: message.timestamp,
      title: `[${message.role}] ${message.title}`,
      details: message.message,
    })
  }

  return JSON.stringify(payload)
}

function buildStatusNotificationMessages(ordenId: string, fromStatus: string, toStatus: string): AppNotificationMessage[] {
  const timestamp = new Date().toISOString()
  const idLabel = `#${ordenId}`

  const clienteMessages: AppNotificationMessage[] = []
  const adminMessages: AppNotificationMessage[] = []

  switch (toStatus.toLowerCase()) {
    case 'pendiente':
      clienteMessages.push({ role: 'cliente', title: 'Su solicitud fue recibida.', message: `Su solicitud ${idLabel} fue recibida y está pendiente de revisión.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Nueva orden.', message: `Se creó una nueva orden ${idLabel} y está pendiente.`, timestamp })
      break
    case 'en camino':
      clienteMessages.push({ role: 'cliente', title: 'El técnico va en camino.', message: `El técnico ya está en camino para atender su solicitud ${idLabel}.`, timestamp })
      break
    case 'en proceso':
      clienteMessages.push({ role: 'cliente', title: 'Su técnico fue asignado.', message: `Se asignó un técnico para su solicitud ${idLabel}.`, timestamp })
      break
    case 'cotizando':
      adminMessages.push({ role: 'admin', title: 'Cotización en preparación.', message: `La orden ${idLabel} está en preparación de cotización.`, timestamp })
      break
    case 'cotizado':
      clienteMessages.push({ role: 'cliente', title: 'Solicitud cotizada.', message: `Su solicitud ${idLabel} ahora está en estado cotizado.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Orden cotizada.', message: `La orden ${idLabel} se movió a cotizado.`, timestamp })
      break
    case 'recotizando':
      clienteMessages.push({ role: 'cliente', title: 'Recotización solicitada.', message: `Se solicitó una recotización para su solicitud ${idLabel}.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Recotización requerida.', message: `Se solicitó una recotización para la orden ${idLabel}.`, timestamp })
      break
    case 'aceptada':
      clienteMessages.push({ role: 'cliente', title: 'Cotización aceptada.', message: `Su solicitud ${idLabel} fue aceptada y está lista para pago.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Cotización aceptada.', message: `La cotización de la orden ${idLabel} fue aceptada.`, timestamp })
      break
    case 'pendiente_pago':
      clienteMessages.push({ role: 'cliente', title: 'Pago pendiente.', message: `La orden ${idLabel} está pendiente de pago.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Pago pendiente.', message: `La orden ${idLabel} está pendiente de pago.`, timestamp })
      break
    case 'pagada':
      clienteMessages.push({ role: 'cliente', title: 'Pago recibido.', message: `El pago de la orden ${idLabel} fue recibido.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Pago recibido.', message: `Se registró el pago de la orden ${idLabel}.`, timestamp })
      break
    case 'por_validar':
      clienteMessages.push({ role: 'cliente', title: 'Servicio reportado como terminado.', message: `El técnico reportó que la orden ${idLabel} quedó terminada; ahora debes revisarla y confirmarla.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Validación pendiente.', message: `La orden ${idLabel} quedó en espera de validación del cliente.`, timestamp })
      break
    case 'finalizado':
      clienteMessages.push({ role: 'cliente', title: 'Trabajo finalizado.', message: `El trabajo de su solicitud ${idLabel} fue aprobado y cerrado.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Trabajo terminado.', message: `La orden ${idLabel} fue finalizada y validada por el cliente.`, timestamp })
      break
    case 'en_reclamo':
      clienteMessages.push({ role: 'cliente', title: 'Reclamo recibido.', message: `Se registró un reclamo para la orden ${idLabel}; un administrador lo revisará pronto.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Reclamo pendiente.', message: `La orden ${idLabel} pasó a reclamo y requiere revisión.`, timestamp })
      break
    case 'rechazado':
      clienteMessages.push({ role: 'cliente', title: 'Solicitud rechazada.', message: `Su solicitud ${idLabel} fue rechazada.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Trabajo atrasado.', message: `La orden ${idLabel} fue rechazada y requiere revisión.`, timestamp })
      break
    case 'en revision':
      clienteMessages.push({ role: 'cliente', title: 'Solicitud en revisión.', message: `Su solicitud ${idLabel} fue enviada a revisión para evaluación adicional.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Orden en revisión.', message: `La orden ${idLabel} quedó en revisión para evaluar su continuación o cotización extra.`, timestamp })
      break
    case 'anulada':
      clienteMessages.push({ role: 'cliente', title: 'Orden anulada.', message: `Su solicitud ${idLabel} fue anulada.`, timestamp })
      adminMessages.push({ role: 'admin', title: 'Orden anulada.', message: `La orden ${idLabel} fue anulada.`, timestamp })
      break
    default:
      break
  }

  return [...clienteMessages, ...adminMessages]
}

function parseHistorial(raw: unknown): HistoryEntry[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return [{ timestamp: new Date().toISOString(), title: raw }]
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((item) => item && typeof item === 'object') as HistoryEntry[]
  }
  return []
}

function appendHistorial(raw: unknown, title: string, details?: string) {
  const entries = parseHistorial(raw)
  entries.push({ timestamp: new Date().toISOString(), title, details })
  return JSON.stringify(entries)
}

function parseStructuredFeedback(raw: unknown): any {
  if (!raw) return null
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseAmericaSantiagoDateTime(localDate: string, localTime: string) {
  if (!localDate || !localTime) return undefined

  const [year, month, day] = localDate.split('-').map((value) => Number(value))
  const [hour, minute] = localTime.split(':').map((value) => Number(value))
  if (![year, month, day, hour, minute].every(Number.isFinite)) return undefined

  const target = `${localDate} ${localTime}`
  const tz = 'America/Santiago'
  let found: number | null = null

  for (let offset = -12 * 60; offset <= 14 * 60; offset += 1) {
    const candidate = Date.UTC(year, month - 1, day, hour, minute) - offset * 60 * 1000
    const formatted = new Date(candidate).toLocaleString('en-CA', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .replace(',', '')
      .replace(/\u200E/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (formatted === target) {
      found = candidate
      break
    }
  }

  return found === null ? undefined : new Date(found)
}

async function getMaxRequestsPerSlot() {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8')
    const parsed = JSON.parse(raw)
    const value = Number(parsed?.maxRequestsPerSlot)
    if (Number.isFinite(value) && value > 0) return Math.floor(value)
  } catch {
    // fallback to default 3
  }
  return 3
}

async function getMinAdvanceDays() {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8')
    const parsed = JSON.parse(raw)
    const value = Number(parsed?.minAdvanceDays)
    if (Number.isFinite(value) && value >= 0) return Math.floor(value)
  } catch {
    // fallback to default 1
  }
  return 1
}

async function countActiveOrdersForSlot(localDate: string, localTime: string) {
  const res = await pool.query(
    'SELECT date, estado, "localDate", "localTime" FROM orden WHERE date IS NOT NULL',
  )

  const maxRequestsPerSlot = await getMaxRequestsPerSlot()

  const HOURS = ['09:00', '11:00', '13:00', '15:30', '17:00', '19:00']
  let count = 0

  for (const row of res.rows) {
    const estado = String(row.estado ?? '').toLowerCase()
    if (estado === 'finalizado' || estado === 'rechazado') continue

    if (row.localDate && row.localTime) {
      if (row.localDate === localDate && row.localTime === localTime) {
        count += 1
      }
      continue
    }

    if (!row.date) continue
    try {
      const d = new Date(row.date)
      const localDateValue = d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
      const localTimeValue = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })
      if (localDateValue === localDate && localTimeValue === localTime) {
        count += 1
      }
    } catch {
      continue
    }
  }

  return count
}

export async function updateOrdenStatus(
  ordenId: string,
  nuevoEstado: 'pendiente' | 'en camino' | 'en proceso' | 'en revision' | 'cotizando' | 'cotizado' | 'recotizando' | 'aceptada' | 'pendiente_pago' | 'pagada' | 'rechazado' | 'por_validar' | 'finalizado' | 'en_reclamo' | 'anulada',
  options?: { feedback?: string; resetAssignment?: boolean; technicalEvidence?: string | object; appendHistory?: { title: string; details?: string } }
) {
  try {
    const [existingOrden] = await db
      .select()
      .from(orden)
      .where(eq(orden.id, Number(ordenId)))

    if (!existingOrden) {
      return { success: false, error: 'Orden no encontrada' }
    }

    const updateValues: Record<string, unknown> = {
      estado: nuevoEstado,
      updatedAt: new Date(),
    }
    const existingEstado = String(existingOrden.estado ?? '').toLowerCase()
    const newEstado = String(nuevoEstado).toLowerCase()

    if (options?.feedback !== undefined) {
      const previousFeedback = parseStructuredFeedback(existingOrden.notasTecnico)
      const nextFeedback = parseStructuredFeedback(options.feedback)
      const preservesReviewReport = newEstado === 'finalizado' && previousFeedback?.type === 'rejection_report'

      if (preservesReviewReport && nextFeedback && typeof nextFeedback === 'object') {
        updateValues.notasTecnico = JSON.stringify({
          ...previousFeedback,
          completionFeedback: nextFeedback,
        })
      } else if (preservesReviewReport) {
        updateValues.notasTecnico = existingOrden.notasTecnico
      } else {
        updateValues.notasTecnico = options.feedback ?? null
      }
    }

    if (options?.technicalEvidence !== undefined) {
      updateValues.technicalEvidence = typeof options.technicalEvidence === 'string'
        ? options.technicalEvidence
        : JSON.stringify(options.technicalEvidence)
    }

    if (options?.resetAssignment) {
      updateValues.tecnicoId = null
      updateValues.tecnicoNombre = null
    }

    const statusChanged = existingEstado !== newEstado

    if (statusChanged || options?.appendHistory) {
      let historyTitle = options?.appendHistory?.title
      let historyDetails = options?.appendHistory?.details

      if (statusChanged) {
        switch (newEstado) {
          case 'en camino':
            historyTitle = historyTitle ?? 'Técnico en camino'
            historyDetails = historyDetails ?? `Estado actualizado de ${existingEstado} a ${newEstado}`
            if (!existingOrden.departureAt) {
              updateValues.departureAt = new Date()
            }
            break
          case 'en proceso':
            historyTitle = historyTitle ?? 'Trabajo iniciado'
            historyDetails = historyDetails ?? `Estado actualizado de ${existingEstado} a ${newEstado}`
            if (!existingOrden.arrivalAt) {
              updateValues.arrivalAt = new Date()
            }
            if (!existingOrden.workStartAt) {
              updateValues.workStartAt = new Date()
            }
            break
          case 'cotizando':
            historyTitle = historyTitle ?? 'Cotización en preparación'
            historyDetails = historyDetails ?? options?.feedback ?? 'La orden se encuentra en preparación de cotización.'
            break
          case 'cotizado':
            historyTitle = historyTitle ?? 'Cotización enviada'
            historyDetails = historyDetails ?? options?.feedback ?? 'La cotización fue enviada al cliente.'
            break
          case 'recotizando':
            historyTitle = historyTitle ?? 'Recotización solicitada'
            historyDetails = historyDetails ?? options?.feedback ?? 'El cliente solicitó ajustes a la cotización.'
            break
          case 'aceptada':
            historyTitle = historyTitle ?? 'Cotización aceptada'
            historyDetails = historyDetails ?? options?.feedback ?? 'El cliente aceptó la cotización y está listo para pagar.'
            break
          case 'pendiente_pago':
            historyTitle = historyTitle ?? 'Pago pendiente'
            historyDetails = historyDetails ?? options?.feedback ?? 'La orden está pendiente de pago.'
            break
          case 'pagada':
            historyTitle = historyTitle ?? 'Pago recibido'
            historyDetails = historyDetails ?? options?.feedback ?? 'El pago fue procesado con éxito.'
            break
          case 'por_validar':
            historyTitle = historyTitle ?? 'Esperando validación del cliente'
            historyDetails = historyDetails ?? `Estado actualizado de ${existingEstado} a ${newEstado}`
            if (!existingOrden.workEndAt) {
              updateValues.workEndAt = new Date()
            }
            break
          case 'finalizado':
            historyTitle = historyTitle ?? 'Trabajo finalizado'
            historyDetails = historyDetails ?? `Estado actualizado de ${existingEstado} a ${newEstado}`
            if (!existingOrden.workEndAt) {
              updateValues.workEndAt = new Date()
            }
            break
          case 'en_reclamo':
            historyTitle = historyTitle ?? 'Reclamo abierto'
            historyDetails = historyDetails ?? `Estado actualizado de ${existingEstado} a ${newEstado}`
            break
          case 'rechazado':
            historyTitle = historyTitle ?? 'Orden rechazada'
            historyDetails = historyDetails ?? options?.feedback ?? 'La orden fue rechazada'
            break
          case 'en revision':
            historyTitle = historyTitle ?? 'Orden en revisión'
            historyDetails = historyDetails ?? options?.feedback ?? 'La orden fue enviada a revisión'
            break
          case 'anulada':
            historyTitle = historyTitle ?? 'Orden anulada'
            historyDetails = historyDetails ?? options?.feedback ?? 'La orden fue anulada definitivamente.'
            break
          case 'pendiente':
            historyTitle = historyTitle ?? 'Orden actualizada a pendiente'
            historyDetails = historyDetails ?? `Estado actualizado de ${existingEstado} a pendiente`
            break
        }

        const safeHistorial: string = String(existingOrden.historial ?? '')
        const historial = appendHistorial(safeHistorial, historyTitle ?? '', historyDetails)
        const notificationMessages = buildStatusNotificationMessages(String(existingOrden.id), String(existingOrden.estado ?? ''), String(nuevoEstado))
        updateValues.historial = appendNotificationMessages(historial, notificationMessages)
      }

      if (!statusChanged && options?.appendHistory) {
        const safeHistorial: string = String(existingOrden.historial ?? '')
        const historial = appendHistorial(safeHistorial, options.appendHistory.title ?? '', options.appendHistory.details)
        updateValues.historial = historial
      }
    }

    await db.update(orden)
      .set(updateValues)
      .where(eq(orden.id, Number(ordenId)))

    revalidatePath('/admin')
    revalidatePath('/cliente')
    revalidatePath('/tecnico')

    return { success: true, message: `Orden ${ordenId} actualizada a ${nuevoEstado}` }
  } catch (error) {
    console.error('Error updating orden:', error)
    return { success: false, error: String(error) }
  }
}

export async function asignarOrdenATecnico(
  ordenId: string,
  tecnicoId: string,
  tecnicoNombre: string,
) {
  try {
    const [existingOrden] = await db
      .select()
      .from(orden)
      .where(eq(orden.id, Number(ordenId)))

    if (!existingOrden) {
      return { success: false, error: 'Orden no encontrada' }
    }

    const historial = appendHistorial(existingOrden.historial, `Asignada a ${tecnicoNombre}`, `Técnico asignado por admin`)
    const notificationMessages = buildStatusNotificationMessages(String(existingOrden.id), String(existingOrden.estado ?? ''), 'en proceso')
    const nextHistorial = appendNotificationMessages(historial, notificationMessages)

    await db.update(orden)
      .set({
        tecnicoId,
        tecnicoNombre,
        estado: 'en progreso',
        historial: nextHistorial,
        updatedAt: new Date(),
      })
      .where(eq(orden.id, Number(ordenId)))

    revalidatePath('/admin')
    revalidatePath('/cliente')
    revalidatePath('/tecnico')

    return { success: true, message: `Orden asignada a ${tecnicoNombre}` }
  } catch (error) {
    console.error('Error assigning orden:', error)
    return { success: false, error: String(error) }
  }
}

export async function saveOrdenEvidence(
  ordenId: string,
  evidence: Record<string, any>
) {
  try {
    const [existingOrden] = await db
      .select()
      .from(orden)
      .where(eq(orden.id, Number(ordenId)))

    if (!existingOrden) {
      return { success: false, error: 'Orden no encontrada' }
    }

    const evidenceJson = typeof evidence === 'string' ? evidence : JSON.stringify(evidence)
    const historial = appendHistorial(existingOrden.historial, 'Evidencia técnica registrada', evidence.observations ?? undefined)

    await db.update(orden)
      .set({
        technicalEvidence: evidenceJson,
        historial,
        updatedAt: new Date(),
      })
      .where(eq(orden.id, Number(ordenId)))

    revalidatePath('/admin')
    revalidatePath('/cliente')
    revalidatePath('/tecnico')

    return { success: true }
  } catch (error) {
    console.error('Error saving order evidence:', error)
    return { success: false, error: String(error) }
  }
}

export async function crearOrden(data: {
  categoria: string
  descripcion: string
  direccion: string
  urgencia: 'normal' | 'urgente'
  precio: number
  date: string
  time: string
}) {
  try {
    const user = await requireUser()
    const scheduledDate = parseAmericaSantiagoDateTime(data.date, data.time)

    if (!scheduledDate) {
      return { success: false, error: 'Fecha u hora inválida' }
    }

    const minAdvanceDays = await getMinAdvanceDays()
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
    const [year, month, day] = data.date.split('-').map((value) => Number(value))
    const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0, 0)
    const minimumAllowedDate = new Date(todayStart)
    minimumAllowedDate.setDate(todayStart.getDate() + minAdvanceDays)

    if (selectedDateStart < minimumAllowedDate) {
      return { success: false, error: `La reserva debe realizarse con al menos ${minAdvanceDays} día${minAdvanceDays === 1 ? '' : 's'} de anticipación` }
    }

    const existingCount = await countActiveOrdersForSlot(data.date, data.time)
    const maxRequestsPerSlot = await getMaxRequestsPerSlot()
    if (existingCount >= maxRequestsPerSlot) {
      return { success: false, error: 'Capacidad máxima alcanzada para esa franja horaria' }
    }

    const insertValues = {
      clienteId: user.id,
      clienteNombre: user.name,
      clienteTelefono: user.phone ?? null,
      categoria: data.categoria,
      descripcion: data.descripcion,
      direccion: data.direccion,
      urgencia: data.urgencia,
      estado: 'pendiente',
      precio: data.precio,
      date: scheduledDate ?? null,
      localDate: data.date || null,
      localTime: data.time || null,
      historial: data.descripcion
        ? JSON.stringify([
            {
              timestamp: new Date().toISOString(),
              title: 'Orden creada',
              details: data.descripcion,
            },
          ])
        : null,
    }

    const [created] = await db.insert(orden).values(insertValues).returning({ id: orden.id })

    revalidatePath('/admin')
    revalidatePath('/cliente')
    revalidatePath('/tecnico')

    return { success: true, ordenId: created.id }
  } catch (error) {
    console.error('Error creating orden:', error)
    const message = String(error)
    if (message.includes('column') || message.includes('relation') || message.includes('localDate') || message.includes('localTime') || message.includes('historial')) {
      return { success: false, error: 'Error de base de datos: puede faltar una columna en la tabla orden. Ejecuta la migración de esquema.' }
    }
    return { success: false, error: message }
  }
}
