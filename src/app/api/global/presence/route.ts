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

  const allPresence = await prisma.userPresence.findMany({
    where: { projectId: GLOBAL_PRESENCE_ID, username: { notIn: ['', 'Anonymous', 'anonymous'] } },
  })
  const readers = allPresence
    .filter(u => u.lastReadMessageId != null)
    .map(u => ({ username: u.username, lastReadMessageId: u.lastReadMessageId as number }))

  return NextResponse.json({ online: recent.map(u => u.username), readers })
}

export async function POST(request: Request) {
  const { username, lastReadMessageId } = await request.json()
  if (!username?.trim()) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

  const readUpdate = typeof lastReadMessageId === 'number' ? { lastReadMessageId } : {}

  await prisma.userPresence.upsert({
    where: { projectId_username: { projectId: GLOBAL_PRESENCE_ID, username } },
    create: { projectId: GLOBAL_PRESENCE_ID, username, lastSeen: new Date(), ...readUpdate },
    update: { lastSeen: new Date(), ...readUpdate },
  })

  return NextResponse.json({ ok: true })
}
