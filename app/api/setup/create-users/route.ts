/**
 * Endpoint para crear usuarios de prueba directamente
 * GET o POST /api/setup/create-users
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { user as userTable, account as accountTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { hashPassword } from '@better-auth/utils/password'

const USERS_DATA = [
  {
    email: 'cliente@test.com',
    name: 'Cliente Test',
    password: 'Test1234',
    role: 'cliente',
    clientType: 'particular',
  },
  {
    email: 'cliente-particular@test.com',
    name: 'Juan Pérez',
    password: 'Test1234',
    role: 'cliente',
    clientType: 'particular',
    phone: '+56912345678',
  },
  {
    email: 'cliente-empresa@test.com',
    name: 'Empresa Test',
    password: 'Test1234',
    role: 'cliente',
    clientType: 'empresa',
    phone: '+56912345679',
    companyName: 'Test Empresa Ltda.',
    companyRut: '76.123.456-7',
    companyEmail: 'contacto@test-empresa.com',
    companyPhone: '+56225123456',
    companyAddress: 'Av. Providencia 1234, Providencia, Santiago, Chile',
    isApproved: true,
  },
  {
    email: 'tecnico@test.com',
    name: 'Técnico Test',
    password: 'Test1234',
    role: 'tecnico',
    clientType: 'particular',
  },
  {
    email: 'admin@test.com',
    name: 'Administrador Test',
    password: 'Test1234',
    role: 'admin',
    clientType: 'particular',
  },
]

async function createOrUpdateUser(userData: typeof USERS_DATA[0]) {
  try {
    // Verificar si existe
    const existing = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, userData.email))
      .limit(1)

    const userId = existing.length > 0 ? existing[0].id : crypto.randomUUID()
    
    // Hash la contraseña
    let hashedPassword: string
    try {
      hashedPassword = await hashPassword(userData.password)
    } catch (hashError) {
      console.error(`Error hashing password for ${userData.email}:`, hashError)
      throw new Error(`Failed to hash password: ${String(hashError)}`)
    }

    if (existing.length > 0) {
      // Actualizar
      await db
        .update(userTable)
        .set({
          emailVerified: true,
          name: userData.name,
          role: userData.role,
          clientType: userData.clientType || 'particular',
          phone: (userData as any).phone || null,
          companyName: (userData as any).companyName || null,
          companyRut: (userData as any).companyRut || null,
          companyEmail: (userData as any).companyEmail || null,
          companyPhone: (userData as any).companyPhone || null,
          companyAddress: (userData as any).companyAddress || null,
          isApproved: (userData as any).isApproved ?? (userData.role === 'cliente' ? false : true),
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId))

      // Actualizar password en account
      const accounts = await db
        .select({ id: accountTable.id })
        .from(accountTable)
        .where(eq(accountTable.userId, userId))

      if (accounts.length > 0) {
        await db
          .update(accountTable)
          .set({
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(accountTable.userId, userId))
      } else {
        await db.insert(accountTable).values({
          id: crypto.randomUUID(),
          accountId: crypto.randomUUID(),
          providerId: 'credential',
          userId,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      return { status: 'updated', email: userData.email, role: userData.role }
    } else {
      // Crear nuevo
      await db.insert(userTable).values({
        id: userId,
        email: userData.email,
        name: userData.name,
        emailVerified: true,
        role: userData.role,
        clientType: userData.clientType || 'particular',
        phone: (userData as any).phone || null,
        companyName: (userData as any).companyName || null,
        companyRut: (userData as any).companyRut || null,
        companyEmail: (userData as any).companyEmail || null,
        companyPhone: (userData as any).companyPhone || null,
        companyAddress: (userData as any).companyAddress || null,
        isApproved: (userData as any).isApproved ?? (userData.role === 'cliente' ? false : true),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await db.insert(accountTable).values({
        id: crypto.randomUUID(),
        accountId: crypto.randomUUID(),
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      return { status: 'created', email: userData.email, role: userData.role }
    }
  } catch (error) {
    console.error(`Error with ${userData.email}:`, error)
    return { status: 'error', email: userData.email, error: String(error) }
  }
}

export async function GET() {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Only available in development' },
      { status: 403 }
    )
  }

  try {
    console.log('🔧 [/api/setup/create-users] Creando usuarios de prueba...')
    const results = []

    for (const userData of USERS_DATA) {
      const result = await createOrUpdateUser(userData)
      results.push(result)
      console.log(`  ${result.status}: ${result.email}`)
    }

    return NextResponse.json({
      success: true,
      message: '✅ Usuarios creados exitosamente',
      count: results.length,
      results,
      nextSteps: [
        '1. Entra a http://localhost:3000/sign-in/cliente',
        '2. Email: cliente-particular@test.com',
        '3. Contraseña: Test1234',
      ],
    })
  } catch (error) {
    console.error('❌ Error creating users:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: 'Error al crear usuarios',
      },
      { status: 500 }
    )
  }
}

// POST también funciona
export const POST = GET
