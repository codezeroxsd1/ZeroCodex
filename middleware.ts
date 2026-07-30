import { NextResponse, type NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const protectedRoutes = {
    "/cliente": "/sign-in/cliente",
    "/tecnico": "/sign-in/tecnico",
    "/admin": "/sign-in/admin",
  } as Record<string, string>

  const pathname = request.nextUrl.pathname

  const hasSessionCookie = [
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
  ].some((name) => request.cookies.has(name))

  for (const [route, loginPath] of Object.entries(protectedRoutes)) {
    if (pathname.startsWith(route) && !hasSessionCookie) {
      return NextResponse.redirect(new URL(loginPath, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/cliente/:path*", "/tecnico/:path*", "/admin/:path*"],
}
