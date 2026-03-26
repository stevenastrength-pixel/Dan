export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken, sessionCookie } from '@/lib/auth'

export async function POST(request: Request) {
  const { username, password, inviteCode } = await request.json()

  if (!username?.trim() || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
  }
  if (username.trim().length < 2) {
    return NextResponse.json({ error: 'Username must be at least 2 characters.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const userCount = await prisma.user.count()
  const isFirstUser = userCount === 0

  // Everyone except the first user needs the invite code
  if (!isFirstUser) {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    const stored = settings?.inviteCode?.trim()
    if (!stored) {
      return NextResponse.json({ error: 'No invite code has been set. Ask an admin to generate one.' }, { status: 403 })
    }
    if (inviteCode?.trim() !== stored) {
      return NextResponse.json({ error: 'Invalid invite code.' }, { status: 403 })
    }
  }

  const existing = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (existing) {
    return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      username: username.trim(),
      passwordHash,
      role: isFirstUser ? 'admin' : 'contributor',
    },
  })

  const token = await signToken(user.id)
  return NextResponse.json(
    { id: user.id, username: user.username, role: user.role },
    { status: 201, headers: { 'Set-Cookie': sessionCookie(token) } }
  )
}
