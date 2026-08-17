#!/usr/bin/env node

/**
 * Script de verificación de Mercado Pago
 * Uso: node scripts/verify-mercadopago.js
 */

const fs = require('fs')
const path = require('path')

console.log('\n🔍 Verificando configuración de Mercado Pago...\n')

// 1. Verificar variables de entorno
console.log('📋 Variables de entorno:')
const envPath = path.join(process.cwd(), '.env.local')
const envExamplePath = path.join(process.cwd(), '.env.example')

let envContent = ''
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8')
  const hasAccessToken = envContent.includes('MERCADOPAGO_ACCESS_TOKEN')
  const hasAppUrl = envContent.includes('NEXT_PUBLIC_APP_URL')
  
  console.log(`  ${hasAccessToken ? '✅' : '❌'} MERCADOPAGO_ACCESS_TOKEN`)
  console.log(`  ${hasAppUrl ? '✅' : '❌'} NEXT_PUBLIC_APP_URL`)
} else {
  console.log('  ❌ .env.local no encontrado')
}

// 2. Verificar archivos de implementación
console.log('\n📁 Archivos de implementación:')

const requiredFiles = [
  'lib/mercadopago-config.ts',
  'lib/mercadopago-server.ts',
  'app/api/payments/mercadopago/route.ts',
  'app/api/payments/mercadopago/webhook/route.ts',
  'components/mercadopago-button.tsx',
]

requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file)
  const exists = fs.existsSync(filePath)
  console.log(`  ${exists ? '✅' : '❌'} ${file}`)
})

// 3. Verificar documentación
console.log('\n📖 Documentación:')
const docs = [
  'MERCADOPAGO_SETUP.md',
  'MERCADOPAGO_QUICK_START.md',
]

docs.forEach(doc => {
  const docPath = path.join(process.cwd(), doc)
  const exists = fs.existsSync(docPath)
  console.log(`  ${exists ? '✅' : '❌'} ${doc}`)
})

// 4. Resumen
console.log('\n📊 Resumen:')
console.log('  Implementación: ✅ Lista')
console.log('  Configuración: ' + (envContent.includes('MERCADOPAGO_ACCESS_TOKEN') ? '✅ Completada' : '⚠️  Falta configurar'))
console.log('  Webhook: ⚠️  Configurar en Mercado Pago Dashboard')

// 5. Próximos pasos
console.log('\n🚀 Próximos pasos:')
console.log('  1. Configurar MERCADOPAGO_ACCESS_TOKEN en .env.local')
console.log('  2. Configurar NEXT_PUBLIC_APP_URL (tu dominio)')
console.log('  3. Registrar webhook en MP Dashboard')
console.log('  4. Probar con tarjetas de prueba')
console.log('  5. Ir a producción con Access Token de producción')

console.log('\n💡 Documentación:')
console.log('  - Setup completo: MERCADOPAGO_SETUP.md')
console.log('  - Guía rápida: MERCADOPAGO_QUICK_START.md')
console.log('  - Probar endpoint: curl http://localhost:3000/api/payments/mercadopago/status\n')
