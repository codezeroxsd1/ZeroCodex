"use client"

import { testUsers } from "@/lib/test-users"

export function QuickLoginBanner() {
  if (process.env.NODE_ENV === "production") {
    return null
  }

  const handleQuickLogin = (role: "cliente" | "tecnico" | "admin") => {
    // Navegar al endpoint de login de desarrollo
    window.location.href = `/api/dev/login-as/${role}`
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-amber-900/80 border border-amber-600 rounded-lg p-4 max-w-xs backdrop-blur">
      <p className="text-xs text-amber-100 mb-2 font-semibold">
        🧪 DESARROLLO: Login rápido
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => handleQuickLogin("cliente")}
          className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1 rounded transition"
        >
          👤 Cliente →
        </button>
        <button
          onClick={() => handleQuickLogin("tecnico")}
          className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1 rounded transition"
        >
          🔧 Técnico →
        </button>
        <button
          onClick={() => handleQuickLogin("admin")}
          className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1 rounded transition"
        >
          📊 Admin →
        </button>
      </div>
      <p className="text-xs text-amber-300 mt-2 font-mono">
        {testUsers.cliente.email}
      </p>
    </div>
  )
}
