#!/usr/bin/env node

import { db } from '../lib/db/index'
import { user as userTable } from '../lib/db/schema'
import { eq } from 'drizzle-orm'

const email = process.argv[2] || 'cliente123.demo@zero.local'

async function verifyUser() {
  try {
    console.log(`🔍 Buscando usuario: ${email}`)

    const users = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, email))

    if (users.length === 0) {
      console.log(`❌ Usuario no encontrado: ${email}`)
      process.exit(1)
    }

    const user = users[0]
    console.log(`✅ Usuario encontrado:`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.name}`)
    console.log(`   Verified: ${user.emailVerified}`)
    console.log(`   Role: ${(user as any).role}`)

    if (!user.emailVerified) {
      console.log(`\n🔄 Verificando cuenta...`)
      await db
        .update(userTable)
        .set({
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, user.id))

      console.log(`✅ ¡Cuenta verificada exitosamente!`)
    } else {
      console.log(`✅ La cuenta ya estaba verificada`)
    }

    process.exit(0)
  } catch (error) {
    console.error(`❌ Error:`, error)
    process.exit(1)
  }
}

verifyUser()
