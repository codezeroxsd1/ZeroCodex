const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

async function main() {
  const envText = fs.readFileSync('./.env.local', 'utf8')
  const env = Object.fromEntries(
    envText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const idx = line.indexOf('=')
        return [line.slice(0, idx), line.slice(idx + 1)]
      })
  )

  if (!env.DATABASE_URL) {
    console.error('Please set DATABASE_URL in your environment (.env.local)')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL })
  const uploadsRoot = path.join(process.cwd(), 'public', 'uploads')
  const oldDir = uploadsRoot
  const newDir = path.join(uploadsRoot, 'pdfs')

  try {
    await fs.promises.mkdir(newDir, { recursive: true })

    const client = await pool.connect()
    try {
      const res = await client.query("SELECT id, \"pdfUrl\" FROM orden WHERE \"pdfUrl\" IS NOT NULL")
      for (const row of res.rows) {
        const url = row.pdfUrl
        if (!url) continue
        // only handle urls that start with /uploads/
        if (!url.startsWith('/uploads/')) continue
        const filename = url.replace('/uploads/', '')
        const srcPath = path.join(process.cwd(), 'public', 'uploads', filename)
        const dstPath = path.join(newDir, filename)

        // if source exists and not already in new location, move
        try {
          if (fs.existsSync(srcPath)) {
            await fs.promises.rename(srcPath, dstPath)
            const newUrl = `/uploads/pdfs/${filename}`
            await client.query('UPDATE orden SET "pdfUrl" = $1 WHERE id = $2', [newUrl, row.id])
            console.log(`Moved ${filename} -> ${newUrl}`)
          } else {
            // maybe file already in uploads/pdfs
            const alt = path.join(newDir, filename)
            if (fs.existsSync(alt)) {
              const newUrl = `/uploads/pdfs/${filename}`
              await client.query('UPDATE orden SET "pdfUrl" = $1 WHERE id = $2', [newUrl, row.id])
              console.log(`Patched DB path for ${row.id} -> ${newUrl}`)
            } else {
              console.log(`File not found for order ${row.id}: ${url}`)
            }
          }
        } catch (e) {
          console.error('Error moving file', filename, e.message)
        }
      }
    } finally {
      client.release()
    }
  } catch (e) {
    console.error('Migration error:', e.message)
  } finally {
    await pool.end()
  }
}

main()
