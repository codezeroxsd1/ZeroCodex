const fs = require('fs')
const path = require('path')

const mapPath = path.join(process.cwd(), '.next', 'dev', 'static', 'chunks', '_0dun8s~._.js.map')
const targetFragment = '/components/admin/admin-panel.tsx'
const outPath = path.join(process.cwd(), 'components', 'admin', 'admin-panel.recovered.tsx')

function run() {
  if (!fs.existsSync(mapPath)) {
    console.error('Sourcemap not found:', mapPath)
    process.exit(2)
  }

  const raw = fs.readFileSync(mapPath, 'utf8')
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    console.error('Failed to parse sourcemap JSON:', e)
    process.exit(3)
  }

  const sections = parsed.sections || []
  for (const sec of sections) {
    const map = sec.map
    if (!map || !Array.isArray(map.sources)) continue
    for (let i = 0; i < map.sources.length; i++) {
      const src = map.sources[i]
      if (typeof src === 'string' && src.indexOf(targetFragment) !== -1) {
        const content = (map.sourcesContent && map.sourcesContent[i])
        if (!content) continue
        // sourcesContent has raw source with CRLF sequences; write as-is but normalize newlines
        const normalized = content.replace(/\r\n/g, '\n')
        fs.writeFileSync(outPath, normalized, 'utf8')
        console.log('Recovered source written to', outPath)
        process.exit(0)
      }
    }
  }

  console.error('Target source not found in sourcemap')
  process.exit(4)
}

run()
