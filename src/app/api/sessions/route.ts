export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectSlug = searchParams.get('projectSlug')
  if (!projectSlug) return NextResponse.json({ error: 'projectSlug required' }, { status: 400 })
  const project = await prisma.project.findUnique({ where: { slug: projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const sessions = await prisma.session.findMany({
    where: { projectId: project.id },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json(sessions)
}

export async function POST(request: Request) {
  const body = await request.json()
  const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const maxOrder = await prisma.session.findFirst({
    where: { projectId: project.id }, orderBy: { order: 'desc' }, select: { order: true },
  })
  const session = await prisma.session.create({
    data: {
      projectId: project.id,
      title: body.title,
      summary: body.summary ?? '',
      outline: body.outline ?? '',
      intendedLevel: body.intendedLevel ?? null,
      order: (maxOrder?.order ?? 0) + 1,
    },
  })
  return NextResponse.json(session)
}
