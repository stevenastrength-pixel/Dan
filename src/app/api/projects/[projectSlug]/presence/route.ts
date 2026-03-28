export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

export async function GET(_: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete stale anonymous/blank entries
  await prisma.userPresence.deleteMany({
    where: { projectId: project.id, username: { in: ['', 'Anonymous', 'anonymous'] } },
  })

  const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS)
  const recent = await prisma.userPresence.findMany({
    where: { projectId: project.id, lastSeen: { gte: cutoff } },
  })

  const contributors = await prisma.projectContributor.findMany({
    where: { projectId: project.id },
    orderBy: [{ joinedAt: 'asc' }, { username: 'asc' }],
  })

  const online = Array.from(new Set(recent.map(u => u.username)))
  const all = Array.from(new Set([
    ...contributors.map(contributor => contributor.username),
    ...online,
  ]))

  const allPresence = await prisma.userPresence.findMany({
    where: { projectId: project.id, username: { notIn: ['', 'Anonymous', 'anonymous'] } },
  })
  const readers = allPresence
    .filter(u => u.lastReadMessageId != null)
    .map(u => ({ username: u.username, lastReadMessageId: u.lastReadMessageId as number }))

  return NextResponse.json({
    online,
    all,
    contributors: contributors.map(contributor => contributor.username),
    readers,
  })
}

export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const { username, lastReadMessageId } = await request.json()
  if (!username?.trim()) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const readUpdate = typeof lastReadMessageId === 'number' ? { lastReadMessageId } : {}

  await prisma.userPresence.upsert({
    where: { projectId_username: { projectId: project.id, username } },
    create: { projectId: project.id, username, lastSeen: new Date(), ...readUpdate },
    update: { lastSeen: new Date(), ...readUpdate },
  })

  return NextResponse.json({ ok: true })
}
