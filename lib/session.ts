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
  isApproved: boolean
  phone?: string | null
  clientType?: "particular" | "empresa"
  companyName?: string | null
  companyRut?: string | null
  companyEmail?: string | null
  companyPhone?: string | null
  companyAddress?: string | null
}

type AuthSessionLike = {
  user?: {
    id: string
    name: string
    email: string
    role?: string
    isApproved?: boolean
    phone?: string | null
    clientType?: string
    companyName?: string | null
    companyRut?: string | null
    companyEmail?: string | null
    companyPhone?: string | null
    companyAddress?: string | null
  }
}

function isTransientAuthError(error: unknown): boolean {
  return error instanceof Error
    ? /ECONNRESET|EPIPE|ETIMEDOUT|socket hang up|fetch failed/i.test(error.message)
    : false
}

async function getSessionFromAuth(headersValue: Headers): Promise<AuthSessionLike | null> {
  let lastError: unknown

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const session = await auth.api.getSession({ headers: headersValue })
      return session as AuthSessionLike | null
    } catch (error) {
      lastError = error
      if (attempt === 2 || !isTransientAuthError(error)) {
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  throw lastError
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const headerStore = await headers()
    const cookieStore = await cookies()

    const requestHeaders = new Headers(headerStore)
    const cookieHeader = cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ")

    if (cookieHeader) {
      requestHeaders.set("cookie", cookieHeader)
    }

    const session = await getSessionFromAuth(requestHeaders)
    if (!session?.user) return null

    const u = session.user as typeof session.user & {
      role?: string
      phone?: string | null
      clientType?: string
      companyName?: string | null
      companyRut?: string | null
      companyEmail?: string | null
      companyPhone?: string | null
      companyAddress?: string | null
    }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.role as Role) || "cliente",
      isApproved: Boolean(u.isApproved),
      phone: u.phone ?? null,
      clientType: (u.clientType as "particular" | "empresa") ?? "particular",
      companyName: u.companyName ?? null,
      companyRut: u.companyRut ?? null,
      companyEmail: u.companyEmail ?? null,
      companyPhone: u.companyPhone ?? null,
      companyAddress: u.companyAddress ?? null,
    }
  } catch (error) {
    if (!isTransientAuthError(error)) {
      console.error('[Better Auth] getSessionUser error:', error)
    }
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

export async function requireApprovedTechnician(): Promise<SessionUser> {
  const user = await requireRole("tecnico")
  if (!user.isApproved) {
    throw new ForbiddenError("Cuenta pendiente de aprobación del administrador")
  }
  return user
}

export async function getUserId(): Promise<string> {
  const user = await requireUser()
  return user.id
}
