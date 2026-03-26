import { SignJWT, jwtVerify } from 'jose'
import { prisma } from './prisma'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

export async function signToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as { userId: number }
  } catch {
    return null
  }
}

export async function getUserFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/)
  if (!match) return null
  const payload = await verifyToken(match[1])
  if (!payload) return null
  return prisma.user.findUnique({ where: { id: payload.userId } })
}

export async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user || user.role !== 'admin') return null
  return user
}

export function sessionCookie(token: string) {
  return `session=${token}; HttpOnly; Path=/; SameSite=Lax`
}

export function clearSessionCookie() {
  return `session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
}
