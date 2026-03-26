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

  return NextResponse.json({
    online: recent.map(u => u.username),
    all: recent.map(u => u.username),
  })
}

export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const { username } = await request.json()
  if (!username?.trim()) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.userPresence.upsert({
    where: { projectId_username: { projectId: project.id, username } },
    create: { projectId: project.id, username, lastSeen: new Date() },
    update: { lastSeen: new Date() },
  })

  return NextResponse.json({ ok: true })
}
