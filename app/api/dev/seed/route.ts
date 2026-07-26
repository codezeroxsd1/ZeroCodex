/**
 * SOLO PARA DESARROLLO: Inicializar BD con usuarios de prueba
 * GET /api/dev/seed
 */

import { seedDevUsers } from "@/lib/seed-dev-users"
import { NextResponse } from "next/server"

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    )
  }

  try {
    await seedDevUsers()
    return NextResponse.json({
      success: true,
      message: "Usuarios de prueba inicializados",
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json(
      { error: "Error inicializando usuarios" },
      { status: 500 }
    )
  }
}
