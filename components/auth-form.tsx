"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  const searchParams = useSearchParams()
  const isSignUp = mode === "sign-up"
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>(defaultRole)
  const [clientType, setClientType] = useState<"particular" | "empresa">("particular")
  const [companyName, setCompanyName] = useState("")
  const [companyRut, setCompanyRut] = useState("")
  const [companyEmail, setCompanyEmail] = useState("")
  const [companyPhone, setCompanyPhone] = useState("")
  const [companyAddress, setCompanyAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationStep, setVerificationStep] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [passwordResetStep, setPasswordResetStep] = useState(false)
  const [passwordResetOtpSent, setPasswordResetOtpSent] = useState(false)
  const [passwordResetCode, setPasswordResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null)
  const pendingApproval = searchParams.get("pending") === "1"

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

  async function sendVerificationCode(emailToVerify: string) {
    setError(null)
    setVerificationMessage(null)
    setLoading(true)

    try {
      const authClientAny = authClient as any
      const { error } = await authClientAny.emailOtp.sendVerificationOtp({
        email: emailToVerify,
        type: "email-verification",
      })

      if (error) throw new Error(error.message || "No se pudo enviar el código")

      setVerificationMessage(`Se envió un nuevo código a ${emailToVerify}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al enviar el código")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode() {
    setError(null)
    setLoading(true)

    try {
      const authClientAny = authClient as any
      console.log('[auth-form] Verifying OTP', { email, otp: verificationCode })
      
      const { data, error } = await authClientAny.emailOtp.verifyEmail({
        email,
        otp: verificationCode,
      })

      console.log('[auth-form] OTP verification result', { data, error })

      if (error) {
        console.error('[auth-form] OTP verification error', error)
        throw new Error(error.message || "No se pudo verificar el código")
      }

      console.log('[auth-form] OTP verified successfully, redirecting...', { user: data?.user })
      const signedRole = ((data?.user as { role?: Role })?.role as Role) || role
      router.push(homeByRole[signedRole])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ocurrió un error al verificar el código"
      console.error('[auth-form] Error in handleVerifyCode', { error: err, message })
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    await sendVerificationCode(email)
  }

  async function handlePasswordResetRequest() {
    setError(null)
    setPasswordResetMessage(null)
    setLoading(true)

    try {
      if (!email.includes("@")) throw new Error("Email inválido")

      const authClientAny = authClient as any
      const { error } = await authClientAny.emailOtp.requestPasswordReset({ email })

      if (error) throw new Error(error.message || "No se pudo enviar el código")

      setPasswordResetOtpSent(true)
      setPasswordResetCode("")
      setPasswordResetMessage(`Se envió un código de recuperación a ${email}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al enviar el código")
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordResetSubmit() {
    setError(null)
    setPasswordResetMessage(null)
    setLoading(true)

    try {
      if (!email.includes("@")) throw new Error("Email inválido")
      if (!passwordResetCode.trim()) throw new Error("Ingresa el código recibido")
      if (newPassword.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres")

      const authClientAny = authClient as any
      const { error } = await authClientAny.emailOtp.resetPassword({
        email,
        otp: passwordResetCode,
        password: newPassword,
      })

      if (error) throw new Error(error.message || "No se pudo restablecer la contraseña")

      setPasswordResetStep(false)
      setPasswordResetOtpSent(false)
      setPasswordResetCode("")
      setNewPassword("")
      setPasswordResetMessage("Contraseña actualizada. Ya puedes iniciar sesión.")
      setPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al restablecer la contraseña")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp && verificationStep) {
        console.log('[auth-form] Submitting verification code', { email, verificationCode })
        await handleVerifyCode()
        return
      }

      if (!isSignUp && passwordResetStep) {
        if (!passwordResetOtpSent) {
          await handlePasswordResetRequest()
          return
        }

        await handlePasswordResetSubmit()
        return
      }

      // Validar en cliente primero
      if (isSignUp) {
        if (!name.trim()) throw new Error("Nombre requerido")
        if (password.length < 8) throw new Error("Contraseña mínimo 8 caracteres")
        if (clientType === "empresa") {
          if (!companyName.trim()) throw new Error("Nombre de empresa requerido")
          if (!companyRut.trim()) throw new Error("RUT de empresa requerido")
          if (!companyEmail.includes("@")) throw new Error("Email de empresa inválido")
        }
      }

      if (!email.includes("@")) throw new Error("Email inválido")
      if (!password) throw new Error("Contraseña requerida")

      if (isSignUp) {
        const signupRole: Role = role
        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
          role: signupRole,
          phone: phone || undefined,
          clientType,
          companyName: companyName || undefined,
          companyRut: companyRut || undefined,
          companyEmail: companyEmail || undefined,
          companyPhone: companyPhone || undefined,
          companyAddress: companyAddress || undefined,
        } as Parameters<typeof authClient.signUp.email>[0])

        if (error) throw new Error(error.message || "No se pudo crear la cuenta")

        setVerificationStep(true)
        setVerificationCode("")
        setVerificationMessage(`Se envi  un c digo de verificaci n a ${email}`)
        setLoading(false)
        return
      }

      const { data, error } = await authClient.signIn.email({ email, password })
      console.log('[auth-form] sign-in result', { data, error })
      if (error) {
        const message = (error.message || "").toLowerCase()
        const code = String((error as any)?.code || "").toLowerCase()
        const isUnverified =
          message.includes("not verified") ||
          message.includes("verific") ||
          message.includes("email") && message.includes("verified") ||
          code.includes("email_not_verified") ||
          code.includes("not_verified")

        if (isUnverified) {
          setVerificationStep(true)
          setVerificationCode("")
          await sendVerificationCode(email)
          return
        }

        throw new Error(error.message || "Credenciales incorrectas")
      }

      const signedRole = ((data?.user as { role?: Role })?.role as Role) || "cliente"
      const isPendingTechnician = signedRole === "tecnico" && !Boolean((data?.user as { isApproved?: boolean } | undefined)?.isApproved)
      router.push(isPendingTechnician ? `${signInHref}?pending=1` : homeByRole[signedRole])
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
            {!lockRole && !isSignUp && (
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

            {isSignUp && !verificationStep && (
              <>
                <Field label={clientType === "empresa" ? "Nombre del contacto" : "Nombre completo"}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder={clientType === "empresa" ? "Nombre del responsable" : "María González"}
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

                <div>
                  <span className="mb-1.5 block text-sm font-medium">Tipo de cliente</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "particular", label: "Particular" },
                        { id: "empresa", label: "Empresa" },
                      ] as const
                    ).map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        onClick={() => setClientType(option.id)}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
                          clientType === option.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {clientType === "empresa" && (
                  <>
                    <Field label="Nombre de la empresa">
                      <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                        placeholder="Zero Industries SpA"
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>

                    <Field label="RUT de la empresa">
                      <input
                        value={companyRut}
                        onChange={(e) => setCompanyRut(e.target.value)}
                        required
                        placeholder="76.543.210-9"
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>

                    <Field label="Email empresa">
                      <input
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        required
                        placeholder="facturas@empresa.cl"
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>

                    <Field label="Teléfono empresa (opcional)">
                      <input
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="+56 2 1234 5678"
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>

                    <Field label="Dirección empresa (opcional)">
                      <input
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        placeholder="Av. Siempre Viva 1234"
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                      />
                    </Field>
                  </>
                )}
              </>
            )}

            {verificationStep && (
              <>
                <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary-foreground">
                  <p className="font-medium">Tu cuenta aún no está verificada.</p>
                  <p className="mt-1">
                    {verificationMessage ?? `Se envió un código de verificación a ${email}. Ingrésalo abajo para continuar.`}
                  </p>
                </div>
                <Field label="Correo electrónico">
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground outline-none"
                  />
                </Field>
                <Field label="Código de verificación">
                  <input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    required
                    placeholder="123456"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                  />
                </Field>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-primary/5 disabled:opacity-50"
                  >
                    Reenviar código
                  </button>
                  {verificationMessage ? (
                    <p className="text-sm text-primary-foreground">{verificationMessage}</p>
                  ) : null}
                </div>
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

            {!isSignUp && passwordResetStep && passwordResetOtpSent && (
              <>
                <Field label="Código de recuperación">
                  <input
                    value={passwordResetCode}
                    onChange={(e) => setPasswordResetCode(e.target.value)}
                    required
                    placeholder="123456"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                  />
                </Field>

                <Field label="Nueva contraseña">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
              </>
            )}

            {!isSignUp && !passwordResetStep && (
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
            )}

            {!isSignUp && (
              <button
                type="button"
                onClick={() => {
                  setPasswordResetStep((value) => !value)
                  setPasswordResetOtpSent(false)
                  setPasswordResetCode("")
                  setNewPassword("")
                  setPasswordResetMessage(null)
                  setError(null)
                }}
                className="text-sm font-medium text-primary transition hover:text-primary/80"
              >
                {passwordResetStep ? "Volver al inicio de sesión" : "¿Olvidaste tu contraseña?"}
              </button>
            )}

            {passwordResetMessage && (
              <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                {passwordResetMessage}
              </p>
            )}

            {pendingApproval && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                Tu cuenta de técnico está pendiente de aprobación por parte del administrador.
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isSignUp ? (verificationStep ? "Verificar código" : "Crear cuenta") : passwordResetStep ? (passwordResetOtpSent ? "Restablecer contraseña" : "Enviar código") : "Ingresar"}
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
