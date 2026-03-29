export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

// GET: fetch current active session with all combatants
export async function GET(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const session = await prisma.liveSession.findFirst({
    where: { projectId: project.id, isActive: true },
    include: { combatants: { orderBy: [{ sortOrder: 'asc' }, { initiative: 'desc' }] } },
  })

  return NextResponse.json(session ?? null)
}

// POST: start a new session (ends any existing active one first)
export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()

  // End any existing active session
  await prisma.liveSession.updateMany({
    where: { projectId: project.id, isActive: true },
    data: { isActive: false },
  })

  const session = await prisma.liveSession.create({
    data: {
      projectId: project.id,
      name: body.name ?? 'Combat',
      encounterId: body.encounterId ?? null,
    },
    include: { combatants: true },
  })

  return NextResponse.json(session)
}

// PATCH: update session state (round number, active index, name)
export async function PATCH(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const session = await prisma.liveSession.findFirst({
    where: { projectId: project.id, isActive: true },
  })
  if (!session) return NextResponse.json({ error: 'No active session' }, { status: 404 })

  const body = await request.json()
  const updated = await prisma.liveSession.update({
    where: { id: session.id },
    data: {
      ...(body.roundNumber !== undefined && { roundNumber: body.roundNumber }),
      ...(body.activeIndex !== undefined && { activeIndex: body.activeIndex }),
      ...(body.name !== undefined && { name: body.name }),
    },
    include: { combatants: { orderBy: [{ sortOrder: 'asc' }, { initiative: 'desc' }] } },
  })

  return NextResponse.json(updated)
}

// DELETE: end the active session
export async function DELETE(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.liveSession.updateMany({
    where: { projectId: project.id, isActive: true },
    data: { isActive: false },
  })

  return NextResponse.json({ ok: true })
}
