export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken, sessionCookie } from '@/lib/auth'

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (!username?.trim() || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (!user) {
    // Constant-time response to avoid username enumeration
    await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000')
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
  }

  const token = await signToken(user.id)
  return NextResponse.json(
    { id: user.id, username: user.username },
    { headers: { 'Set-Cookie': sessionCookie(token) } }
  )
}
