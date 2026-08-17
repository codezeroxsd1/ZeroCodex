#!/usr/bin/env node

/**
 * Script para crear usuarios de prueba
 * Uso: node scripts/create-test-users.mjs
 */

import { Pool } from 'pg'
import crypto from 'crypto'
import { hashPassword } from '@better-auth/utils/password'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

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

async function createTestUsers() {
  console.log('\n🌱 Creando usuarios de prueba...\n')

  try {
    for (const testUser of TEST_USERS) {
      try {
        // Verificar si existe
        const existingResult = await pool.query(
          'SELECT id FROM "user" WHERE email = $1',
          [testUser.email]
        )

        const userId = existingResult.rows.length > 0 
          ? existingResult.rows[0].id 
          : crypto.randomUUID()

        if (existingResult.rows.length > 0) {
          // Actualizar
          await pool.query(
            `UPDATE "user" SET 
              "emailVerified" = true,
              "name" = $1,
              "role" = $2,
              "clientType" = $3,
              "phone" = $4,
              "companyName" = $5,
              "companyRut" = $6,
              "companyEmail" = $7,
              "companyPhone" = $8,
              "companyAddress" = $9,
              "isApproved" = $10,
              "updatedAt" = NOW()
            WHERE id = $11`,
            [
              testUser.name,
              testUser.role,
              testUser.clientType || 'particular',
              testUser.phone || null,
              testUser.companyName || null,
              testUser.companyRut || null,
              testUser.companyEmail || null,
              testUser.companyPhone || null,
              testUser.companyAddress || null,
              testUser.isApproved ?? (testUser.role === 'cliente' ? false : true),
              userId,
            ]
          )

          // Actualizar account
          const hashedPassword = await hashPassword(testUser.password)
          const accountExists = await pool.query(
            'SELECT id FROM account WHERE "userId" = $1',
            [userId]
          )

          if (accountExists.rows.length > 0) {
            await pool.query(
              'UPDATE account SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2',
              [hashedPassword, userId]
            )
          } else {
            await pool.query(
              `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
              [
                crypto.randomUUID(),
                crypto.randomUUID(),
                'credential',
                userId,
                hashedPassword,
              ]
            )
          }

          console.log(`✅ ${testUser.email} - Actualizado`)
        } else {
          // Crear nuevo
          await pool.query(
            `INSERT INTO "user" 
              (id, email, name, "emailVerified", role, "clientType", phone, 
               "companyName", "companyRut", "companyEmail", "companyPhone", 
               "companyAddress", "isApproved", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
            [
              userId,
              testUser.email,
              testUser.name,
              testUser.role,
              testUser.clientType || 'particular',
              testUser.phone || null,
              testUser.companyName || null,
              testUser.companyRut || null,
              testUser.companyEmail || null,
              testUser.companyPhone || null,
              testUser.companyAddress || null,
              testUser.isApproved ?? (testUser.role === 'cliente' ? false : true),
            ]
          )

          // Crear account
          const hashedPassword = await hashPassword(testUser.password)
          await pool.query(
            `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              crypto.randomUUID(),
              crypto.randomUUID(),
              'credential',
              userId,
              hashedPassword,
            ]
          )

          console.log(`✅ ${testUser.email} - Creado`)
        }
      } catch (error) {
        console.error(`❌ ${testUser.email} - Error:`, error.message)
      }
    }

    console.log('\n✅ Usuarios de prueba listos\n')
    console.log('📋 Credenciales:')
    console.log('   Email: cliente-particular@test.com')
    console.log('   Contraseña: Test1234')
    console.log('')
    console.log('   Email: cliente-empresa@test.com')
    console.log('   Contraseña: Test1234\n')
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await pool.end()
  }
}

createTestUsers()
