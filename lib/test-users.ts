// Usuarios de prueba para desarrollo
export const testUsers = {
  cliente: {
    email: "cliente@test.com",
    password: "Test1234",
    role: "cliente",
    name: "Cliente Test",
  },
  clienteParticular: {
    email: "cliente-particular@test.com",
    password: "Test1234",
    role: "cliente",
    name: "Juan Pérez",
    clientType: "particular",
    phone: "+56912345678",
  },
  clienteEmpresa: {
    email: "cliente-empresa@test.com",
    password: "Test1234",
    role: "cliente",
    name: "Empresa Test",
    clientType: "empresa",
    phone: "+56912345679",
    companyName: "Test Empresa Ltda.",
    companyRut: "76.123.456-7",
    companyEmail: "contacto@test-empresa.com",
    companyPhone: "+56225123456",
    companyAddress: "Av. Providencia 1234, Providencia, Santiago, Chile",
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
export const getQuickLoginUrl = (role: "cliente" | "tecnico" | "admin", variant?: "particular" | "empresa") => {
  let user
  if (role === "cliente" && variant === "particular") {
    user = testUsers.clienteParticular
  } else if (role === "cliente" && variant === "empresa") {
    user = testUsers.clienteEmpresa
  } else {
    user = testUsers[role]
  }
  return `/api/dev/quick-login?email=${user.email}&role=${role}`
}
