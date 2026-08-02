function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseFeedback(raw: unknown): unknown {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

function formatFeedback(raw: unknown) {
  const feedback = parseFeedback(raw)
  if (!feedback) return 'Sin observaciones.'

  if (typeof feedback === 'string') {
    return escapeHtml(feedback)
  }

  if (Array.isArray(feedback)) {
    return escapeHtml(feedback.map((item) => String(item)).join('\n\n'))
  }

  if (typeof feedback === 'object') {
    const lines: string[] = []
    const add = (label: string, value: unknown) => {
      if (value == null) return
      const text = Array.isArray(value) ? value.join(', ') : String(value)
      if (text.trim()) {
        lines.push(`${label}: ${text}`)
      }
    }

    add('Tipo', (feedback as any).type)
    add('Técnico', (feedback as any).technician)
    add('Descripción', (feedback as any).description ?? (feedback as any).details ?? (feedback as any).observaciones)
    add('Motivos', (feedback as any).reasons ?? (feedback as any).motivos)
    add('Materiales', Array.isArray((feedback as any).materials) ? (feedback as any).materials.map((item: any) => item.name || item.id || String(item)).join(', ') : (feedback as any).materials)
    add('Materiales faltantes', Array.isArray((feedback as any).missingMaterials) ? (feedback as any).missingMaterials.map((item: any) => item.name || item.id || String(item)).join(', ') : (feedback as any).missingMaterials)
    add('Horas estimadas', (feedback as any).estimatedHours)
    add('Puntaje cliente', (feedback as any).clientRating?.score ?? (feedback as any).clientRating)
    if (lines.length > 0) {
      return escapeHtml(lines.join('\n\n'))
    }
    return escapeHtml(JSON.stringify(feedback, null, 2))
  }

  return escapeHtml(String(feedback))
}

export function buildOrderPdfHtml(order: any) {
  const serviceName = String(order?.categoria || order?.service || order?.descripcion || 'Servicio').trim() || 'Servicio'
  const clientName = String(order?.clienteNombre || order?.client || order?.cliente || 'Cliente').trim() || 'Cliente'
  const address = String(order?.direccion || order?.address || 'Sin dirección').trim() || 'Sin dirección'
  const price = Number(order?.precio ?? order?.price ?? 0)
  const status = String(order?.estado || order?.status || 'Pendiente').trim() || 'Pendiente'
  const createdAt = order?.date || order?.createdAt || order?.localDate || order?.created_at
  const dateLabel = createdAt ? new Date(createdAt).toLocaleDateString('es-CL') : 'Sin fecha'
  const notes = String(order?.notes ?? '').trim()
  const feedbackContent = formatFeedback(order?.notasTecnico ?? order?.feedback ?? order?.historial ?? order?.notes ?? null)

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 22px; margin-bottom: 8px; }
          .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .company { font-size: 14px; color: #334155; margin-top: 4px; }
          .card { border: 1px solid #ddd; border-radius: 10px; padding: 16px; margin-top: 12px; }
          .row { display: flex; justify-content: space-between; margin: 6px 0; }
          .label { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Informe de servicio</h1>
          <div class="company">Zero Industries Spa</div>
          <div class="company">RUT: 78.302.571-K</div>
          <div class="company">Ventas@zeroindustrieschile.com</div>
          <div class="meta">Generado automáticamente desde la app</div>
        </div>
        <div class="card">
          <div class="row"><span class="label">Cliente</span><span>${clientName}</span></div>
          <div class="row"><span class="label">Servicio</span><span>${serviceName}</span></div>
          <div class="row"><span class="label">Dirección</span><span>${address}</span></div>
          <div class="row"><span class="label">Fecha</span><span>${dateLabel}</span></div>
          <div class="row"><span class="label">Estado</span><span>${status}</span></div>
          <div class="row"><span class="label">Monto</span><span>$${price.toLocaleString('es-CL')}</span></div>
        </div>
        <div class="card">
          <div class="label">Observaciones generales</div>
          <div style="margin-top: 8px; white-space: pre-wrap;">${notes || 'Sin observaciones.'}</div>
        </div>
        <div class="card">
          <div class="label">Feedback técnico</div>
          <div style="margin-top: 8px; white-space: pre-wrap;">${feedbackContent}</div>
        </div>
      </body>
    </html>
  `
}

export function openOrderPdf(order: any) {
  const html = buildOrderPdfHtml(order)
  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) return false
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  return true
}
