export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({
    where: { slug: params.projectSlug },
    include: {
      documents: { orderBy: { key: 'asc' } },
      _count: { select: { chapters: true, characters: true, polls: true } },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PUT(request: Request, { params }: { params: { projectSlug: string } }) {
  const body = await request.json()
  const project = await prisma.project.update({
    where: { slug: params.projectSlug },
    data: {
      name: body.name,
      description: body.description,
    },
  })
  return NextResponse.json(project)
}

export async function DELETE(_: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.project.delete({ where: { slug: params.projectSlug } })
  return NextResponse.json({ ok: true })
}
