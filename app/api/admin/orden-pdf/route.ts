import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { saveUploadedAsset } from '@/lib/storage'

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let done = false

  while (!done) {
    const result = await reader.read()
    if (result.done) {
      done = true
      break
    }
    chunks.push(result.value)
  }

  return Buffer.concat(chunks)
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Content-Type incorrecto' }, { status: 400 })
    }

    const formData = await request.formData()
    const orderId = formData.get('orderId')
    const file = formData.get('file')

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'orderId requerido' }, { status: 400 })
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'Archivo PDF requerido' }, { status: 400 })
    }

    const uploadedFile = file as File
    const fileType = uploadedFile.type || ''
    const fileName = uploadedFile.name || ''
    const isPdfMime = fileType.toLowerCase() === 'application/pdf'
    const hasPdfExtension = fileName.toLowerCase().endsWith('.pdf')

    if (!isPdfMime && !hasPdfExtension) {
      return NextResponse.json({ success: false, error: 'Solo se permiten archivos PDF' }, { status: 400 })
    }

    const filename = `orden-${orderId}-${Date.now()}.pdf`
    const buffer = Buffer.from(await uploadedFile.arrayBuffer())

    const asset = await saveUploadedAsset(buffer, filename, uploadedFile.type || 'application/pdf', 'pdfs')
    const pdfUrl = asset.url
    const client = await pool.connect()
    try {
      await client.query('ALTER TABLE orden ADD COLUMN IF NOT EXISTS "pdfUrl" text')
      await client.query('UPDATE orden SET "pdfUrl" = $1, "updatedAt" = NOW() WHERE id = $2', [pdfUrl, Number(orderId)])
    } finally {
      client.release()
    }

    return NextResponse.json({ success: true, pdfUrl })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
