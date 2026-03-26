export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const entry = await prisma.worldEntry.findUnique({ where: { id: params.id } })
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(entry)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const entry = await prisma.worldEntry.update({
    where: { id: params.id },
    data: {
      name: body.name,
      type: body.type,
      description: body.description,
      notes: body.notes,
    },
  })
  return NextResponse.json(entry)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.worldEntry.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
