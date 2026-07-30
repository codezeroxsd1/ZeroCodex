'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCLP, getApplicablePromotions, computeBestPromotionDiscount, applyPromotionToAmount } from '@/lib/data'
import { updateOrdenStatus } from '@/app/actions/orden'

export default function QuotePreview({ quote, onClose }: { quote: any; onClose?: () => void }) {
  const router = useRouter()
  const [servicesConfig, setServicesConfig] = useState<any[]>([])
  const [materialsConfig, setMaterialsConfig] = useState<any[]>([])
  const [promotionsConfig, setPromotionsConfig] = useState<any[]>([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const quoteStatus = String(quote?.status ?? quote?.estado ?? '').trim().toLowerCase()

  const resolveOrderId = () => {
    const raw = quote?.orderId ?? quote?.id ?? quote?.ordenId ?? quote?.order_id
    const numeric = Number(raw)
    return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : null
  }

  const updateOrderStatus = async (newStatus: string, title: string, details: string) => {
    const orderId = resolveOrderId()
    if (!orderId) {
      window.alert('No se pudo determinar el ID de orden para esta cotización.')
      return
    }

    if (!window.confirm(`¿Deseas cambiar el estado de la orden a ${newStatus.replace('_', ' ')}?`)) {
      return
    }

    try {
      setStatusLoading(true)
      setStatusMessage(null)
      const result = await updateOrdenStatus(orderId, newStatus as any, {
        appendHistory: {
          title,
          details,
        },
      })

      if (!result?.success) {
        window.alert(result?.error || 'No se pudo actualizar el estado de la orden.')
        return
      }

      setStatusMessage(`Orden actualizada a ${newStatus.replace('_', ' ')}.`)
      router.refresh()
    } catch (error) {
      console.error('Error updating quote status:', error)
      window.alert('Ocurrió un error al actualizar el estado de la orden.')
    } finally {
      setStatusLoading(false)
    }
  }

  const handlePaymentPlaceholder = () => {
    window.alert('La integración de pago aún no está disponible. Esta acción es un placeholder para la próxima fase.')
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const json = await res.json()
        if (!mounted) return
        setServicesConfig(Array.isArray(json?.settings?.services) ? json.settings.services : [])
        setMaterialsConfig(Array.isArray(json?.settings?.materials) ? json.settings.materials : [])
        setPromotionsConfig(Array.isArray(json?.settings?.promotions) ? json.settings.promotions : [])
      } catch (e) {
        if (!mounted) return
        setServicesConfig([])
        setMaterialsConfig([])
        setPromotionsConfig([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const parseFeedback = (value: unknown) => {
    if (!value) return null
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    }
    return value
  }

  const applyMarkup = (value: number, markupPercent: number) => value * (1 + markupPercent / 100)
  const applyMarkupAndIva = (value: number, markupPercent: number, ivaPercent: number) => {
    const subtotalWithMarkup = applyMarkup(value, markupPercent)
    return subtotalWithMarkup * (1 + ivaPercent / 100)
  }

  const resolveMaterialPrice = (item: any) => {
    const itemId = String(item?.materialId ?? item?.id ?? item?.material ?? '').trim().toLowerCase()
    const itemName = String(item?.name ?? item?.material ?? item?.id ?? '').trim().toLowerCase()

    const matchedMaterial = materialsConfig.find((material: any) => {
      const materialId = String(material?.id ?? '').trim().toLowerCase()
      const materialName = String(material?.name ?? '').trim().toLowerCase()
      return (
        (itemId && materialId && (itemId === materialId || itemId.includes(materialId) || materialId.includes(itemId))) ||
        (itemName && materialName && (itemName === materialName || itemName.includes(materialName) || materialName.includes(itemName)))
      )
    })

    const explicitPrice = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.cost ?? 0)
    const configPrice = Number(matchedMaterial?.price ?? 0)
    const subtotal = Number(item?.subtotal ?? item?.total ?? 0)
    const quantity = Number(item?.quantity ?? item?.qty ?? 1)
    const basePrice = explicitPrice > 0 ? explicitPrice : configPrice > 0 ? configPrice : quantity > 0 && subtotal > 0 ? subtotal / quantity : 0
    const markupPercent = Number(matchedMaterial?.markupPercent ?? 0)
    const ivaPercent = Number(matchedMaterial?.ivaPercent ?? 0)

    return applyMarkupAndIva(basePrice, markupPercent, ivaPercent)
  }

  const resolveMaterialNetPrice = (item: any) => {
    const itemId = String(item?.materialId ?? item?.id ?? item?.material ?? '').trim().toLowerCase()
    const itemName = String(item?.name ?? item?.material ?? item?.id ?? '').trim().toLowerCase()

    const matchedMaterial = materialsConfig.find((material: any) => {
      const materialId = String(material?.id ?? '').trim().toLowerCase()
      const materialName = String(material?.name ?? '').trim().toLowerCase()
      return (
        (itemId && materialId && (itemId === materialId || itemId.includes(materialId) || materialId.includes(itemId))) ||
        (itemName && materialName && (itemName === materialName || itemName.includes(materialName) || materialName.includes(itemName)))
      )
    })

    const explicitPrice = Number(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.cost ?? 0)
    const configPrice = Number(matchedMaterial?.price ?? 0)
    const subtotal = Number(item?.subtotal ?? item?.total ?? 0)
    const quantity = Number(item?.quantity ?? item?.qty ?? 1)
    const basePrice = explicitPrice > 0 ? explicitPrice : configPrice > 0 ? configPrice : quantity > 0 && subtotal > 0 ? subtotal / quantity : 0
    const markupPercent = Number(matchedMaterial?.markupPercent ?? 0)

    return applyMarkup(basePrice, markupPercent)
  }

  const getServiceHourValue = (serviceName?: string) => {
    if (!serviceName) return 0
    const normalizedService = String(serviceName).trim().toLowerCase()
    const matchedService = servicesConfig.find((service: any) => {
      const name = String(service?.name ?? '').trim().toLowerCase()
      const short = String(service?.short ?? '').trim().toLowerCase()
      return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
    })
    return Number(matchedService?.hourValue ?? 0)
  }

  const getServiceVisitValue = (serviceName?: string) => {
    if (!serviceName) return 0
    const normalizedService = String(serviceName).trim().toLowerCase()
    const matchedService = servicesConfig.find((service: any) => {
      const name = String(service?.name ?? '').trim().toLowerCase()
      const short = String(service?.short ?? '').trim().toLowerCase()
      return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
    })
    return Number(matchedService?.visitPrice ?? 0)
  }

  const getQuoteMaterials = (feedbackValue: unknown) => {
    const feedback = parseFeedback(feedbackValue)
    const directItems = Array.isArray(feedback?.materials?.items)
      ? feedback.materials.items
      : Array.isArray(feedback?.materials)
        ? feedback.materials
        : []

    const materialEntries = directItems.length > 0
      ? directItems
      : (Array.isArray(feedback?.missingMaterials)
          ? feedback.missingMaterials
          : Array.isArray(feedback?.rejectionFeedback?.missingMaterials)
            ? feedback.rejectionFeedback.missingMaterials
            : [])

    if (materialEntries.length > 0) {
      return materialEntries.map((item: any, index: number) => {
        const quantity = Number(item?.quantity ?? item?.qty ?? 1)
        const unitPrice = resolveMaterialPrice(item)
        const netUnitPrice = resolveMaterialNetPrice(item)
        return {
          key: `${item?.id || item?.name || index}`,
          name: item?.name || item?.material || item?.id || `Material ${index + 1}`,
          quantity,
          price: unitPrice,
          netPrice: netUnitPrice,
        }
      })
    }

    return []
  }

  const getQuotePricing = (feedbackValue: unknown, serviceName?: string) => {
    const feedback = parseFeedback(feedbackValue)
    const directItems = Array.isArray(feedback?.materials?.items)
      ? feedback.materials.items
      : Array.isArray(feedback?.materials)
        ? feedback.materials
        : []

    const materialEntries = directItems.length > 0
      ? directItems
      : (Array.isArray(feedback?.missingMaterials)
          ? feedback.missingMaterials
          : Array.isArray(feedback?.rejectionFeedback?.missingMaterials)
            ? feedback.rejectionFeedback.missingMaterials
            : [])

    let materialsValue = 0
    let materialsNetValue = 0
    let materialsBaseValue = 0
    let materialsIvaWeightedBase = 0

    materialEntries.forEach((item: any) => {
      const quantity = Number(item?.quantity ?? item?.qty ?? 1)
      const unitPrice = resolveMaterialPrice(item)
      const netUnitPrice = resolveMaterialNetPrice(item)
      const baseUnitPrice = resolveMaterialNetPrice(item)
      materialsValue += unitPrice * quantity
      materialsNetValue += netUnitPrice * quantity
      materialsBaseValue += baseUnitPrice * quantity
      materialsIvaWeightedBase += netUnitPrice * quantity
    })

    const serviceConfig = servicesConfig.find((service: any) => {
      const normalizedService = String(serviceName ?? '').trim().toLowerCase()
      const name = String(service?.name ?? '').trim().toLowerCase()
      const short = String(service?.short ?? '').trim().toLowerCase()
      return name === normalizedService || short === normalizedService || name.includes(normalizedService) || short.includes(normalizedService)
    })

    const estimatedHours = Number(feedback?.estimatedHours ?? 0)
    const hourValue = getServiceHourValue(serviceName)
    const hoursNetValue = estimatedHours > 0
      ? applyMarkup(estimatedHours * hourValue, Number(serviceConfig?.hourMarkupPercent ?? 0))
      : 0
    const hoursValue = estimatedHours > 0
      ? applyMarkupAndIva(estimatedHours * hourValue, Number(serviceConfig?.hourMarkupPercent ?? 0), Number(serviceConfig?.hourIvaPercent ?? 0))
      : 0
    const visitPrice = getServiceVisitValue(serviceName)
    const additionalVisitCount = estimatedHours > 8 ? Math.max(0, Math.floor((estimatedHours - 1) / 8)) : 0
    const visitNetValue = applyMarkup(visitPrice, Number(serviceConfig?.markupPercent ?? 0)) * (1 + additionalVisitCount)
    const visitValue = applyMarkupAndIva(visitPrice, Number(serviceConfig?.markupPercent ?? 0), Number(serviceConfig?.ivaPercent ?? 0)) * (1 + additionalVisitCount)

    const totals = {
      materialsValue,
      materialsNetValue,
      materialsBaseValue,
      materialsIvaWeightedBase,
      hoursNetValue,
      hoursValue,
      visitNetValue,
      visitValue,
      additionalVisitCount,
      materialsIvaPercent: 19,
      hoursIvaPercent: Number(serviceConfig?.hourIvaPercent ?? 19),
      visitIvaPercent: Number(serviceConfig?.ivaPercent ?? 19),
      totalProfitValue: 0,
      materialsProfitValue: 0,
      hoursProfitValue: 0,
      visitProfitValue: 0,
      totalIvaValue: (materialsValue - materialsNetValue) + (hoursValue - hoursNetValue) + (visitValue - visitNetValue),
    }

    totals.totalProfitValue = totals.totalProfitValue
    totals.materialsProfitValue = totals.materialsProfitValue
    totals.hoursProfitValue = totals.hoursProfitValue
    totals.visitProfitValue = totals.visitProfitValue
    totals.totalIvaValue = totals.totalIvaValue

    const totalNetValue = totals.materialsNetValue + totals.visitNetValue + totals.hoursNetValue
    const totalIvaBeforeDiscount = totals.totalIvaValue

    return {
      materialsValue: totals.materialsValue,
      materialsNetValue: totals.materialsNetValue,
      materialsBaseValue: totals.materialsBaseValue,
      materialsIvaWeightedBase: totals.materialsIvaWeightedBase,
      hoursNetValue: totals.hoursNetValue,
      hoursValue: totals.hoursValue,
      visitNetValue: totals.visitNetValue,
      visitValue: totals.visitValue,
      totalProfitValue: totals.totalProfitValue,
      materialsProfitValue: totals.materialsProfitValue,
      hoursProfitValue: totals.hoursProfitValue,
      visitProfitValue: totals.visitProfitValue,
      totalIvaValue: totals.totalIvaValue,
      materialsIvaPercent: totals.materialsIvaPercent,
      hoursIvaPercent: totals.hoursIvaPercent,
      visitIvaPercent: totals.visitIvaPercent,
      totalNetValue,
      totalIvaBeforeDiscount,
    }
  }

  const getQuoteAdditionalBlocks = (feedbackValue: unknown) => {
    const feedback = parseFeedback(feedbackValue)
    if (!feedback) return []

    const rawBlocks = Array.isArray(feedback?.additionalBlocks)
      ? feedback.additionalBlocks
      : Array.isArray(feedback?.additional_blocks)
        ? feedback.additional_blocks
        : Array.isArray(feedback?.extraBlocks)
          ? feedback.extraBlocks
          : []

    return rawBlocks.map((block: any, index: number) => {
      const quantity = Number(block?.quantity ?? block?.qty ?? 1)
      const unitPrice = Number(block?.unitPrice ?? block?.price ?? block?.unit_price ?? 0)
      const markupPercent = Number(block?.markupPercent ?? block?.markup ?? 0)
      const ivaPercent = Number(block?.ivaPercent ?? block?.iva ?? 0)
      const total = unitPrice * quantity
      const withMarkup = total * (1 + markupPercent / 100)
      const iva = withMarkup * (ivaPercent / 100)
      return {
        key: `${block?.id ?? block?.name ?? index}`,
        name: block?.name || block?.title || `Concepto adicional ${index + 1}`,
        quantity,
        unit: block?.unit || '',
        unitPrice,
        markupPercent,
        ivaPercent,
        subtotal: total,
        withMarkup,
        iva,
        total: withMarkup + iva,
      }
    })
  }

  const feedback = parseFeedback(quote?.feedback)
  const serviceName = String(quote?.service ?? quote?.categoria ?? quote?.category ?? '').trim()
  const materials = getQuoteMaterials(feedback)
  const pricing = getQuotePricing(feedback, serviceName)
  const additionalBlocks = getQuoteAdditionalBlocks(feedback)

  const estimatedHours = Number(feedback?.estimatedHours ?? quote?.estimatedHours ?? 0)
  const hourValue = getServiceHourValue(serviceName)
  const hourValueWithMarkup = applyMarkup(hourValue, Number((servicesConfig.find((s) => String(s?.name ?? '').toLowerCase() === serviceName.toLowerCase()) ?? {}).hourMarkupPercent ?? 0))
  const serviceConfig = servicesConfig.find((s) => {
    const normalized = String(s?.name ?? '').trim().toLowerCase()
    const short = String(s?.short ?? '').trim().toLowerCase()
    const selected = serviceName.toLowerCase()
    return normalized === selected || normalized.includes(selected) || short === selected || short.includes(selected)
  })

  const applicablePromotions = getApplicablePromotions(promotionsConfig, new Date(), serviceConfig?.id)
  const selectedPromotionId = String(feedback?.promotionId ?? feedback?.promotion?.id ?? '').trim() || null
  const selectedPromotion = selectedPromotionId
    ? promotionsConfig.find((promotion: any) => String(promotion.id) === selectedPromotionId) ?? (applicablePromotions.length > 0 ? applicablePromotions[0] : null)
    : applicablePromotions.length > 0
      ? applicablePromotions[0]
      : null

  const additionalConceptTotals = additionalBlocks.reduce(
    (acc: { subtotal: number; withMarkup: number; iva: number; total: number }, block: any) => ({
      subtotal: acc.subtotal + (Number(block?.subtotal) || 0),
      withMarkup: acc.withMarkup + (Number(block?.withMarkup) || 0),
      iva: acc.iva + (Number(block?.iva) || 0),
      total: acc.total + (Number(block?.total) || 0),
    }),
    { subtotal: 0, withMarkup: 0, iva: 0, total: 0 },
  )

  const netValueBeforeDiscount = (Number(pricing?.materialsNetValue) || 0) + (Number(pricing?.visitNetValue) || 0) + (Number(pricing?.hoursNetValue) || 0) + additionalConceptTotals.withMarkup
  const grossValueBeforeDiscount = (Number(pricing?.materialsValue) || 0) + (Number(pricing?.visitValue) || 0) + (Number(pricing?.hoursValue) || 0) + additionalConceptTotals.total
  const totalIvaBeforeDiscount = (Number(pricing?.totalIvaValue) || 0) + additionalConceptTotals.iva
  const discountAmount = selectedPromotion ? computeBestPromotionDiscount(netValueBeforeDiscount, [selectedPromotion], new Date(), serviceConfig?.id).discount : 0
  const discountedNetValue = Math.max(0, netValueBeforeDiscount - discountAmount)
  const totalGrossAfterDiscount = discountedNetValue + totalIvaBeforeDiscount

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-2 py-2">
        <div>
          <p className="text-sm text-muted-foreground">Vista previa cliente</p>
          <h3 className="text-lg font-semibold">{quote?.client}</h3>
          <p className="text-sm text-muted-foreground">{quote?.service}</p>
          {quote?.orderId || quote?.id ? (
            <p className="text-xs text-muted-foreground">Orden: #{quote?.orderId ?? quote?.id}</p>
          ) : null}
        </div>
        <div>
          {onClose ? (
            <button onClick={onClose} className="rounded-md border border-border bg-background px-3 py-1 text-sm">Cerrar</button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Descripción de la revisión</p>
          <p className="mt-2 text-sm text-foreground">{feedback?.details || feedback?.description || quote?.notes || 'Sin descripción'}</p>
        </div>

        <div className="rounded-2xl border border-border bg-background/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detalle</p>
            <span className="text-xs text-muted-foreground">{estimatedHours} h x {formatCLP(hourValueWithMarkup)}</span>
          </div>

          <div className="mt-4 space-y-3 text-sm text-foreground">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              <span>Horas de trabajo</span>
              <span>{formatCLP(applyMarkupAndIva(estimatedHours * hourValue, Number((servicesConfig.find((s) => String(s?.name ?? '').toLowerCase() === String(quote?.service ?? '').toLowerCase()) ?? {}).hourMarkupPercent ?? 0), Number((servicesConfig.find((s) => String(s?.name ?? '').toLowerCase() === String(quote?.service ?? '').toLowerCase()) ?? {}).hourIvaPercent ?? 19)))}</span>
            </div>
            {pricing.visitValue > 0 ? (
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                <span>Movilización</span>
                <span>{formatCLP(Number(pricing?.visitValue) || 0)} x {(Number(pricing?.additionalVisitCount) || 0) > 0 ? (Number(pricing?.additionalVisitCount) || 0) + 1 : 1}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              <span>Materiales</span>
              <span>{formatCLP(pricing.materialsValue)}</span>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Materiales incluidos</p>
              <div className="mt-3 space-y-2">
                {materials.map((item: any) => (
                  <div key={item.key} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-sm">
                    <div>
                      <div className="font-medium text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{formatCLP(item.price ?? item.netPrice ?? 0)} c/u</div>
                    </div>
                    <span className="text-muted-foreground">x {item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Conceptos adicionales</p>
              {additionalBlocks.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {additionalBlocks.map((block) => (
                    <div key={block.key} className="rounded-xl border border-border bg-background px-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-foreground">{block.name}</div>
                          <div className="text-xs text-muted-foreground">{formatCLP(block.unitPrice)} c/u × {block.quantity} {block.unit}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Total</div>
                          <div className="font-semibold text-foreground">{formatCLP(block.total)}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
                        <span>Subtotal: {formatCLP(block.subtotal)}</span>
                        <span>IVA: {formatCLP(block.iva)}</span>
                        <span>Con markup: {formatCLP(block.withMarkup)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No hay conceptos adicionales.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total neto</p>
              <p className="mt-3 text-2xl font-bold text-primary">{formatCLP(pricing.materialsNetValue + pricing.visitNetValue + pricing.hoursNetValue)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total IVA</p>
              <p className="mt-3 text-2xl font-bold text-primary">{formatCLP(pricing.totalIvaValue || 0)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total cotización</p>
              <p className="mt-3 text-2xl font-bold text-primary">{formatCLP(discountAmount > 0 ? totalGrossAfterDiscount : grossValueBeforeDiscount)}</p>
              {discountAmount > 0 ? (
                <p className="mt-2 text-sm text-secondary">Incluye descuento de {formatCLP(discountAmount)} aplicado sobre el total antes de IVA.</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Acciones del cliente</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              {(quoteStatus === 'cotizado' || quoteStatus === 'recotizando') && (
                <>
                  <button
                    type="button"
                    disabled={statusLoading}
                    onClick={() => updateOrderStatus('aceptada', 'Cotización aceptada', 'El cliente aceptó la cotización y desea continuar con el pago.')}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusLoading ? 'Procesando...' : 'Aceptar cotización'}
                  </button>
                  <button
                    type="button"
                    disabled={statusLoading}
                    onClick={() => updateOrderStatus('recotizando', 'Recotización solicitada', 'El cliente solicitó ajustes a la cotización.')}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-primary bg-background px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusLoading ? 'Procesando...' : 'Solicitar recotización'}
                  </button>
                  <button
                    type="button"
                    disabled={statusLoading}
                    onClick={() => updateOrderStatus('rechazado', 'Cotización rechazada', 'El cliente rechazó la cotización.')}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-destructive bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusLoading ? 'Procesando...' : 'Rechazar cotización'}
                  </button>
                </>
              )}

              {quoteStatus === 'aceptada' && (
                <>
                  <button
                    type="button"
                    disabled={statusLoading}
                    onClick={() => handlePaymentPlaceholder()}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusLoading ? 'Procesando...' : 'Ir a pago (placeholder)'}
                  </button>
                  <button
                    type="button"
                    disabled={statusLoading}
                    onClick={() => updateOrderStatus('pendiente_pago', 'Pago pendiente', 'La orden fue aceptada y está pendiente de pago.')}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-primary bg-background px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {statusLoading ? 'Procesando...' : 'Marcar como pendiente de pago'}
                  </button>
                </>
              )}

              {quoteStatus === 'pendiente_pago' && (
                <button
                  type="button"
                  disabled={statusLoading}
                  onClick={() => updateOrderStatus('pagada', 'Pago recibido', 'El cliente confirmó el pago.')}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {statusLoading ? 'Procesando...' : 'Confirmar pago recibido'}
                </button>
              )}

              {quoteStatus === 'pagada' && (
                <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Estado cerrado: esta cotización ya fue marcada como pagada.
                </div>
              )}
            </div>
            {statusMessage ? <p className="mt-3 text-sm text-success">{statusMessage}</p> : null}
        </div>
      </div>
    </div>
  )
}
