const { Pool } = require('pg')
const crypto = require('crypto')

// Helper to add days to a date
function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Please set DATABASE_URL in your environment')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: url })
  try {
    console.log('=== SEEDING DATABASE ===\n')

    // Define multiple technicians
    const tecnicos = [
      { email: 'tecnico.demo@zero.local', name: 'Técnico Demo' },
      { email: 'carlos.munoz@zero.local', name: 'Carlos Muñoz' },
      { email: 'maria.garcia@zero.local', name: 'María García' },
      { email: 'jorge.lopez@zero.local', name: 'Jorge López' },
    ]

    // Define multiple clients
    const clientes = [
      { email: 'cliente.demo@zero.local', name: 'Cliente Demo' },
      { email: 'empresa.a@zero.local', name: 'Empresa A Ltda.' },
      { email: 'empresa.b@zero.local', name: 'Empresa B S.A.' },
      { email: 'hogar.c@zero.local', name: 'Hogar C' },
      { email: 'tienda.d@zero.local', name: 'Tienda D' },
    ]

    // Create or fetch technician IDs
    const techIds = {}
    for (const tech of tecnicos) {
      let res = await pool.query('SELECT id FROM "user" WHERE email = $1 LIMIT 1', [tech.email])
      if (res.rows.length) {
        techIds[tech.email] = res.rows[0].id
        console.log(`✓ Found tecnico: ${tech.name}`)
      } else {
        const id = crypto.randomUUID()
        techIds[tech.email] = id
        await pool.query(
          'INSERT INTO "user" (id, name, email, role, createdAt, updatedAt) VALUES ($1,$2,$3,$4,now(),now())',
          [id, tech.name, tech.email, 'tecnico'],
        )
        console.log(`✓ Created tecnico: ${tech.name}`)
      }
    }

    console.log()

    // Create or fetch client IDs
    const clientIds = {}
    for (const client of clientes) {
      let res = await pool.query('SELECT id FROM "user" WHERE email = $1 LIMIT 1', [client.email])
      if (res.rows.length) {
        clientIds[client.email] = res.rows[0].id
        console.log(`✓ Found cliente: ${client.name}`)
      } else {
        const id = crypto.randomUUID()
        clientIds[client.email] = id
        await pool.query(
          'INSERT INTO "user" (id, name, email, role, createdAt, updatedAt) VALUES ($1,$2,$3,$4,now(),now())',
          [id, client.name, client.email, 'cliente'],
        )
        console.log(`✓ Created cliente: ${client.name}`)
      }
    }

    console.log()

    // Define orders with variety of states, categories, prices, and dates (all in July 2026)
    const ordenes = [
      { categoria: 'reparaciones', descripcion: 'Cortocircuito en tablero principal', precio: 49990, dias: -17, estado: 'finalizado', client: 0, tech: 0 },
      { categoria: 'instalación', descripcion: 'Instalación de luminarias LED', precio: 120000, dias: -15, estado: 'finalizado', client: 1, tech: 1 },
      { categoria: 'mantenimiento', descripcion: 'Revisión preventiva de cableado', precio: 35990, dias: -12, estado: 'finalizado', client: 2, tech: 2 },
      { categoria: 'reparaciones', descripcion: 'Cambio de disyuntores dañados', precio: 65000, dias: -8, estado: 'en progreso', client: 3, tech: 3 },
      { categoria: 'instalación', descripcion: 'Panel solar para consumo doméstico', precio: 450000, dias: -6, estado: 'en progreso', client: 4, tech: 0 },
      { categoria: 'diagnóstico', descripcion: 'Evaluación de consumo eléctrico', precio: 25990, dias: -4, estado: 'pendiente', client: 1, tech: 1 },
      { categoria: 'mantenimiento', descripcion: 'Limpieza de ductos y cajas', precio: 39990, dias: -2, estado: 'pendiente', client: 2, tech: 2 },
      { categoria: 'reparaciones', descripcion: 'Reparación de enchufes y switches', precio: 29990, dias: 0, estado: 'pendiente', client: 0, tech: 3 },
      { categoria: 'instalación', descripcion: 'Sistema de respaldo UPS', precio: 89990, dias: 2, estado: 'pendiente', client: 3, tech: 0 },
      { categoria: 'emergencia', descripcion: 'Apagón por falla en acometida', precio: 99990, dias: 4, estado: 'pendiente', client: 4, tech: 1 },
      { categoria: 'reparaciones', descripcion: 'Cortocircuito en circuito N°3', precio: 45000, dias: 7, estado: 'pendiente', client: 1, tech: 2 },
    ]

    console.log('Creating orders...')
    const ordenIds = []
    const tecnicoEmails = Object.keys(techIds)
    const clienteEmails = Object.keys(clientIds)

    for (let i = 0; i < ordenes.length; i++) {
      const ord = ordenes[i]
      const clientEmail = clienteEmails[ord.client]
      const techEmail = tecnicoEmails[ord.tech]
      const clientId = clientIds[clientEmail]
      const techId = techIds[techEmail]
      const clientData = clientes[ord.client]
      const techData = tecnicos[ord.tech]

      // Create date: today + dias
      const orderDate = addDays(new Date(), ord.dias)

      // Check if orden already exists (by client + categoria + date)
      let res = await pool.query(
        `SELECT id FROM orden WHERE clienteid = $1 AND categoria = $2 AND DATE(createdat) = DATE($3) LIMIT 1`,
        [clientId, ord.categoria, orderDate],
      )

      if (res.rows.length) {
        console.log(`✓ Orden already exists: ${ord.categoria} para ${clientData.name}`)
        ordenIds.push(res.rows[0].id)
      } else {
        const insert = await pool.query(
          `INSERT INTO orden (clienteid, clientenombre, clientetelefono, categoria, descripcion, direccion, urgencia, estado, tecnicoid, tecniconombre, precio, createdat, updatedat)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, $12, $12) RETURNING id`,
          [
            clientId,
            clientData.name,
            '+56 9 ' + Math.floor(Math.random() * 90000000 + 10000000),
            ord.categoria,
            ord.descripcion,
            'Dirección ' + (i + 1) + ', Santiago',
            Math.random() > 0.7 ? 'urgente' : 'normal',
            ord.estado,
            techId,
            techData.name,
            ord.precio,
            orderDate,
          ],
        )
        console.log(
          `✓ Created orden: ${ord.categoria} ($${ord.precio}) - ${ord.estado} (${techData.name} → ${clientData.name})`,
        )
        ordenIds.push(insert.rows[0].id)
      }
    }

    console.log()

    // Define solicitudes (orders without assigned technician)
    const solicitudes = [
      { categoria: 'instalación', descripcion: 'Renovación de cableado del edificio completo', precio: 280000, client: 2, urgencia: 'urgente' },
      { categoria: 'mantenimiento', descripcion: 'Inspección anual de seguridad eléctrica', precio: 55000, client: 3, urgencia: 'normal' },
      { categoria: 'reparaciones', descripcion: 'Falla en sistema de alarma', precio: 48000, client: 4, urgencia: 'urgente' },
    ]

    console.log('Creating solicitudes (unassigned orders)...')
    for (let i = 0; i < solicitudes.length; i++) {
      const sol = solicitudes[i]
      const clientEmail = clienteEmails[sol.client]
      const clientId = clientIds[clientEmail]
      const clientData = clientes[sol.client]

      // Check if solicitud exists
      let res = await pool.query(
        `SELECT id FROM orden WHERE clienteid = $1 AND categoria = $2 AND tecnicoid IS NULL LIMIT 1`,
        [clientId, sol.categoria],
      )

      if (res.rows.length) {
        console.log(`✓ Solicitud already exists: ${sol.categoria} para ${clientData.name}`)
      } else {
        const insert = await pool.query(
          `INSERT INTO orden (clienteid, clientenombre, clientetelefono, categoria, descripcion, direccion, urgencia, estado, precio, createdat, updatedat)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), now()) RETURNING id`,
          [
            clientId,
            clientData.name,
            '+56 9 ' + Math.floor(Math.random() * 90000000 + 10000000),
            sol.categoria,
            sol.descripcion,
            'Dirección ' + (ordenes.length + i + 1) + ', Santiago',
            sol.urgencia,
            'solicitud', // Mark as solicitud
            sol.precio,
          ],
        )
        console.log(`✓ Created solicitud: ${sol.categoria} ($${sol.precio}) - sin asignar`)
      }
    }

    console.log(`\n=== SEED COMPLETE ===`)
    console.log(`✓ ${Object.keys(techIds).length} technicians`)
    console.log(`✓ ${Object.keys(clientIds).length} clients`)
    console.log(`✓ ${ordenIds.length} orders`)
    console.log(`✓ ${solicitudes.length} unassigned solicitudes`)
  } catch (e) {
    console.error('Seed error', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
