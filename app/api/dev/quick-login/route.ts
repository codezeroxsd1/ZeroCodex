/**
 * SOLO PARA DESARROLLO: Permite crear sesiones de prueba sin contraseña
 * Eliminar en producción
 */

import { NextRequest, NextResponse } from "next/server"

// Solo en desarrollo
if (process.env.NODE_ENV !== "development") {
  throw new Error("Esta ruta solo está disponible en desarrollo")
}

export async function POST(req: NextRequest) {
  try {
    const { email, role } = await req.json()

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email y rol requeridos" },
        { status: 400 }
      )
    }

    const validRoles = ["cliente", "tecnico", "admin"]
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Rol inválido" },
        { status: 400 }
      )
    }

    // Para desarrollo: redirigir directamente
    const roleUrls = {
      cliente: "/cliente",
      tecnico: "/tecnico",
      admin: "/admin",
    }

    return NextResponse.json({
      success: true,
      redirectUrl: roleUrls[role as "cliente" | "tecnico" | "admin"],
    })
  } catch (error) {
    console.error("Error en quick-login:", error)
    return NextResponse.json(
      { error: "Error al iniciar sesión de prueba" },
      { status: 500 }
    )
  }
}
