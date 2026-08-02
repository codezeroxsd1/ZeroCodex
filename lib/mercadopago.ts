export type MercadoPagoPreferenceInput = {
  orderId: number | string
  amount: number
  payerEmail: string
  payerName: string
  origin: string
}

export function buildMercadoPagoPreferencePayload({
  orderId,
  amount,
  payerEmail,
  payerName,
  origin,
}: MercadoPagoPreferenceInput) {
  const sanitizedOrigin = origin.replace(/\/$/, '')
  return {
    items: [
      {
        title: `Pago de orden #${orderId}`,
        quantity: 1,
        unit_price: Math.max(0, Math.round(amount)),
        currency_id: 'CLP',
      },
    ],
    payer: {
      email: payerEmail,
      name: payerName,
    },
    payment_methods: {
      excluded_payment_types: [{ id: 'ticket' }],
    },
    metadata: {
      orderId: String(orderId),
      source: 'zero-industries',
    },
    back_urls: {
      success: `${sanitizedOrigin}/cliente?payment=success`,
      failure: `${sanitizedOrigin}/cliente?payment=failure`,
      pending: `${sanitizedOrigin}/cliente?payment=pending`,
    },
    auto_return: 'approved',
  }
}
