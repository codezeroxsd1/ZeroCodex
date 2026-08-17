/**
 * Configuración y utilidades para Mercado Pago
 */

export const mercadoPagoConfig = {
  // Access token se obtiene de variables de entorno
  getAccessToken: () => process.env.MERCADOPAGO_ACCESS_TOKEN,
  
  // Public key para componentes del cliente (si es necesario)
  getPublicKey: () => process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY,
  
  // URLs de la API
  api: {
    preferences: 'https://api.mercadopago.com/checkout/preferences',
    payments: 'https://api.mercadopago.com/v1/payments',
  },
  
  // Configuración de notificaciones
  webhookUrl: () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/api/payments/mercadopago/webhook`
  },
  
  // Moneda por defecto (Chile)
  currency: 'CLP',
  
  // Tipos de pago permitidos/excluidos
  paymentMethods: {
    excluded_payment_types: [
      { id: 'ticket' }, // Excluir tickets
    ],
  },
}

export type MercadoPagoPaymentStatus = 
  | 'pending' 
  | 'approved' 
  | 'authorized' 
  | 'in_process' 
  | 'in_mediation' 
  | 'rejected' 
  | 'cancelled' 
  | 'refunded' 
  | 'charged_back'

export const mapMercadoPagoStatusToOrderStatus = (
  mpStatus: string
): 'pagada' | 'pendiente_pago' | 'aceptada' => {
  const status = String(mpStatus).toLowerCase()
  
  if (['approved', 'authorized'].includes(status)) {
    return 'pagada'
  } else if (['rejected', 'cancelled', 'charged_back'].includes(status)) {
    return 'aceptada'
  } else {
    return 'pendiente_pago'
  }
}
