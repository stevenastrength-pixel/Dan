export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const location = await prisma.location.findUnique({
    where: { id: parseInt(params.id) },
    include: { keyedAreas: { orderBy: { order: 'asc' } }, encounters: true },
  })
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(location)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const location = await prisma.location.update({
    where: { id: parseInt(params.id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.locationType !== undefined && { locationType: body.locationType }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.atmosphere !== undefined && { atmosphere: body.atmosphere }),
      ...(body.parentLocationId !== undefined && { parentLocationId: body.parentLocationId }),
    },
  })
  return NextResponse.json(location)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.location.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
