import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: params.id },
    include: { comments: { orderBy: { createdAt: 'asc' } } },
  })
  if (!chapter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(chapter)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()

  // Save a snapshot of the old content before overwriting
  const existing = await prisma.chapter.findUnique({
    where: { id: params.id },
    select: { content: true },
  })
  if (existing && existing.content !== body.content && existing.content !== '') {
    await prisma.chapterVersion.create({
      data: {
        chapterId: params.id,
        content: existing.content,
        savedBy: body.savedBy ?? 'Unknown',
      },
    })
  }

  const chapter = await prisma.chapter.update({
    where: { id: params.id },
    data: { title: body.title, content: body.content },
  })
  return NextResponse.json(chapter)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.chapter.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
