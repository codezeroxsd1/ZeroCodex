"use client"

import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  fetchOptions: {
    credentials: "include",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  },
})

export const { signIn, signUp, signOut, useSession } = authClient
