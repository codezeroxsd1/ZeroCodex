import { z } from "zod"

// Auth schemas
export const signUpSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  name: z.string().min(2, "Nombre requerido"),
  phone: z.string().optional(),
  role: z.enum(["cliente", "tecnico", "admin"]).default("cliente"),
})

export const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
})

// Orden schemas
export const crearOrdenSchema = z.object({
  categoria: z.string().min(1, "Categoría requerida"),
  descripcion: z.string().min(10, "Descripción mínimo 10 caracteres"),
  direccion: z.string().min(5, "Dirección requerida"),
  urgencia: z.enum(["normal", "urgente"]).default("normal"),
  date: z.string().optional(),
})

export const actualizarOrdenSchema = z.object({
  id: z.number().int(),
  estado: z.enum(["pendiente", "en camino", "en proceso", "finalizado"]).optional(),
  tecnicoId: z.string().optional(),
  precio: z.number().int().positive().optional(),
  notasTecnico: z.string().optional(),
})

// User schemas
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["cliente", "tecnico", "admin"]),
  phone: z.string().optional().nullable(),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type CrearOrdenInput = z.infer<typeof crearOrdenSchema>
export type ActualizarOrdenInput = z.infer<typeof actualizarOrdenSchema>
export type UserData = z.infer<typeof userSchema>
