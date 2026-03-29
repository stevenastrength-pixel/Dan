export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  const level = searchParams.get('level')
  const school = searchParams.get('school')
  const className = searchParams.get('class')

  const spells = await prisma.srdSpell.findMany({
    where: {
      ...(name ? { name: { contains: name } } : {}),
      ...(level !== null ? { level: parseInt(level) } : {}),
      ...(school ? { school: { contains: school } } : {}),
    },
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
    take: 50,
  })

  const results = className
    ? spells.filter(s => {
        try { return (JSON.parse(s.classes) as string[]).some(c => c.toLowerCase().includes(className.toLowerCase())) }
        catch { return false }
      })
    : spells

  return NextResponse.json(results)
}
