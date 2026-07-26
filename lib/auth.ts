import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { Pool } from "pg"

// Construcción segura de base URL
const baseURL = (() => {
  // Prioridad en environment variables
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  
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
  process.env.V0_RUNTIME_URL,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
].filter((url) => url && typeof url === "string") as string[]

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  plugins: [nextCookies()],
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
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
      phone: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV !== "development",
    },
  },
})
