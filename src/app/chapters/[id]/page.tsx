import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import ChapterEditor from './ChapterEditor'

export const dynamic = 'force-dynamic'

export default async function ChapterPage({ params }: { params: { id: string } }) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: params.id },
    include: { comments: { orderBy: { createdAt: 'asc' } } },
  })

  if (!chapter) notFound()

  const serialized = {
    ...chapter,
    createdAt: chapter.createdAt.toISOString(),
    updatedAt: chapter.updatedAt.toISOString(),
    comments: chapter.comments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
  }

  return <ChapterEditor chapter={serialized} />
}
