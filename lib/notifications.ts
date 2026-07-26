export type AppNotification = {
  id: string
  title: string
  message: string
  timestamp: string
  type: 'info' | 'success' | 'warning'
}

const formatTimestamp = () =>
  new Date().toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  })

function parseHistoryEntries(raw: unknown): Array<{ timestamp?: string; title?: string; details?: string }> {
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            timestamp: typeof item.timestamp === 'string' ? item.timestamp : undefined,
            title: typeof item.title === 'string' ? item.title : undefined,
            details: typeof item.details === 'string' ? item.details : undefined,
          }))
      }
    } catch {
      return []
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : undefined,
        title: typeof item.title === 'string' ? item.title : undefined,
        details: typeof item.details === 'string' ? item.details : undefined,
      }))
  }
  return []
}

function getEntrySignature(entry: { timestamp?: string; title?: string; details?: string }) {
  return JSON.stringify({
    ts: entry.timestamp ?? '',
    title: entry.title ?? '',
    details: entry.details ?? '',
  })
}

function normalizeOrderStatus(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return 'pendiente'
  if (raw.includes('revision') || raw.includes('revisión')) return 'en revision'
  if (raw.includes('camino')) return 'en camino'
  if (raw.includes('progreso') || raw.includes('proceso')) return 'en proceso'
  if (raw.includes('final')) return 'finalizado'
  if (raw.includes('rechaz')) return 'rechazado'
  return raw
}

export function diffOrderNotifications(
  prevOrders: any[],
  nextOrders: any[],
  role: 'cliente' | 'tecnico' | 'admin',
): AppNotification[] {
  const prevMap = new Map(prevOrders.map((order: any) => [String(order.id), order]))
  const notifications: AppNotification[] = []
  const timestamp = formatTimestamp()

  for (const order of nextOrders) {
    const id = String(order.id)
    const prev = prevMap.get(id)
    const nextStatus = normalizeOrderStatus(order.status ?? order.estado ?? 'pendiente')
    const serviceName = String(order.categoria ?? order.service ?? 'servicio')

    if (!prev) {
      if (role === 'cliente') {
        notifications.push({
          id: `new-${id}-${timestamp}`,
          title: 'Su solicitud fue recibida.',
          message: `Su solicitud #${id} de ${serviceName} fue recibida y está pendiente de revisión.`,
          timestamp,
          type: 'info',
        })
      } else if (role === 'admin') {
        notifications.push({
          id: `new-${id}-${timestamp}`,
          title: 'Nueva orden.',
          message: `Se creó una nueva orden #${id} de ${serviceName} y está pendiente.`,
          timestamp,
          type: 'info',
        })
      } else {
        notifications.push({
          id: `new-${id}-${timestamp}`,
          title: 'Nueva orden disponible',
          message: `Orden #${id} de ${serviceName} está disponible para ti con estado ${nextStatus}.`,
          timestamp,
          type: 'info',
        })
      }
      continue
    }

    const prevStatus = normalizeOrderStatus(prev.status ?? prev.estado ?? 'pendiente')
    if (prevStatus !== nextStatus) {
      if (role === 'cliente') {
        const titleByStatus: Record<string, { title: string; message: string }> = {
          en_proceso: {
            title: 'Su técnico fue asignado.',
            message: `Se asignó un técnico para su solicitud #${id}.`,
          },
          'en camino': {
            title: 'El técnico va en camino.',
            message: `El técnico ya está en camino para atender su solicitud #${id}.`,
          },
          finalizado: {
            title: 'Trabajo finalizado.',
            message: `El trabajo de su solicitud #${id} fue finalizado.`,
          },
          rechazado: {
            title: 'Solicitud rechazada.',
            message: `Su solicitud #${id} fue rechazada.`,
          },
        }
        const mapped = titleByStatus[nextStatus]
        if (mapped) {
          notifications.push({
            id: `status-${id}-${prevStatus}-${nextStatus}-${timestamp}`,
            title: mapped.title,
            message: mapped.message,
            timestamp,
            type: 'success',
          })
        }
      } else if (role === 'admin') {
        const titleByStatus: Record<string, { title: string; message: string }> = {
          finalizado: {
            title: 'Trabajo terminado.',
            message: `La orden #${id} fue finalizada.`,
          },
          rechazado: {
            title: 'Trabajo atrasado.',
            message: `La orden #${id} fue rechazada y requiere revisión.`,
          },
        }
        const mapped = titleByStatus[nextStatus]
        if (mapped) {
          notifications.push({
            id: `status-${id}-${prevStatus}-${nextStatus}-${timestamp}`,
            title: mapped.title,
            message: mapped.message,
            timestamp,
            type: 'warning',
          })
        }
      } else {
        notifications.push({
          id: `status-${id}-${prevStatus}-${nextStatus}-${timestamp}`,
          title: `Orden #${id} cambió de estado`,
          message: `La orden pasó de ${prevStatus} a ${nextStatus}.`,
          timestamp,
          type: 'success',
        })
      }
    }

    if (role === 'cliente') {
      const prevHistory = parseHistoryEntries(prev?.historial)
      const nextHistory = parseHistoryEntries(order.historial)
      const prevSignatures = new Set(prevHistory.map(getEntrySignature))
      const newHistoryEntries = nextHistory.filter((entry) => !prevSignatures.has(getEntrySignature(entry)))

      for (const entry of newHistoryEntries) {
        const rawTitle = String(entry.title ?? 'Actualización').trim()
        const cleanedTitle = rawTitle.replace(/^\[(cliente|admin|tecnico)\]\s*/i, '')
        const fallbackMessage = cleanedTitle || `Se actualizó su solicitud #${id}`
        notifications.push({
          id: `history-${id}-${getEntrySignature(entry)}-${timestamp}`,
          title: cleanedTitle || 'Actualización de su solicitud',
          message: String(entry.details || fallbackMessage),
          timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : timestamp,
          type: cleanedTitle.toLowerCase().includes('rechaz') ? 'warning' : cleanedTitle.toLowerCase().includes('finaliz') ? 'success' : 'info',
        })
      }
    }
  }

  return notifications
}
