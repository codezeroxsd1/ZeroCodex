"use server"

import { db } from "@/lib/db"
import { orden } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { requireUser, requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { crearOrdenSchema, actualizarOrdenSchema } from "@/lib/validations"
import { ValidationError, handleError, ForbiddenError } from "@/lib/errors"

export type EstadoOrden = "Pendiente" | "En camino" | "En proceso" | "Finalizado"

// Cliente: crear una orden
export async function crearOrden(data: unknown) {
  try {
    const user = await requireUser()
    
    // Validar datos
    const validatedData = crearOrdenSchema.parse(data)
    
    const [row] = await db
      .insert(orden)
      .values({
        clienteId: user.id,
        clienteNombre: user.name,
        clienteTelefono: user.phone ?? null,
        categoria: validatedData.categoria,
        descripcion: validatedData.descripcion,
        direccion: validatedData.direccion,
        urgencia: validatedData.urgencia ?? "normal",
        estado: "pendiente",
        precio: null,
      })
      .returning()
    
    revalidatePath("/cliente")
    revalidatePath("/tecnico")
    revalidatePath("/admin")
    
    return { success: true, data: row }
  } catch (error) {
    return handleError(error)
  }
}

// Cliente: mis órdenes (scoped por clienteId)
export async function getMisOrdenes() {
  try {
    const user = await requireUser()
    const ordenes = await db
      .select()
      .from(orden)
      .where(eq(orden.clienteId, user.id))
      .orderBy(desc(orden.createdAt))
    
    return { success: true, data: ordenes }
  } catch (error) {
    return handleError(error)
  }
}

// Técnico / Admin: todas las órdenes
export async function getTodasOrdenes() {
  try {
    const user = await requireRole(["tecnico", "admin"])
    const ordenes = await db
      .select()
      .from(orden)
      .orderBy(desc(orden.createdAt))
    
    return { success: true, data: ordenes }
  } catch (error) {
    return handleError(error)
  }
}

// Técnico: tomar una orden pendiente
export async function tomarOrden(id: number) {
  try {
    const user = await requireRole(["tecnico", "admin"])
    
    // Verificar que la orden existe y está pendiente
    const [existingOrden] = await db
      .select()
      .from(orden)
      .where(eq(orden.id, id))
    
    if (!existingOrden) {
      throw new ValidationError("Orden no encontrada")
    }
    
    if (existingOrden.estado !== "pendiente") {
      throw new ValidationError("Solo se pueden tomar órdenes pendientes")
    }
    
    await db
      .update(orden)
      .set({
        tecnicoId: user.id,
        tecnicoNombre: user.name,
        estado: "en camino",
        updatedAt: new Date(),
      })
      .where(eq(orden.id, id))
    
    revalidatePath("/tecnico")
    revalidatePath("/cliente")
    revalidatePath("/admin")
    
    return { success: true }
  } catch (error) {
    return handleError(error)
  }
}

// Técnico: cambiar estado
export async function actualizarEstado(id: number, estado: string) {
  try {
    const user = await requireRole(["tecnico", "admin"])
    
    const estadosValidos = ["pendiente", "en camino", "en proceso", "finalizado"]
    if (!estadosValidos.includes(estado)) {
      throw new ValidationError(`Estado inválido. Debe ser uno de: ${estadosValidos.join(", ")}`)
    }
    
    // Verificar que es su orden o es admin
    const [existingOrden] = await db
      .select()
      .from(orden)
      .where(eq(orden.id, id))
    
    if (!existingOrden) {
      throw new ValidationError("Orden no encontrada")
    }
    
    if (user.role === "tecnico" && existingOrden.tecnicoId !== user.id) {
      throw new ForbiddenError("No puedes actualizar una orden que no es tuya")
    }
    
    await db
      .update(orden)
      .set({ estado, updatedAt: new Date() })
      .where(eq(orden.id, id))
    
    revalidatePath("/tecnico")
    revalidatePath("/cliente")
    revalidatePath("/admin")
    
    return { success: true }
  } catch (error) {
    return handleError(error)
  }
}

// Técnico: finalizar con precio y notas
export async function finalizarOrden(id: number, precio: number, notasTecnico?: string) {
  try {
    const user = await requireRole(["tecnico", "admin"])
    
    if (precio < 0) {
      throw new ValidationError("El precio no puede ser negativo")
    }
    
    // Verificar que es su orden o es admin
    const [existingOrden] = await db
      .select()
      .from(orden)
      .where(eq(orden.id, id))
    
    if (!existingOrden) {
      throw new ValidationError("Orden no encontrada")
    }
    
    if (user.role === "tecnico" && existingOrden.tecnicoId !== user.id) {
      throw new ForbiddenError("No puedes finalizar una orden que no es tuya")
    }
    
    await db
      .update(orden)
      .set({
        estado: "finalizado",
        precio,
        notasTecnico: notasTecnico ?? null,
        updatedAt: new Date(),
      })
      .where(eq(orden.id, id))
    
    revalidatePath("/tecnico")
    revalidatePath("/cliente")
    revalidatePath("/admin")
    
    return { success: true }
  } catch (error) {
    return handleError(error)
  }
}
