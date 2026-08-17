#!/usr/bin/env node

/**
 * Test script to verify Resend email sending
 */

const path = require('path')
const dotenv = require('dotenv')

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local')
dotenv.config({ path: envPath })

async function testResendEmail() {
  const apiKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev'

  console.log('🧪 Testing Resend Email Configuration')
  console.log('=====================================')
  console.log(`API Key: ${apiKey ? `${apiKey.substring(0, 15)}...` : '❌ NOT SET'}`)
  console.log(`From: ${emailFrom}`)
  console.log('')

  if (!apiKey) {
    console.error('❌ RESEND_API_KEY is not configured')
    process.exit(1)
  }

  try {
    console.log('📧 Sending test verification email to demo@example.com...')
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: 'delivered@resend.dev', // Resend test address
        subject: 'Zero Industries - Test Email Verification',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Bienvenido a Zero Industries</h2>
            <p>Tu código de verificación es:</p>
            <h1 style="color: #3b82f6; font-size: 32px; letter-spacing: 8px;">123456</h1>
            <p>Ingresa este código en la aplicación para activar tu cuenta.</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">Este código expira en 5 minutos.</p>
          </div>
        `,
        text: 'Tu código de verificación es: 123456',
      }),
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Email sent successfully!')
      console.log(`Email ID: ${data.id}`)
      console.log('')
      console.log('📝 Configuration:')
      console.log(`   RESEND_API_KEY: ${apiKey.substring(0, 20)}...`)
      console.log(`   EMAIL_FROM: ${emailFrom}`)
      console.log('')
      console.log('✅ Resend is working correctly!')
      console.log('Verification emails should now be sent automatically.')
      process.exit(0)
    } else {
      console.error('❌ Resend API Error:')
      console.error(`Status: ${response.status}`)
      console.error('Response:', JSON.stringify(data, null, 2))
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

testResendEmail()
