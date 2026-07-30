import { notFound, redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { getSessionUser } from "@/lib/session"

const homeByRole = { cliente: "/cliente", tecnico: "/tecnico", admin: "/admin" } as const
const validRoles = Object.keys(homeByRole) as Array<keyof typeof homeByRole>

export default async function SignUpRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params

  if (!validRoles.includes(role as keyof typeof homeByRole)) {
    notFound()
  }

  const user = await getSessionUser()
  if (user) {
    redirect(homeByRole[user.role])
  }

  return (
    <AuthForm
      mode="sign-up"
      defaultRole={role as keyof typeof homeByRole}
      lockRole
      signInHref={`/sign-in/${role}`}
      signUpHref={`/sign-up/${role}`}
    />
  )
}
