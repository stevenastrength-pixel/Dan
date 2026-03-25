import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const chapters = await prisma.chapter.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(chapters)
}

export async function POST(request: Request) {
  const body = await request.json()
  const maxOrder = await prisma.chapter.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const chapter = await prisma.chapter.create({
    data: { title: body.title, order: (maxOrder?.order ?? 0) + 1 },
  })
  return NextResponse.json(chapter)
}
