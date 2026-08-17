import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { orden } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getPaymentDetails } from '@/lib/mercadopago-server'
import { mapMercadoPagoStatusToOrderStatus } from '@/lib/mercadopago-config'

/**
 * Webhook endpoint para recibir notificaciones de Mercado Pago
 * Documentación: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/notifications
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Mercado Pago envía notificaciones con estructura: { id, type, data: { id }, action }
    const type = String(body?.type ?? '').toLowerCase()
    const dataId = body?.data?.id
    const action = String(body?.action ?? '').toLowerCase()

    // Solo procesamos notificaciones de pago
    if (type !== 'payment') {
      console.log(`[Webhook] Notificación recibida (ignorada): type=${type}`)
      return NextResponse.json({ success: true, message: 'Notificación recibida pero no es de pago' })
    }

    if (!dataId) {
      console.warn('[Webhook] Missing payment ID in webhook')
      return NextResponse.json(
        { success: false, error: 'Missing payment id' },
        { status: 400 }
      )
    }

    const paymentId = String(dataId)
    console.log(`[Webhook] Procesando pago ID: ${paymentId}, action: ${action}`)

    // Obtener detalles del pago de Mercado Pago
    const paymentData = await getPaymentDetails(paymentId)
    
    if (!paymentData) {
      console.error('[Webhook] No payment data retrieved')
      return NextResponse.json(
        { success: false, error: 'No payment data' },
        { status: 400 }
      )
    }

    const orderId = paymentData?.metadata?.orderId
    const paymentStatus = String(paymentData?.status ?? '').toLowerCase()

    if (!orderId) {
      console.warn('[Webhook] No order ID in payment metadata')
      return NextResponse.json({ success: true, message: 'No order metadata found' })
    }

    console.log(`[Webhook] Actualizando orden ${orderId} con estado: ${paymentStatus}`)

    // Mapear estado de Mercado Pago a estado de orden
    const mappedStatus = mapMercadoPagoStatusToOrderStatus(paymentStatus)
    
    // Si la orden estaba en "pendiente_pago" y el pago fue aprobado, cambiar a "pendiente"
    // Esto hace que la orden aparezca en el admin solo después de ser pagada
    let newOrderStatus = mappedStatus
    if (mappedStatus === 'pagada') {
      newOrderStatus = 'pendiente'
    }

    // Actualizar orden en la base de datos
    const result = await db.update(orden)
      .set({
        estado: newOrderStatus,
        updatedAt: new Date(),
      })
      .where(eq(orden.id, Number(orderId)))

    console.log(`[Webhook] Orden actualizada - ID: ${orderId}, nuevo estado: ${newOrderStatus}`)

    return NextResponse.json({
      success: true,
      status: newOrderStatus,
      orderId,
      paymentStatus,
    })
  } catch (error) {
    console.error('[Webhook] Error procesando notificación de Mercado Pago:', error)
    
    // Retornar 200 OK para que Mercado Pago no reintente
    // pero loguear el error para revisar después
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: 'Error procesando webhook pero notificación recibida',
      },
      { status: 200 } // Importante: devolver 200 para que MP no reintente infinitamente
    )
  }
}
