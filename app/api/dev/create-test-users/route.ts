/**
 * SOLO PARA DESARROLLO: Endpoint para crear/resetear usuarios de prueba
 * GET /api/dev/create-test-users
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { user as userTable, account as accountTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { hashPassword } from '@better-auth/utils/password'

const TEST_USERS = [
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

export async function GET(req: Request) {
  // Solo en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Only available in development' },
      { status: 403 }
    )
  }

  try {
    const results = []

    for (const testUser of TEST_USERS) {
      try {
        // Verificar si existe
        const existing = await db
          .select()
          .from(userTable)
          .where(eq(userTable.email, testUser.email))
          .limit(1)

        if (existing.length > 0) {
          // Actualizar usuario existente
          const uid = existing[0].id
          await db
            .update(userTable)
            .set({
              emailVerified: true,
              name: testUser.name,
              role: testUser.role,
              clientType: testUser.clientType || 'particular',
              phone: (testUser as any).phone || null,
              companyName: (testUser as any).companyName || null,
              companyRut: (testUser as any).companyRut || null,
              companyEmail: (testUser as any).companyEmail || null,
              companyPhone: (testUser as any).companyPhone || null,
              companyAddress: (testUser as any).companyAddress || null,
              isApproved: (testUser as any).isApproved ?? (testUser.role === 'cliente' ? false : true),
              updatedAt: new Date(),
            })
            .where(eq(userTable.id, uid))

          // Actualizar o crear account
          const accounts = await db
            .select()
            .from(accountTable)
            .where(eq(accountTable.userId, uid))

          const hashedPassword = await hashPassword(testUser.password)

          if (accounts.length > 0) {
            await db
              .update(accountTable)
              .set({
                password: hashedPassword,
                updatedAt: new Date(),
              })
              .where(eq(accountTable.userId, uid))
          } else {
            await db.insert(accountTable).values({
              id: crypto.randomUUID(),
              accountId: crypto.randomUUID(),
              providerId: 'credential',
              userId: uid,
              password: hashedPassword,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }

          results.push({
            email: testUser.email,
            status: '✅ Updated',
            role: testUser.role,
            type: (testUser as any).clientType,
          })
        } else {
          // Crear nuevo usuario
          const userId = crypto.randomUUID()

          await db.insert(userTable).values({
            id: userId,
            email: testUser.email,
            name: testUser.name,
            emailVerified: true,
            role: testUser.role,
            clientType: testUser.clientType || 'particular',
            phone: (testUser as any).phone || null,
            companyName: (testUser as any).companyName || null,
            companyRut: (testUser as any).companyRut || null,
            companyEmail: (testUser as any).companyEmail || null,
            companyPhone: (testUser as any).companyPhone || null,
            companyAddress: (testUser as any).companyAddress || null,
            isApproved: (testUser as any).isApproved ?? (testUser.role === 'cliente' ? false : true),
            createdAt: new Date(),
            updatedAt: new Date(),
          })

          // Crear account con credenciales
          const hashedPassword = await hashPassword(testUser.password)
          await db.insert(accountTable).values({
            id: crypto.randomUUID(),
            accountId: crypto.randomUUID(),
            providerId: 'credential',
            userId: userId,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
          })

          results.push({
            email: testUser.email,
            status: '✅ Created',
            role: testUser.role,
            type: (testUser as any).clientType,
          })
        }
      } catch (error) {
        results.push({
          email: testUser.email,
          status: '❌ Error',
          error: String(error),
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Test users initialized successfully',
      results,
    })
  } catch (error) {
    console.error('Error creating test users:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
