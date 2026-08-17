import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Only available in development' },
      { status: 403 }
    )
  }

  const url = new URL(request.url)
  const email = url.searchParams.get('email')
  const verify = url.searchParams.get('verify') === 'true'

  if (!email) {
    return NextResponse.json(
      { error: 'Email parameter required' },
      { status: 400 }
    )
  }

  try {
    console.log(`🔍 [/api/debug/verify-user] Buscando: ${email}`)

    // Buscar usuario
    const users = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, email))

    if (users.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Usuario no encontrado: ${email}`,
        email,
      })
    }

    const user = users[0]

    if (verify) {
      console.log(`✅ Verificando usuario: ${email}`)
      await db
        .update(userTable)
        .set({
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, user.id))

      return NextResponse.json({
        success: true,
        message: `✅ Usuario verificado: ${email}`,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: true,
          role: user.role,
        },
      })
    }

    // Solo mostrar estado
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        role: user.role,
        clientType: (user as any).clientType,
      },
      nextStep: `?email=${encodeURIComponent(email)}&verify=true`,
    })
  } catch (error) {
    console.error('❌ Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
