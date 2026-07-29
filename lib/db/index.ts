import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

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

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL)

export const pool = connectionString ? new Pool({ connectionString }) : new Pool()
export const db = drizzle(pool, { schema })
