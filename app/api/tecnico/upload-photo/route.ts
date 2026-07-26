import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

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
    const category = formData.get('category')
    const file = formData.get('file')

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'orderId requerido' }, { status: 400 })
    }

    if (!category || (category !== 'before' && category !== 'after')) {
      return NextResponse.json({ success: false, error: 'category inválida' }, { status: 400 })
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'Archivo de imagen requerido' }, { status: 400 })
    }

    const uploadedFile = file as File
    const fileType = uploadedFile.type || ''
    const fileName = uploadedFile.name || ''
    const isImageMime = fileType.toLowerCase().startsWith('image/')
    const hasImageExtension = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some((ext) => fileName.toLowerCase().endsWith(ext))

    if (!isImageMime && !hasImageExtension) {
      return NextResponse.json({ success: false, error: 'Solo se permiten imágenes' }, { status: 400 })
    }

    const extension = fileName.split('.').pop() || 'jpg'
    const filename = `orden-${orderId}-${category}-${Date.now()}.${extension}`
    const buffer = Buffer.from(await uploadedFile.arrayBuffer())

    const fs = await import('fs/promises')
    const path = await import('path')
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'photos')
    await fs.mkdir(uploadsDir, { recursive: true })
    const targetPath = path.join(uploadsDir, filename)
    await fs.writeFile(targetPath, buffer)

    const url = `/uploads/photos/${filename}`
    const client = await pool.connect()
    try {
      await client.query('UPDATE orden SET "updatedAt" = NOW() WHERE id = $1', [Number(orderId)])
    } finally {
      client.release()
    }

    return NextResponse.json({ success: true, url })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
