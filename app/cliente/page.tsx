import { redirect } from 'next/navigation'
import { ClienteApp } from '@/components/cliente/cliente-app'
import { getSessionUser } from '@/lib/session'

const homeByRole = {
  cliente: '/cliente',
  tecnico: '/tecnico',
  admin: '/admin',
} as const

export default async function ClientePage() {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    redirect('/sign-in/cliente')
  }

  if (sessionUser.role !== 'cliente') {
    redirect(homeByRole[sessionUser.role])
  }

  return (
    <div className="min-h-screen bg-background">
      <ClienteApp />
    </div>
  )
}
