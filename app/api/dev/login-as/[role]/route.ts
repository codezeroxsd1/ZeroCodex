/**
 * SOLO PARA DESARROLLO: Crear sesión de prueba para testing rápido
 * GET /api/dev/login-as/[role]
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Solo disponible en desarrollo" },
      { status: 404 }
    )
  }

  try {
    const { role } = await params

    if (!["cliente", "tecnico", "admin"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
    }

    // Redirigir a la página del rol
    const roleUrls = {
      cliente: "/cliente",
      tecnico: "/tecnico",
      admin: "/admin",
    }

    const response = NextResponse.redirect(
      new URL(roleUrls[role as keyof typeof roleUrls], req.url),
      302
    )

    // Agregar cookie especial para development
    const cookieStore = await cookies()
    cookieStore.set("x-dev-role", role, {
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Error en dev login:", error)
    return NextResponse.json(
      { error: "Error iniciando sesión de prueba" },
      { status: 500 }
    )
  }
}
