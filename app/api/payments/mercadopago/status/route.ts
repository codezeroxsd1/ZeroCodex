/**
 * Endpoint de prueba para verificar la integración de Mercado Pago
 * Solo usar en desarrollo/staging
 */

import { NextResponse } from 'next/server'
import { createMercadoPagoCheckout } from '@/lib/mercadopago-server'
import { mercadoPagoConfig } from '@/lib/mercadopago-config'

export async function GET(req: Request) {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Este endpoint solo está disponible en desarrollo' },
      { status: 403 }
    )
  }

  const accessToken = mercadoPagoConfig.getAccessToken()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const webhookUrl = mercadoPagoConfig.webhookUrl()

  return NextResponse.json({
    status: 'ok',
    integration: {
      mercadoPagoConfigured: !!accessToken,
      accessTokenStatus: accessToken ? '✅ Configurado' : '❌ Falta configurar',
      publicKeyStatus: mercadoPagoConfig.getPublicKey() ? '✅ Configurado' : '⚠️ Opcional',
      appUrl,
      webhookUrl,
    },
    testData: {
      orderId: 12345,
      amount: 50000,
      payerEmail: 'test@example.com',
      payerName: 'Cliente Test',
      description: 'Pago de prueba',
    },
    endpoints: {
      createCheckout: '/api/payments/mercadopago',
      webhook: '/api/payments/mercadopago/webhook',
      status: '/api/payments/mercadopago/status',
    },
  })
}

/**
 * POST endpoint para probar la creación de checkout
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Este endpoint solo está disponible en desarrollo' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()

    // Usar datos de prueba si no se proporciona
    const testData = {
      orderId: body?.orderId || 99999,
      amount: body?.amount || 50000,
      payerEmail: body?.payerEmail || 'test@example.com',
      payerName: body?.payerName || 'Cliente Test',
      description: body?.description || 'Pago de prueba',
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    }

    const result = await createMercadoPagoCheckout(testData)

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.success
        ? '✅ Preferencia creada correctamente'
        : '❌ Error creando preferencia',
      testData,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
