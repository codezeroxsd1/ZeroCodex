import { requireRole } from '@/lib/session'
import { pool } from '@/lib/db'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireRole('admin')

  // Try DB first
  try {
    const client = await pool.connect()
    try {
      const res = await client.query('SELECT id, name, email, phone, order_id as "orderId", role, message, created_at as "createdAt" FROM escalations ORDER BY created_at DESC LIMIT 200')
      const items = res.rows
      return (
        <div className="p-6">
          <h1 className="text-2xl font-semibold">Escalaciones</h1>
          <div className="mt-4">
            {items.length === 0 ? (
              <p>No hay escalaciones.</p>
            ) : (
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Order</th>
                    <th>Rol</th>
                    <th>Mensaje</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={it.id} className="border-t">
                      <td className="px-2 py-1">{it.id}</td>
                      <td className="px-2 py-1">{it.name}</td>
                      <td className="px-2 py-1">{it.email}</td>
                      <td className="px-2 py-1">{it.phone}</td>
                      <td className="px-2 py-1">{it.orderId}</td>
                      <td className="px-2 py-1">{it.role}</td>
                      <td className="px-2 py-1">{it.message}</td>
                      <td className="px-2 py-1">{new Date(it.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )
    } finally {
      client.release()
    }
  } catch (dbErr) {
    // Fallback to file
    const file = path.join(process.cwd(), 'app', 'data', 'escalations.jsonl')
    try {
      const raw = await fs.readFile(file, 'utf-8')
      const items = raw
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
        .reverse()
        .slice(0, 200)
      return (
        <div className="p-6">
          <h1 className="text-2xl font-semibold">Escalaciones (archivo)</h1>
          <div className="mt-4">
            {items.length === 0 ? (
              <p>No hay escalaciones.</p>
            ) : (
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{new Date(it.createdAt).toLocaleString()}</td>
                      <td className="px-2 py-1">{it.name}</td>
                      <td className="px-2 py-1">{it.email}</td>
                      <td className="px-2 py-1">{it.phone}</td>
                      <td className="px-2 py-1">{it.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )
    } catch (fileErr) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-semibold">Escalaciones</h1>
          <p className="mt-4">No se pudieron leer las escalaciones.</p>
        </div>
      )
    }
  }
}
