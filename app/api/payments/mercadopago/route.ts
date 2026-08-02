import { NextResponse } from 'next/server'
import { buildMercadoPagoPreferencePayload } from '@/lib/mercadopago'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const amount = Number(body?.amount ?? 0)
    const orderId = Number(body?.orderId ?? 0)
    const payerEmail = String(body?.payerEmail ?? '')
    const payerName = String(body?.payerName ?? '')
    const origin = String(body?.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

    if (!orderId || !amount || !payerEmail) {
      return NextResponse.json({ success: false, error: 'Faltan datos del pago' }, { status: 400 })
    }

    const payload = buildMercadoPagoPreferencePayload({
      orderId,
      amount,
      payerEmail,
      payerName: payerName || payerEmail,
      origin,
    })

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Mercado Pago no está configurado aún. Define MERCADOPAGO_ACCESS_TOKEN.',
        preference: payload,
      }, { status: 500 })
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ success: false, error: data?.message || 'No se pudo crear la preferencia de Mercado Pago' }, { status: 502 })
    }

    return NextResponse.json({ success: true, initPoint: data.init_point, preferenceId: data.id })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
