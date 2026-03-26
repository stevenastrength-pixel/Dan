export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const character = await prisma.character.findUnique({ where: { id: params.id } })
  if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(character)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const character = await prisma.character.update({
    where: { id: params.id },
    data: {
      name: body.name,
      role: body.role,
      description: body.description,
      notes: body.notes,
      traits: body.traits,
    },
  })
  return NextResponse.json(character)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.character.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
