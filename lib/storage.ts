import { createPrivateKey, createSign } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

type UploadResult = {
  url: string
  provider: 'drive' | 'local'
  fileId?: string
}

function getDriveConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1gRm7cXHWhXIJuUlDd1HhL19dnEIhfWpa'

  if (!email || !privateKey) {
    return null
  }

  return { email, privateKey, folderId }
}

function base64Url(input: string) {
  return Buffer.from(input).toString('base64url')
}

function createJwt(email: string, privateKey: string) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encodedHeader = base64Url(JSON.stringify(header))
  const encodedPayload = base64Url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  const signature = signer.sign(createPrivateKey(privateKey), 'base64url')

  return `${signingInput}.${signature}`
}

async function getDriveAccessToken(email: string, privateKey: string) {
  const assertion = createJwt(email, privateKey)
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'No se pudo obtener el token de Google Drive')
  }

  return data.access_token as string
}

function buildMultipartBody(buffer: Buffer, filename: string, mimeType: string, folderId: string, boundary: string) {
  const metadata = JSON.stringify({ name: filename, parents: [folderId] })
  const preamble = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    '',
  ].join('\r\n')

  const closing = `\r\n--${boundary}--\r\n`
  return Buffer.concat([Buffer.from(preamble), buffer, Buffer.from(closing)])
}

async function uploadToDrive(buffer: Buffer, filename: string, mimeType: string, folderId: string): Promise<UploadResult> {
  const config = getDriveConfig()
  if (!config) {
    throw new Error('Google Drive credentials are not configured')
  }

  const accessToken = await getDriveAccessToken(config.email, config.privateKey)
  const boundary = `drive-${Date.now()}`
  const body = buildMultipartBody(buffer, filename, mimeType, folderId, boundary)

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.id) {
    throw new Error(data?.error?.message || 'No se pudo subir el archivo a Google Drive')
  }

  const fileId = data.id as string
  const fileUrl = (data.webViewLink || data.webContentLink || `https://drive.google.com/file/d/${fileId}/view`) as string

  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  }).catch(() => undefined)

  return {
    url: fileUrl,
    provider: 'drive',
    fileId,
  }
}

async function uploadToLocal(buffer: Buffer, filename: string, subdir: 'pdfs' | 'photos'): Promise<UploadResult> {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', subdir)
  await mkdir(uploadsDir, { recursive: true })
  const targetPath = path.join(uploadsDir, filename)
  await writeFile(targetPath, buffer)

  return {
    url: `/uploads/${subdir}/${filename}`,
    provider: 'local',
  }
}

export async function saveUploadedAsset(buffer: Buffer, filename: string, mimeType: string, subdir: 'pdfs' | 'photos') {
  const driveConfig = getDriveConfig()

  if (driveConfig) {
    try {
      return await uploadToDrive(buffer, filename, mimeType, driveConfig.folderId)
    } catch (error) {
      console.warn('Google Drive upload failed, falling back to local storage', error)
    }
  }

  return uploadToLocal(buffer, filename, subdir)
}
