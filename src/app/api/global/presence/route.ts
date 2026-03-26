export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes
const GLOBAL_PRESENCE_ID = 0 // sentinel projectId for global presence

export async function GET() {
  // Delete stale anonymous/blank entries
  await prisma.userPresence.deleteMany({
    where: { projectId: GLOBAL_PRESENCE_ID, username: { in: ['', 'Anonymous', 'anonymous'] } },
  })

  const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS)
  const recent = await prisma.userPresence.findMany({
    where: { projectId: GLOBAL_PRESENCE_ID, lastSeen: { gte: cutoff } },
  })

  return NextResponse.json({ online: recent.map(u => u.username) })
}

export async function POST(request: Request) {
  const { username } = await request.json()
  if (!username?.trim()) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

  await prisma.userPresence.upsert({
    where: { projectId_username: { projectId: GLOBAL_PRESENCE_ID, username } },
    create: { projectId: GLOBAL_PRESENCE_ID, username, lastSeen: new Date() },
    update: { lastSeen: new Date() },
  })

  return NextResponse.json({ ok: true })
}
