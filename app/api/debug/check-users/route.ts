import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { user as userTable, account as accountTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Only available in development' },
      { status: 403 }
    )
  }

  try {
    console.log('🔍 [/api/debug/check-users] Verificando usuarios en BD...')

    // Obtener todos los usuarios
    const allUsers = await db.select().from(userTable)
    console.log(`📊 Total de usuarios en BD: ${allUsers.length}`)

    // Obtener cuentas
    const allAccounts = await db
      .select()
      .from(accountTable)

    console.log(`📊 Total de cuentas en BD: ${allAccounts.length}`)

    // Detalles por usuario
    const userDetails = await Promise.all(
      allUsers.map(async (u) => {
        const accounts = await db
          .select()
          .from(accountTable)
          .where(eq(accountTable.userId, u.id))

        return {
          userId: u.id,
          email: u.email,
          name: u.name,
          emailVerified: u.emailVerified,
          role: u.role,
          clientType: u.clientType,
          accountCount: accounts.length,
          hasPasswordAccount: accounts.some((a) => a.providerId === 'credential'),
          accounts: accounts.map((a) => ({
            providerId: a.providerId,
            hasPassword: !!a.password,
            passwordLength: a.password?.length || 0,
          })),
        }
      })
    )

    return NextResponse.json({
      success: true,
      summary: {
        totalUsers: allUsers.length,
        totalAccounts: allAccounts.length,
      },
      users: userDetails,
      testAccounts: {
        'cliente-particular@test.com': allUsers.find((u) => u.email === 'cliente-particular@test.com')
          ? '✅ EXISTS'
          : '❌ NOT FOUND',
        'cliente-empresa@test.com': allUsers.find((u) => u.email === 'cliente-empresa@test.com')
          ? '✅ EXISTS'
          : '❌ NOT FOUND',
      },
    })
  } catch (error) {
    console.error('❌ Error checking users:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
