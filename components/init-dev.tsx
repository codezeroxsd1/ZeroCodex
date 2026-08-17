/**
 * Componente de inicialización para ejecutar seed en desarrollo
 * Se ejecuta en servidor al iniciar la aplicación
 */

import { seedDevUsers } from '@/lib/seed-dev-users'

export async function InitDev() {
  if (process.env.NODE_ENV === 'development') {
    try {
      await seedDevUsers()
    } catch (error) {
      console.warn('InitDev: seedDevUsers error:', error)
    }
  }
  return null
}
