import { notFound, redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { getSessionUser } from "@/lib/session"

const homeByRole = { cliente: "/cliente", tecnico: "/tecnico", admin: "/admin" } as const
const validRoles = Object.keys(homeByRole) as Array<keyof typeof homeByRole>

function PendingApprovalUI() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-[26rem]">
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight">Cuenta Pendiente</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Tu cuenta de técnico está pendiente de aprobación por parte del administrador. 
            Por favor, espera a que el equipo de Zero Industries valide tu información.
          </p>
          <div className="mt-6">
            <a 
              href="/" 
              className="inline-block w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              Volver al inicio
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function SignInRolePage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ role: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role } = await params
  const resolvedSearchParams = await searchParams
  const pending = resolvedSearchParams?.pending as string | undefined

  if (!validRoles.includes(role as keyof typeof homeByRole)) {
    notFound()
  }

  const user = await getSessionUser()
  
  if (user) {
    if (user.role === "tecnico" && !user.isApproved && pending === "1") {
      return <PendingApprovalUI />
    }
    redirect(homeByRole[user.role])
  }

  return (
    <AuthForm
      mode="sign-in"
      defaultRole={role as keyof typeof homeByRole}
      lockRole
      signInHref={`/sign-in/${role}`}
      signUpHref={`/sign-up/${role}`}
    />
  )
}
