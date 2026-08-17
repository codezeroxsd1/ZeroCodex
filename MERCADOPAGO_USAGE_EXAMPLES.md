/**
 * Ejemplo de cómo usar el componente MercadoPagoButton
 * 
 * Este archivo muestra cómo integrar pagos de Mercado Pago
 * en diferentes partes de la aplicación
 */

// ============================================
// Ejemplo 1: En un componente de cliente
// ============================================

import { MercadoPagoButton } from '@/components/mercadopago-button'

export function OrderPaymentExample() {
  const orderId = 12345
  const totalAmount = 50000
  const clientEmail = 'cliente@example.com'
  const clientName = 'Nombre del Cliente'

  return (
    <div className="space-y-4">
      <h2>Pago de Orden #{orderId}</h2>
      
      <div className="rounded-lg border p-4">
        <p className="text-lg font-semibold">Total: ${totalAmount.toLocaleString()} CLP</p>
      </div>

      <MercadoPagoButton
        orderId={orderId}
        amount={totalAmount}
        payerEmail={clientEmail}
        payerName={clientName}
        description={`Pago de orden #${orderId}`}
        onPaymentStart={() => console.log('Iniciando pago...')}
        onPaymentError={(error) => console.error('Error:', error)}
        onSuccess={() => console.log('Pago iniciado correctamente')}
      />
    </div>
  )
}

// ============================================
// Ejemplo 2: Uso manual sin componente
// ============================================

export async function initiatePaymentManually(
  orderId: number,
  amount: number,
  payerEmail: string,
  payerName: string
) {
  try {
    const response = await fetch('/api/payments/mercadopago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        amount,
        payerEmail,
        payerName,
        description: `Pago de orden #${orderId}`,
        origin: window.location.origin,
      }),
    })

    const data = await response.json()

    if (data?.success && data?.initPoint) {
      // Redirigir a Mercado Pago
      window.location.assign(data.initPoint)
    } else {
      throw new Error(data?.error || 'Error al procesar pago')
    }
  } catch (error) {
    console.error('Payment error:', error)
    alert(`Error: ${String(error)}`)
  }
}

// ============================================
// Ejemplo 3: Estados y validaciones
// ============================================

export interface OrderStatus {
  id: number
  estado: 'cotizado' | 'aceptada' | 'pendiente_pago' | 'pagada' | 'rechazado'
  total: number
}

export function PaymentFlow(order: OrderStatus) {
  return (
    <div>
      {order.estado === 'cotizado' && (
        <p>✅ Cotización lista - Acepta para continuar</p>
      )}

      {order.estado === 'aceptada' && (
        <MercadoPagoButton
          orderId={order.id}
          amount={order.total}
          payerEmail="cliente@example.com"
          payerName="Cliente"
        >
          Proceder al pago
        </MercadoPagoButton>
      )}

      {order.estado === 'pendiente_pago' && (
        <p>⏳ Esperando confirmación del pago...</p>
      )}

      {order.estado === 'pagada' && (
        <p>✅ Pago confirmado - Orden completada</p>
      )}

      {order.estado === 'rechazado' && (
        <p>❌ Orden rechazada</p>
      )}
    </div>
  )
}

// ============================================
// Ejemplo 4: Manejo de callback después del pago
// ============================================

'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export function PaymentCallbackHandler() {
  const searchParams = useSearchParams()
  const paymentStatus = searchParams.get('payment')
  const orderId = searchParams.get('orderId')

  useEffect(() => {
    if (paymentStatus === 'success' && orderId) {
      console.log(`✅ Pago exitoso para orden ${orderId}`)
      // Aquí puedes:
      // - Mostrar mensaje de éxito
      // - Redirigir a página de confirmación
      // - Actualizar estado en BD (aunque el webhook ya lo hace)
    } else if (paymentStatus === 'failure' && orderId) {
      console.log(`❌ Pago fallido para orden ${orderId}`)
      // Mostrar mensaje de error
    } else if (paymentStatus === 'pending' && orderId) {
      console.log(`⏳ Pago pendiente para orden ${orderId}`)
      // Mostrar estado pendiente
    }
  }, [paymentStatus, orderId])

  return (
    <div>
      {paymentStatus === 'success' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-800">✅ Pago recibido</p>
          <p className="text-sm text-green-700">Tu orden ha sido confirmada. Pronto recibirás más detalles.</p>
        </div>
      )}

      {paymentStatus === 'failure' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">❌ Error en el pago</p>
          <p className="text-sm text-red-700">El pago no se completó. Intenta nuevamente.</p>
        </div>
      )}
    </div>
  )
}

// ============================================
// Ejemplo 5: TypeScript - Tipos útiles
// ============================================

export interface Order {
  id: number
  clienteNombre: string
  clienteEmail: string
  total: number
  estado: 'cotizado' | 'aceptada' | 'pendiente_pago' | 'pagada'
}

export interface PaymentResult {
  success: boolean
  preferenceId?: string
  initPoint?: string
  error?: string
}

export async function createPaymentPreference(order: Order): Promise<PaymentResult> {
  const response = await fetch('/api/payments/mercadopago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: order.id,
      amount: order.total,
      payerEmail: order.clienteEmail,
      payerName: order.clienteNombre,
      description: `Orden #${order.id}`,
      origin: window.location.origin,
    }),
  })

  return response.json()
}

// ============================================
// Ejemplo 6: Integración en modal
// ============================================

'use client'

import { useState } from 'react'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  order: Order
}

export function PaymentModal({ isOpen, onClose, order }: PaymentModalProps) {
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handlePay = async () => {
    setLoading(true)
    try {
      const result = await createPaymentPreference(order)
      if (result?.initPoint) {
        window.location.assign(result.initPoint)
      } else {
        alert('Error: ' + result?.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Confirmar Pago</h2>
        <p className="mt-2 text-gray-600">
          Total: ${order.total.toLocaleString()} CLP
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded px-4 py-2 text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handlePay}
            disabled={loading}
            className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Pagar ahora'}
          </button>
        </div>
      </div>
    </div>
  )
}
