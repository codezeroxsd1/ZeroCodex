// Test email sending with current configuration

const path = require('path')
const dotenv = require('dotenv')

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local')
dotenv.config({ path: envPath })

const hasResendKey = !!process.env.RESEND_API_KEY
const hasSmtpConfig = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_FROM

console.log('📧 Email Configuration Check:')
console.log('=====================================')
console.log(`Resend API Key: ${hasResendKey ? '✅ Configured' : '❌ NOT configured'}`)
console.log(`SMTP Config: ${hasSmtpConfig ? '✅ Configured' : '❌ NOT configured'}`)
console.log(`Email From: ${emailFrom || '❌ NOT configured'}`)
console.log(`Mail Provider: ${process.env.MAIL_PROVIDER || 'auto-detect'}`)
console.log('=====================================')
console.log('')

if (hasResendKey) {
  console.log(`✅ Resend is configured with key: ${process.env.RESEND_API_KEY.substring(0, 10)}...`)
  console.log(`✅ FROM address: ${emailFrom}`)
  console.log('')
  console.log('Test: Attempting to send test email...')

  // Test Resend API
  const testResend = async () => {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom || 'onboarding@resend.dev',
          to: 'test@example.com',
          subject: 'Test Email from Zero Industries',
          html: '<p>This is a test email</p>',
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        console.log('✅ Email sent successfully!')
        console.log('Response:', JSON.stringify(data, null, 2))
      } else {
        console.log('❌ Resend API Error:')
        console.log('Status:', response.status)
        console.log('Response:', JSON.stringify(data, null, 2))
      }
    } catch (error) {
      console.error('❌ Test failed:', error.message)
    }
  }

  testResend()
} else if (hasSmtpConfig) {
  console.log(`✅ SMTP is configured:`)
  console.log(`   Host: ${process.env.SMTP_HOST}`)
  console.log(`   Port: ${process.env.SMTP_PORT}`)
  console.log(`   User: ${process.env.SMTP_USER}`)
  console.log('')
} else {
  console.log('❌ NO email provider is configured!')
  console.log('')
  console.log('Add one of the following to .env.local:')
  console.log('')
  console.log('Option 1: Resend (recommended)')
  console.log('  RESEND_API_KEY=re_xxxxxxxxxxxxx')
  console.log('  EMAIL_FROM=noreply@example.com')
  console.log('')
  console.log('Option 2: SMTP')
  console.log('  SMTP_HOST=smtp.gmail.com')
  console.log('  SMTP_PORT=587')
  console.log('  SMTP_USER=your-email@gmail.com')
  console.log('  SMTP_PASS=your-app-password')
  console.log('  EMAIL_FROM=your-email@gmail.com')
}
