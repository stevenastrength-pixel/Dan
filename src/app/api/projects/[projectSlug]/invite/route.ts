export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

// GET: return existing invite token for this project (if any)
export async function GET(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const invite = await prisma.projectInvite.findFirst({ where: { projectId: project.id } })
  return NextResponse.json({ token: invite?.token ?? null })
}

// POST: generate (or regenerate) an invite token for this project
export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete any existing invite and create a fresh one
  await prisma.projectInvite.deleteMany({ where: { projectId: project.id } })
  const token = randomBytes(16).toString('hex')
  await prisma.projectInvite.create({ data: { token, projectId: project.id } })

  return NextResponse.json({ token })
}

// DELETE: revoke the invite link
export async function DELETE(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.projectInvite.deleteMany({ where: { projectId: project.id } })
  return NextResponse.json({ ok: true })
}
