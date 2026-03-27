import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

const PUBLIC = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/api/auth/me', '/api/auth/logout']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    // Redirect already-logged-in users away from auth pages
    if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
      const token = request.cookies.get('session')?.value
      if (token) {
        try {
          await jwtVerify(token, secret())
          return NextResponse.redirect(new URL('/', request.url))
        } catch {}
      }
    }
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, secret())
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
