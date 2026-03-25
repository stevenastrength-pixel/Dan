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

  return <ChapterEditor chapter={chapter} />
}
