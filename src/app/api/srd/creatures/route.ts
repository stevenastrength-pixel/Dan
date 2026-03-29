export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  const type = searchParams.get('type')
  const crMin = searchParams.get('crMin')
  const crMax = searchParams.get('crMax')
  const legendary = searchParams.get('legendary')

  // CR comparison is tricky with strings like '1/8', '1/4' etc.
  // We filter numerically after fetching a broad set
  const CR_ORDER = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','30']

  const creatures = await prisma.srdCreature.findMany({
    where: {
      ...(name ? { name: { contains: name } } : {}),
      ...(type ? { creatureType: { contains: type } } : {}),
      ...(legendary === 'true' ? { isLegendary: true } : {}),
    },
    orderBy: { name: 'asc' },
    take: 50,
    select: {
      id: true, name: true, size: true, creatureType: true, alignment: true,
      CR: true, xpValue: true, AC: true, HPAverage: true, isLegendary: true,
    },
  })

  let results = creatures
  if (crMin || crMax) {
    const minIdx = crMin ? CR_ORDER.indexOf(crMin) : 0
    const maxIdx = crMax ? CR_ORDER.indexOf(crMax) : CR_ORDER.length - 1
    results = creatures.filter(c => {
      const idx = CR_ORDER.indexOf(c.CR)
      return idx >= minIdx && idx <= maxIdx
    })
  }

  return NextResponse.json(results)
}
