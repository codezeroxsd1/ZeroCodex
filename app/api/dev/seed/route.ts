/**
 * SOLO PARA DESARROLLO: Inicializar BD con usuarios de prueba
 * GET /api/dev/seed
 */

import { seedDevUsers } from "@/lib/seed-dev-users"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    )
  }

  try {
    console.log("🌱 Ejecutando seedDevUsers desde endpoint...")
    await seedDevUsers()
    
    return NextResponse.json({
      success: true,
      message: "✅ Usuarios de prueba inicializados correctamente",
      info: "Credenciales: cliente-particular@test.com / Test1234",
    })
  } catch (error) {
    console.error("❌ Error en /api/dev/seed:", error)
    return NextResponse.json(
      { 
        success: false,
        error: String(error),
        message: "Error inicializando usuarios"
      },
      { status: 500 }
    )
  }
}
