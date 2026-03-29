export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST { orderedIds: string[] } — reassigns order values based on array position
export async function POST(request: Request) {
  const { orderedIds } = await request.json()
  if (!Array.isArray(orderedIds)) return NextResponse.json({ error: 'orderedIds required' }, { status: 400 })

  await prisma.$transaction(
    orderedIds.map((id: string, index: number) =>
      prisma.chapter.update({ where: { id }, data: { order: index } })
    )
  )

  return NextResponse.json({ ok: true })
}
