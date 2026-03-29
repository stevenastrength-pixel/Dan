export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const creature = await prisma.srdCreature.findUnique({ where: { id: parseInt(params.id) } })
  if (!creature) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(creature)
}
