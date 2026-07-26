import fs from 'fs/promises'
import path from 'path'
import nodemailer from 'nodemailer'
import { db, pool } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, phone, orderId, role, message, createdAt } = body

    const dir = path.join(process.cwd(), 'app', 'data')
    await fs.mkdir(dir, { recursive: true })
    const file = path.join(dir, 'escalations.jsonl')

    const record = {
      name: name ?? null,
      email: email ?? null,
      phone: phone ?? null,
      orderId: orderId ?? null,
      role: role ?? null,
      message: message ?? null,
      createdAt: createdAt ?? new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    }

    // Persist to local file for traceability
    await fs.appendFile(file, JSON.stringify(record) + '\n')

    // Try to persist to DB (best-effort)
    try {
      const client = await pool.connect()
      try {
        await client.query(
          `INSERT INTO escalations(name, email, phone, order_id, role, message, created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [record.name, record.email, record.phone, record.orderId, record.role, record.message, record.createdAt],
        )
      } finally {
        client.release()
      }
    } catch (dbErr) {
      console.warn('No DB table for escalations or DB error, continuing:', dbErr)
    }

    // Send email notification if SMTP configured
    try {
      const to = process.env.SUPPORT_EMAIL_TO
      const host = process.env.SMTP_HOST
      const port = Number(process.env.SMTP_PORT || 587)
      const user = process.env.SMTP_USER
      const pass = process.env.SMTP_PASS

      if (to && host && user && pass) {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        })

        const subject = `[Escalación] ${record.role ?? 'usuario'} - ${record.name ?? 'sin nombre'}`
        const bodyText = `Nueva escalación recibida\n\n${JSON.stringify(record, null, 2)}`

        await transporter.sendMail({
          from: process.env.SMTP_FROM || user,
          to,
          subject,
          text: bodyText,
        })
      } else {
        console.log('SMTP no configurado, se omitió el envío de correo')
      }
    } catch (mailErr) {
      console.warn('Error al enviar correo de escalación:', mailErr)
    }

    // Optionally, log to server console for operators
    console.log('[ESCALATION]', record)

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err: any) {
    console.error('Error in escalate route:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
}
