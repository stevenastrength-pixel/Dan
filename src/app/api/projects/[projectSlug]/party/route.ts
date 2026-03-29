export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = await prisma.partyMember.findMany({
    where: { projectId: project.id },
    include: { characterSheet: true },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  })

  return NextResponse.json(members)
}

// Join the party (or update your role)
export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const role = body.role === 'dm' ? 'dm' : 'player'

  const member = await prisma.partyMember.upsert({
    where: { projectId_username: { projectId: project.id, username: user.username } },
    create: { projectId: project.id, username: user.username, role },
    update: { role },
    include: { characterSheet: true },
  })

  return NextResponse.json(member)
}

// Update another member's role (DM only) or link a character sheet
export async function PATCH(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { username, role, characterSheetId } = body

  // Users can only update their own sheet link; DMs can update roles
  const requestingMember = await prisma.partyMember.findUnique({
    where: { projectId_username: { projectId: project.id, username: user.username } },
  })

  const targetUsername = username ?? user.username

  if (role !== undefined && requestingMember?.role !== 'dm' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Only the DM can change roles' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  if (role !== undefined) updateData.role = role === 'dm' ? 'dm' : 'player'
  if (characterSheetId !== undefined) updateData.characterSheetId = characterSheetId || null

  const member = await prisma.partyMember.update({
    where: { projectId_username: { projectId: project.id, username: targetUsername } },
    data: updateData,
    include: { characterSheet: true },
  })

  return NextResponse.json(member)
}

export async function DELETE(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.partyMember.deleteMany({
    where: { projectId: project.id, username: user.username },
  })

  return NextResponse.json({ ok: true })
}
