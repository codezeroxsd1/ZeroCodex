import { NextResponse } from 'next/server'

/**
 * GET endpoint para validar el webhook
 * Mercado Pago valida que el endpoint existe y es accesible
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Webhook endpoint is active',
    endpoint: '/api/payments/mercadopago/webhook',
  })
}
