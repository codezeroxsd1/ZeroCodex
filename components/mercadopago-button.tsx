/**
 * Componente reutilizable para realizar pagos con Mercado Pago
 */
'use client'

import { useState } from 'react'

export interface PaymentButtonProps {
  orderId: number | string
  amount: number
  payerEmail: string
  payerName?: string
  description?: string
  onPaymentStart?: () => void
  onPaymentError?: (error: string) => void
  onSuccess?: () => void
  className?: string
  children?: React.ReactNode
}

export function MercadoPagoButton({
  orderId,
  amount,
  payerEmail,
  payerName = '',
  description = '',
  onPaymentStart,
  onPaymentError,
  onSuccess,
  className = '',
  children = 'Pagar ahora',
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePayment = async () => {
    try {
      setLoading(true)
      setError(null)
      
      onPaymentStart?.()

      // Validaciones
      if (!orderId || Number(orderId) <= 0) {
        throw new Error('ID de orden inválido')
      }

      if (!amount || Number(amount) <= 0) {
        throw new Error('Monto de pago inválido')
      }

      if (!payerEmail || !payerEmail.includes('@')) {
        throw new Error('Correo electrónico inválido')
      }

      // Crear preferencia de pago
      const response = await fetch('/api/payments/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          payerEmail,
          payerName: payerName || payerEmail,
          description: description || `Pago de orden #${orderId}`,
          origin: window.location.origin,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'No se pudo crear la preferencia de pago')
      }

      if (!data?.initPoint && !data?.checkoutUrl) {
        throw new Error('No se recibió el enlace de pago')
      }

      // Redirigir a Mercado Pago
      onSuccess?.()
      window.location.assign(data.initPoint || data.checkoutUrl)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      onPaymentError?.(errorMessage)
      console.error('Payment error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={handlePayment}
        className={`inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        {loading ? 'Redirigiendo a Mercado Pago...' : children}
      </button>
      
      {error && (
        <p className="text-sm text-destructive">
          ❌ {error}
        </p>
      )}
    </div>
  )
}
