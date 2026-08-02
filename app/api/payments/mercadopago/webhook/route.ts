import { NextResponse } from 'next/server'
import { db, pool } from '@/lib/db'
import { orden } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const type = String(body?.type ?? '')
    const dataId = body?.data?.id
    const paymentId = dataId ? String(dataId) : null

    if (!paymentId) {
      return NextResponse.json({ success: false, error: 'Missing payment id' }, { status: 400 })
    }

    const topic = type || 'payment'
    const paymentStatus = String(body?.action ?? '').toLowerCase()

    if (topic !== 'payment' || paymentStatus === '') {
      return NextResponse.json({ success: true, message: 'Webhook received' })
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    })

    const paymentData = await paymentResponse.json()
    const orderId = paymentData?.metadata?.orderId
    const status = String(paymentData?.status ?? '').toLowerCase()

    if (!orderId) {
      return NextResponse.json({ success: true, message: 'No order metadata found' })
    }

    const normalizedStatus = status === 'approved' ? 'pagada' : status === 'rejected' ? 'aceptada' : 'pendiente_pago'

    await db.update(orden)
      .set({
        estado: normalizedStatus,
        updatedAt: new Date(),
      })
      .where(eq(orden.id, Number(orderId)))

    return NextResponse.json({ success: true, status: normalizedStatus })
  } catch (error) {
    console.error('Mercado Pago webhook error', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
