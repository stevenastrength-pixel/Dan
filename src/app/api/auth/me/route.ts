import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    id: user.id,
    username: user.username,
    role: user.role,
    isAdmin: user.role === 'admin',
    openClawSessionKey: user.openClawSessionKey,
  })
}

// Public: lets the register page know whether an invite code is required
export async function HEAD() {
  const userCount = await prisma.user.count()
  // First user registers free; everyone else needs a code
  const inviteRequired = userCount > 0
  return new Response(null, {
    headers: { 'x-invite-required': inviteRequired ? '1' : '0' },
  })
}
