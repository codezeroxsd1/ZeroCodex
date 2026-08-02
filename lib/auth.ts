import nodemailer from "nodemailer"
import { betterAuth } from "better-auth"
import { emailOTP } from "better-auth/plugins/email-otp"
import { nextCookies } from "better-auth/next-js"
import { Pool } from "pg"
import { ensureTestUsersReady } from "./seed-dev-users"

// Construcción segura de base URL
const baseURL = (() => {
  // Prioridad en environment variables
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL

  // En producción, usar VERCEL_PROJECT_PRODUCTION_URL
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // Fallback a VERCEL_URL en preview
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // Development fallback
  if (process.env.V0_RUNTIME_URL) {
    return process.env.V0_RUNTIME_URL
  }

  // Default localhost
  return "http://localhost:3000"
})()

const trustedOrigins = [
  baseURL,
  process.env.RENDER_EXTERNAL_URL,
  process.env.V0_RUNTIME_URL,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
].filter((url) => url && typeof url === "string") as string[]

const authSecret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-change-me"

function normalizeDatabaseUrl(url: string | undefined) {
  if (!url) return undefined

  const hasSslMode = /(?:^|[?&])sslmode=/.test(url)
  const hasLibpqCompat = /(?:^|[?&])uselibpqcompat=/.test(url)

  if (hasLibpqCompat) return url

  if (hasSslMode) {
    return url.replace(/([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/i, '$1sslmode=verify-full')
  }

  return `${url}${url.includes('?') ? '&' : '?'}sslmode=verify-full`
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)

void ensureTestUsersReady().catch((error) => {
  console.warn("No se pudo restaurar la verificación de cuentas de prueba", error)
})

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  secret: authSecret,
  plugins: [
    nextCookies(),
    emailOTP({
      sendVerificationOnSignUp: true,
      otpLength: 6,
      expiresIn: 300,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification") return

        const host = process.env.SMTP_HOST
        const port = Number(process.env.SMTP_PORT || 587)
        const user = process.env.SMTP_USER
        const pass = process.env.SMTP_PASS
        const from = process.env.SMTP_FROM || user

        if (!host || !user || !pass || !from) {
          const devMessage = `SMTP no configurado. OTP local para ${email}: ${otp}`
          if (process.env.NODE_ENV !== "production") {
            console.warn(devMessage)
          } else {
            console.warn("SMTP no configurado, no se envía el código de verificación", { email, type })
          }
          return
        }

        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        })

        const subject = "Código de verificación de correo"
        const text = `Tu código de verificación es: ${otp}\n\nIngresa este código en la aplicación para activar tu cuenta.`
        const html = `<p>Tu código de verificación es:</p><h2>${otp}</h2><p>Ingresa este código en la aplicación para activar tu cuenta.</p>`

        await transporter.sendMail({
          from,
          to: email,
          subject,
          text,
          html,
        })
      },
    }),
  ],
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  database: databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "cliente",
        input: true,
      },
      clientType: {
        type: "string",
        required: false,
        defaultValue: "particular",
        input: true,
      },
      companyName: {
        type: "string",
        required: false,
        input: true,
      },
      companyRut: {
        type: "string",
        required: false,
        input: true,
      },
      companyEmail: {
        type: "string",
        required: false,
        input: true,
      },
      companyPhone: {
        type: "string",
        required: false,
        input: true,
      },
      companyAddress: {
        type: "string",
        required: false,
        input: true,
      },
      isApproved: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          const normalizedRole = String(user.role || "cliente").toLowerCase()
          const normalizedClientType = String(user.clientType || "particular").toLowerCase()
          const isTechnician = normalizedRole === "tecnico"
          return {
            data: {
              ...user,
              role: isTechnician ? "tecnico" : normalizedRole === "admin" ? "admin" : "cliente",
              clientType: normalizedClientType === "empresa" ? "empresa" : "particular",
              isApproved: isTechnician ? false : true,
            },
          }
        },
      },
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV !== "development",
    },
    disableCSRFCheck: process.env.NODE_ENV === "development",
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
      trustedProxies: ["127.0.0.1", "::1"],
    },
  },
})
