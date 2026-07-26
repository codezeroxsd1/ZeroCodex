/**
 * Script para generar usuarios de prueba en desarrollo
 * Se ejecuta al iniciar el servidor en modo desarrollo
 */

import { db } from "./db"
import { user as userTable, account as accountTable } from "./db/schema"
import { eq, and } from "drizzle-orm"
import crypto from "crypto"
import { hashPassword as betterHashPassword } from "@better-auth/utils/password"

const DEV_USERS = [
  {
    email: "cliente@test.com",
    name: "Cliente Test",
    password: "Test1234",
    role: "cliente" as const,
  },
  {
    email: "tecnico@test.com",
    name: "Técnico Test",
    password: "Test1234",
    role: "tecnico" as const,
  },
  {
    email: "admin@test.com",
    name: "Administrador Test",
    password: "Test1234",
    role: "admin" as const,
  },
]

export async function seedDevUsers() {
  if (process.env.NODE_ENV !== "development") {
    return
  }

  try {
    console.log("🌱 Verificando usuarios de prueba...")

    for (const testUser of DEV_USERS) {
      const existing = await db
        .select()
        .from(userTable)
        .where(eq(userTable.email, testUser.email))
        .limit(1)

      if (existing.length === 0) {
        // Crear usuario
        const userId = crypto.randomUUID()
        
        await db.insert(userTable).values({
          id: userId,
          email: testUser.email,
          name: testUser.name,
          emailVerified: true,
          role: testUser.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // Crear cuenta con contraseña (usar el mismo esquema que better-auth)
        const hashed = await betterHashPassword(testUser.password)
        await db.insert(accountTable).values({
          id: crypto.randomUUID(),
          accountId: crypto.randomUUID(),
          providerId: "credential",
          userId: userId,
          accessToken: null,
          refreshToken: null,
          idToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: null,
          password: hashed,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        console.log(`✅ Usuario creado: ${testUser.email} (${testUser.role})`)
      } else {
          console.log(`✓ Usuario ya existe: ${testUser.email}`)
          // Asegurar que la cuenta de credenciales exista y tenga la contraseña correcta
          const uid = existing[0].id
          const existingAccounts = await db
            .select()
            .from(accountTable)
            .where(eq(accountTable.userId, uid))

          const hashed = await betterHashPassword(testUser.password)

          if (existingAccounts.length === 0) {
            await db.insert(accountTable).values({
              id: crypto.randomUUID(),
              accountId: crypto.randomUUID(),
              providerId: "credential",
              userId: uid,
              password: hashed,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            console.log(`✅ Cuenta credential creada para: ${testUser.email}`)
          } else {
            await db
              .update(accountTable)
              .set({ password: hashed, updatedAt: new Date() })
              .where(eq(accountTable.userId, uid))
            console.log(`🔁 Contraseña actualizada para: ${testUser.email}`)
          }
      }
    }

    console.log("✅ Usuarios de prueba listos")
  } catch (error) {
    console.error("❌ Error seeding usuarios:", error)
    throw error
  }
}
