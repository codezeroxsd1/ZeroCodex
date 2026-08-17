/**
 * Script para generar usuarios de prueba en desarrollo
 * Se ejecuta al iniciar el servidor en modo desarrollo
 */

import { db } from "./db"
import { user as userTable, account as accountTable } from "./db/schema"
import { eq, inArray } from "drizzle-orm"
import crypto from "crypto"
import { hashPassword as betterHashPassword } from "@better-auth/utils/password"
import { testUserEmails } from "./test-users"

const DEV_USERS = [
  {
    email: "cliente@test.com",
    name: "Cliente Test",
    password: "Test1234",
    role: "cliente" as const,
  },
  {
    email: "cliente-particular@test.com",
    name: "Juan Pérez",
    password: "Test1234",
    role: "cliente" as const,
    clientType: "particular",
    phone: "+56912345678",
  },
  {
    email: "cliente-empresa@test.com",
    name: "Empresa Test",
    password: "Test1234",
    role: "cliente" as const,
    clientType: "empresa",
    phone: "+56912345679",
    companyName: "Test Empresa Ltda.",
    companyRut: "76.123.456-7",
    companyEmail: "contacto@test-empresa.com",
    companyPhone: "+56225123456",
    companyAddress: "Av. Providencia 1234, Providencia, Santiago, Chile",
    isApproved: true,
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

export async function ensureTestUsersReady() {
  if (!testUserEmails.length) return

  try {
    const existing = await db
      .select({ id: userTable.id, email: userTable.email })
      .from(userTable)
      .where(inArray(userTable.email, testUserEmails))

    for (const existingUser of existing) {
      await db
        .update(userTable)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(userTable.id, existingUser.id))
    }
  } catch (error) {
    console.warn("No se pudo restaurar la verificación de las cuentas de prueba", error)
  }
}

export async function seedDevUsers() {
  if (process.env.NODE_ENV !== "development") {
    return
  }

  try {
    console.log("🌱 Verificando usuarios de prueba...")
    await ensureTestUsersReady()

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
          clientType: (testUser as any).clientType || "particular",
          phone: (testUser as any).phone || null,
          companyName: (testUser as any).companyName || null,
          companyRut: (testUser as any).companyRut || null,
          companyEmail: (testUser as any).companyEmail || null,
          companyPhone: (testUser as any).companyPhone || null,
          companyAddress: (testUser as any).companyAddress || null,
          isApproved: (testUser as any).isApproved ?? (testUser.role === "cliente" ? false : true),
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

        const roleLabel = (testUser as any).clientType ? `${testUser.role} ${(testUser as any).clientType}` : testUser.role
        console.log(`✅ Usuario creado: ${testUser.email} (${roleLabel})`)
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
