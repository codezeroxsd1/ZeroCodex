/**
 * Utilidades de servidor para Mercado Pago
 */

import { mercadoPagoConfig } from './mercadopago-config'

export interface MercadoPagoPreferenceInput {
  orderId: number | string
  amount: number
  payerEmail: string
  payerName: string
  origin: string
  description?: string
}

export interface MercadoPagoPreference {
  items: Array<{
    title: string
    quantity: number
    unit_price: number
    currency_id: string
    description?: string
  }>
  payer: {
    email: string
    name: string
  }
  payment_methods: {
    excluded_payment_types: Array<{ id: string }>
  }
  metadata: {
    orderId: string
    source: string
  }
  back_urls?: {
    success: string
    failure: string
    pending: string
  }
  auto_return?: 'approved' | 'all'
  notification_url?: string
}

export function buildMercadoPagoPreference(
  input: MercadoPagoPreferenceInput
): MercadoPagoPreference {
  const { orderId, amount, payerEmail, payerName, origin, description } = input
  const sanitizedOrigin = origin.replace(/\/$/, '')
  
  const preference: MercadoPagoPreference = {
    items: [
      {
        title: description || `Pago de orden #${orderId}`,
        quantity: 1,
        unit_price: Math.max(0, Math.round(amount)),
        currency_id: mercadoPagoConfig.currency,
        description: `Orden #${orderId}`,
      },
    ],
    payer: {
      email: payerEmail,
      name: payerName || payerEmail,
    },
    payment_methods: mercadoPagoConfig.paymentMethods,
    metadata: {
      orderId: String(orderId),
      source: 'zero-industries',
    },
    back_urls: {
      success: `${sanitizedOrigin}/cliente?payment=success&orderId=${orderId}`,
      failure: `${sanitizedOrigin}/cliente?payment=failure&orderId=${orderId}`,
      pending: `${sanitizedOrigin}/cliente?payment=pending&orderId=${orderId}`,
    },
    // Note: auto_return causes issues in sandbox, using back_urls for redirects
    notification_url: mercadoPagoConfig.webhookUrl(),
  }
  
  return preference
}

export interface CreateCheckoutResponse {
  success: boolean
  preferenceId?: string
  initPoint?: string
  checkoutUrl?: string
  error?: string
  message?: string
}

export async function createMercadoPagoCheckout(
  input: MercadoPagoPreferenceInput
): Promise<CreateCheckoutResponse> {
  const accessToken = mercadoPagoConfig.getAccessToken()
  
  if (!accessToken) {
    return {
      success: false,
      error: 'Mercado Pago no está configurado. Define MERCADOPAGO_ACCESS_TOKEN en las variables de entorno.',
    }
  }

  try {
    const preference = buildMercadoPagoPreference(input)
    
    console.log('Building preference with origin:', input.origin)
    console.log('Full preference object:', JSON.stringify(preference, null, 2))

    const response = await fetch(mercadoPagoConfig.api.preferences, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Mercado Pago API error:', data)
      console.error('Preference that caused error:', preference)
      return {
        success: false,
        error: data?.message || 'No se pudo crear la preferencia de pago',
      }
    }

    return {
      success: true,
      preferenceId: data.id,
      initPoint: data.init_point,
      checkoutUrl: data.init_point, // Alias
    }
  } catch (error) {
    console.error('Error creating Mercado Pago checkout:', error)
    return {
      success: false,
      error: `Error al procesar el pago: ${String(error)}`,
    }
  }
}

export interface PaymentWebhookData {
  id: string
  type: string
  data: {
    id: string
  }
  action: string
}

export async function getPaymentDetails(paymentId: string) {
  const accessToken = mercadoPagoConfig.getAccessToken()
  
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured')
  }

  try {
    const response = await fetch(
      `${mercadoPagoConfig.api.payments}/${paymentId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch payment details: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching payment details:', error)
    throw error
  }
}
