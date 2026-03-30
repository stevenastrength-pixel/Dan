export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/keyed-areas?ids=1,2,3
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get('ids')
  if (!idsParam) return NextResponse.json([])
  const ids = idsParam.split(',').map(Number).filter(Boolean)
  if (ids.length === 0) return NextResponse.json([])
  const areas = await prisma.keyedArea.findMany({
    where: { id: { in: ids } },
    select: { id: true, key: true, title: true, location: { select: { name: true } } },
  })
  return NextResponse.json(areas)
}
