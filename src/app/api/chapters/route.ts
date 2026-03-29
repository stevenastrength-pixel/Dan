export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectSlug = searchParams.get('projectSlug')

  if (projectSlug) {
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const chapters = await prisma.chapter.findMany({
      where: { projectId: project.id },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(chapters)
  }

  const chapters = await prisma.chapter.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(chapters)
}

export async function POST(request: Request) {
  const body = await request.json()

  let projectId = 1
  if (body.projectSlug) {
    const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    projectId = project.id
  }

  // Duplicate an existing chapter
  if (body.duplicateId) {
    const source = await prisma.chapter.findUnique({ where: { id: body.duplicateId } })
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    const maxOrder = await prisma.chapter.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    const copy = await prisma.chapter.create({
      data: {
        title: `${source.title} (copy)`,
        content: source.content,
        synopsis: source.synopsis,
        projectId,
        order: (maxOrder?.order ?? 0) + 1,
      },
    })
    return NextResponse.json(copy)
  }

  const maxOrder = await prisma.chapter.findFirst({
    where: { projectId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const chapter = await prisma.chapter.create({
    data: { title: body.title, projectId, order: (maxOrder?.order ?? 0) + 1 },
  })
  return NextResponse.json(chapter)
}
