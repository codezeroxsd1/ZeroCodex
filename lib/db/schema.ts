import { pgTable, text, timestamp, boolean, serial, integer } from "drizzle-orm/pg-core"

// ---- Better Auth tables (do not rename columns) ----
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  role: text("role").notNull().default("cliente"),
  phone: text("phone"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt").$defaultFn(() => new Date()),
})

// ---- App tables ----
export const orden = pgTable("orden", {
  id: serial("id").primaryKey(),
  clienteId: text("clienteid").notNull(),
  clienteNombre: text("clientenombre").notNull(),
  clienteTelefono: text("clientetelefono"),
  categoria: text("categoria").notNull(),
  descripcion: text("descripcion").notNull(),
  direccion: text("direccion").notNull(),
  urgencia: text("urgencia").notNull().default("normal"),
  estado: text("estado").notNull().default("pendiente"),
  tecnicoId: text("tecnicoid"),
  tecnicoNombre: text("tecniconombre"),
  precio: integer("precio"),
  pdfUrl: text("pdfUrl"),
  date: timestamp("date"),
  localDate: text("localDate"),
  localTime: text("localTime"),
  notasTecnico: text("notastecnico"),
  technicalEvidence: text("technicalEvidence"),
  historial: text("historial"),
  departureAt: timestamp("departureAt"),
  arrivalAt: timestamp("arrivalAt"),
  workStartAt: timestamp("workStartAt"),
  workEndAt: timestamp("workEndAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const escalations = pgTable('escalations', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  phone: text('phone'),
  orderId: integer('order_id'),
  role: text('role'),
  message: text('message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type Orden = typeof orden.$inferSelect
