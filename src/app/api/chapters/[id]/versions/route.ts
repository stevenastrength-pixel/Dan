export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const versionId = searchParams.get('versionId')

  if (versionId) {
    const version = await prisma.chapterVersion.findUnique({ where: { id: versionId } })
    if (!version) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(version)
  }

  const versions = await prisma.chapterVersion.findMany({
    where: { chapterId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return NextResponse.json(versions)
}
