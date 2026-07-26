import { NextRequest, NextResponse } from "next/server"
import { db } from "../../../../lib/db"
import { orden, user } from "../../../../lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action = "create" } = body

    if (action === "create") {
      const [client] = await db.select().from(user).where(eq(user.email, "cliente@test.com")).limit(1)
      const [tech] = await db.select().from(user).where(eq(user.email, "tecnico@test.com")).limit(1)

      if (!client || !tech) {
        return NextResponse.json({ error: "No se encontraron usuarios de prueba" }, { status: 404 })
      }

      const [newOrder] = await db.insert(orden).values({
        clienteId: client.id,
        clienteNombre: client.name || client.email,
        clienteTelefono: client.phone || "",
        categoria: "Revisión completa",
        descripcion: "Prueba de flujo end to end",
        direccion: "Dirección de prueba",
        urgencia: "normal",
        estado: "pendiente",
        precio: 150,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning({ id: orden.id })

      return NextResponse.json({ success: true, order: newOrder })
    }

    if (action === "assign") {
      const { orderId } = body
      const [tech] = await db.select().from(user).where(eq(user.email, "tecnico@test.com")).limit(1)
      if (!tech) return NextResponse.json({ error: "Tecnico no encontrado" }, { status: 404 })

      const [updated] = await db.update(orden)
        .set({ tecnicoId: tech.id, tecnicoNombre: tech.name || tech.email, estado: "en progreso", updatedAt: new Date() })
        .where(eq(orden.id, Number(orderId)))
        .returning({ id: orden.id, estado: orden.estado, tecnicoId: orden.tecnicoId, tecnicoNombre: orden.tecnicoNombre })

      return NextResponse.json({ success: true, order: updated })
    }

    if (action === "complete") {
      const { orderId } = body
      const [updated] = await db.update(orden)
        .set({ estado: "finalizado", updatedAt: new Date() })
        .where(eq(orden.id, Number(orderId)))
        .returning({ id: orden.id, estado: orden.estado })

      return NextResponse.json({ success: true, order: updated })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (error) {
    console.error("test-flow error", error)
    return NextResponse.json({ error: "Error en flujo de prueba" }, { status: 500 })
  }
}
