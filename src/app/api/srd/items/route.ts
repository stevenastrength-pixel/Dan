export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  const rarity = searchParams.get('rarity')

  const items = await prisma.srdMagicItem.findMany({
    where: {
      ...(name ? { name: { contains: name } } : {}),
      ...(rarity ? { rarity } : {}),
    },
    orderBy: { name: 'asc' },
    take: 50,
  })
  return NextResponse.json(items)
}
