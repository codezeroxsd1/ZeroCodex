import { NextResponse } from 'next/server'
import { createMercadoPagoCheckout } from '@/lib/mercadopago-server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const amount = Number(body?.amount ?? 0)
    const orderId = Number(body?.orderId ?? 0)
    const payerEmail = String(body?.payerEmail ?? '')
    const payerName = String(body?.payerName ?? '')
    const description = String(body?.description ?? '')
    
    // Use origin from client, or fallback to NEXT_PUBLIC_APP_URL
    let origin = String(body?.origin ?? '').trim()
    if (!origin) {
      origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    }
    
    console.log('Payment endpoint - origin:', origin, 'orderId:', orderId)

    // Validations
    if (!orderId || orderId <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID de orden inválido' },
        { status: 400 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Monto de pago inválido' },
        { status: 400 }
      )
    }

    if (!payerEmail || !payerEmail.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Email del pagador inválido' },
        { status: 400 }
      )
    }

    const result = await createMercadoPagoCheckout({
      orderId,
      amount,
      payerEmail,
      payerName,
      origin,
      description,
    })

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      initPoint: result.initPoint,
      preferenceId: result.preferenceId,
      checkoutUrl: result.checkoutUrl,
    })
  } catch (error) {
    console.error('POST /api/payments/mercadopago error:', error)
    return NextResponse.json(
      { success: false, error: `Error al procesar el pago: ${String(error)}` },
      { status: 500 }
    )
  }
}
