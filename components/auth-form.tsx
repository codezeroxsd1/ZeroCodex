"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Logo } from "@/components/brand/logo"
import { User, HardHat, LayoutDashboard, Loader2, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

type Role = "cliente" | "tecnico" | "admin"

const roles: { id: Role; label: string; icon: typeof User }[] = [
  { id: "cliente", label: "Cliente", icon: User },
  { id: "tecnico", label: "Técnico", icon: HardHat },
  { id: "admin", label: "Admin", icon: LayoutDashboard },
]

const homeByRole: Record<Role, string> = {
  cliente: "/cliente",
  tecnico: "/tecnico",
  admin: "/admin",
}

export function AuthForm({
  mode,
  defaultRole = "cliente",
  lockRole = false,
  signInHref = "/sign-in/cliente",
  signUpHref = "/sign-up/cliente",
}: {
  mode: "sign-in" | "sign-up"
  defaultRole?: Role
  lockRole?: boolean
  signInHref?: string
  signUpHref?: string
}) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>(defaultRole)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRole(defaultRole)
  }, [defaultRole])

  async function handleGoogleSignIn() {
    setError(null)

    if (!googleEnabled) {
      setError("Google no está configurado en este entorno. Agrega las credenciales de OAuth para habilitarlo.")
      return
    }

    setLoading(true)

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${signInHref}?role=${role}`,
      } as any)

      if (result?.error) {
        throw new Error(result.error.message || "No se pudo iniciar sesión con Google")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión con Google")
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    
    try {
      // Validar en cliente primero
      if (isSignUp) {
        if (!name.trim()) throw new Error("Nombre requerido")
        if (password.length < 8) throw new Error("Contraseña mínimo 8 caracteres")
      }
      
      if (!email.includes("@")) throw new Error("Email inválido")
      if (!password) throw new Error("Contraseña requerida")
      
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
          role,
          phone: phone || undefined,
        } as Parameters<typeof authClient.signUp.email>[0])
        
        if (error) throw new Error(error.message || "No se pudo crear la cuenta")
        router.push(homeByRole[role])
      } else {
        const { data, error } = await authClient.signIn.email({ email, password })
        if (error) throw new Error(error.message || "Credenciales incorrectas")
        
        const signedRole = ((data?.user as { role?: Role })?.role as Role) || "cliente"
        router.push(homeByRole[signedRole])
      }
      
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8 sm:px-5 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
      />
      <div className="relative z-10 w-full max-w-[26rem]">
        <div className="mb-8 flex justify-center">
          <Logo size={44} withText />
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignUp ? "Regístrate para gestionar tus servicios." : "Accede a tu panel de Zero Industries."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!lockRole && (
              <div>
                <span className="mb-1.5 block text-sm font-medium">Tipo de cuenta</span>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium transition-colors",
                        role === r.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <r.icon className="size-5" />
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSignUp && (
              <>
                <Field label="Nombre completo">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="María González"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                  />
                </Field>

                <Field label="Teléfono (opcional)">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
              </>
            )}

            <Field label="Correo electrónico">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@correo.cl"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
              />
            </Field>

            <Field label="Contraseña">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
              />
            </Field>

            {error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isSignUp ? "Crear cuenta" : "Ingresar"}
            </button>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || !googleEnabled}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background py-3 text-sm font-semibold text-foreground transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              <Globe className="size-4" />
              {googleEnabled ? "Continuar con Google" : "Google no disponible"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isSignUp ? (
              <>
                ¿Ya tienes cuenta?{" "}
                <Link href={signInHref} className="font-semibold text-primary">
                  Inicia sesión
                </Link>
              </>
            ) : (
              <>
                ¿No tienes cuenta?{" "}
                <Link href={signUpHref} className="font-semibold text-primary">
                  Regístrate
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}
