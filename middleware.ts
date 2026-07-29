import { NextResponse, type NextRequest } from "next/server"

export function proxy.ts(request: NextRequest) {
  const protectedRoutes = {
    "/cliente": "cliente",
    "/tecnico": "tecnico",
    "/admin": "admin",
  } as Record<string, string>

  const pathname = request.nextUrl.pathname

  for (const [route, loginPath] of Object.entries(protectedRoutes)) {
    if (pathname.startsWith(route)) {
      const sessionCookie = request.cookies.get("better-auth.session_token")

      if (!sessionCookie) {
        return NextResponse.redirect(new URL(loginPath, request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/cliente/:path*", "/tecnico/:path*", "/admin/:path*"],
}
