import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMercadoPagoPreferencePayload } from './mercadopago.ts'

test('buildMercadoPagoPreferencePayload includes order metadata and clp amount', () => {
  const payload = buildMercadoPagoPreferencePayload({
    orderId: 42,
    amount: 125000,
    payerEmail: 'cliente@example.com',
    payerName: 'Cliente Demo',
    origin: 'http://localhost:3000',
  })

  assert.equal(payload.items[0].unit_price, 125000)
  assert.equal(payload.items[0].currency_id, 'CLP')
  assert.equal(payload.metadata.orderId, '42')
  assert.ok(payload.back_urls.success.includes('/cliente'))
})
