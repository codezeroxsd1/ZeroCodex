// Usuarios de prueba para desarrollo
export const testUsers = {
  cliente: {
    email: "cliente@test.com",
    password: "Test1234",
    role: "cliente",
    name: "Cliente Test",
  },
  tecnico: {
    email: "tecnico@test.com",
    password: "Test1234",
    role: "tecnico",
    name: "Técnico Test",
  },
  admin: {
    email: "admin@test.com",
    password: "Test1234",
    role: "admin",
    name: "Administrador Test",
  },
}

export const testUserEmails = Object.values(testUsers).map((user) => user.email)

// Para desarrollo: URLs de quick-login
export const getQuickLoginUrl = (role: "cliente" | "tecnico" | "admin") => {
  const user = testUsers[role]
  return `/api/dev/quick-login?email=${user.email}&role=${role}`
}
