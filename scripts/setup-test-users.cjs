#!/usr/bin/env node

/**
 * Script simple para crear usuarios de prueba usando Drizzle
 * Uso: node scripts/setup-test-users.cjs
 */

const crypto = require('crypto')

async function setup() {
  console.log('\n🔧 Configurando usuarios de prueba...\n')

  try {
    // Importar módulos dinámicamente
    const { db } = await import('../lib/db.js')
    const { user: userTable, account: accountTable } = await import('../lib/db/schema.js')
    const { hashPassword } = await import('@better-auth/utils/password')
    const { eq } = await import('drizzle-orm')

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

    for (const testUser of TEST_USERS) {
      try {
        const existing = await db
          .select({ id: userTable.id })
          .from(userTable)
          .where(eq(userTable.email, testUser.email))
          .limit(1)

        const userId = existing.length > 0 ? existing[0].id : crypto.randomUUID()

        if (existing.length > 0) {
          await db
            .update(userTable)
            .set({
              emailVerified: true,
              name: testUser.name,
              role: testUser.role,
              clientType: testUser.clientType || 'particular',
              phone: testUser.phone || null,
              companyName: testUser.companyName || null,
              companyRut: testUser.companyRut || null,
              companyEmail: testUser.companyEmail || null,
              companyPhone: testUser.companyPhone || null,
              companyAddress: testUser.companyAddress || null,
              isApproved: testUser.isApproved ?? (testUser.role === 'cliente' ? false : true),
              updatedAt: new Date(),
            })
            .where(eq(userTable.id, userId))

          const accounts = await db
            .select()
            .from(accountTable)
            .where(eq(accountTable.userId, userId))

          const hashed = await hashPassword(testUser.password)

          if (accounts.length > 0) {
            await db
              .update(accountTable)
              .set({
                password: hashed,
                updatedAt: new Date(),
              })
              .where(eq(accountTable.userId, userId))
          } else {
            await db.insert(accountTable).values({
              id: crypto.randomUUID(),
              accountId: crypto.randomUUID(),
              providerId: 'credential',
              userId: userId,
              password: hashed,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }

          console.log(`✅ ${testUser.email} - Actualizado`)
        } else {
          await db.insert(userTable).values({
            id: userId,
            email: testUser.email,
            name: testUser.name,
            emailVerified: true,
            role: testUser.role,
            clientType: testUser.clientType || 'particular',
            phone: testUser.phone || null,
            companyName: testUser.companyName || null,
            companyRut: testUser.companyRut || null,
            companyEmail: testUser.companyEmail || null,
            companyPhone: testUser.companyPhone || null,
            companyAddress: testUser.companyAddress || null,
            isApproved: testUser.isApproved ?? (testUser.role === 'cliente' ? false : true),
            createdAt: new Date(),
            updatedAt: new Date(),
          })

          const hashed = await hashPassword(testUser.password)
          await db.insert(accountTable).values({
            id: crypto.randomUUID(),
            accountId: crypto.randomUUID(),
            providerId: 'credential',
            userId: userId,
            password: hashed,
            createdAt: new Date(),
            updatedAt: new Date(),
          })

          console.log(`✅ ${testUser.email} - Creado`)
        }
      } catch (error) {
        console.error(`❌ ${testUser.email}:`, error.message)
      }
    }

    console.log('\n✅ Usuarios listos!\n')
    console.log('📋 Prueba con:')
    console.log('   Email: cliente-particular@test.com')
    console.log('   Pass: Test1234\n')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

setup()
