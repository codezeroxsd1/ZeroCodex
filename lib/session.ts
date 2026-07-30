import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { cookies } from "next/headers"
import { UnauthorizedError, ForbiddenError } from "./errors"

export type Role = "cliente" | "tecnico" | "admin"

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  phone?: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const headerStore = await headers()
    const cookieStore = await cookies()

    const requestHeaders = new Headers(headerStore as Headers)
    const cookieHeader = cookieStore.toString()

    if (cookieHeader) {
      requestHeaders.set("cookie", cookieHeader)
    }

    const session = await auth.api.getSession({ headers: requestHeaders })
    if (!session?.user) return null

    const u = session.user as typeof session.user & { role?: string; phone?: string | null }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.role as Role) || "cliente",
      phone: u.phone ?? null,
    }
  } catch (error) {
    console.error('[Better Auth] getSessionUser error:', error)
    return null
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError("Usuario no autenticado")
  return user
}

export async function requireRole(role: Role | Role[]): Promise<SessionUser> {
  const user = await requireUser()
  const allowedRoles = Array.isArray(role) ? role : [role]
  
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(`Rol requerido: ${allowedRoles.join(" o ")}`)
  }
  
  return user
}

export async function getUserId(): Promise<string> {
  const user = await requireUser()
  return user.id
}
