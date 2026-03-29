export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const encounterId = parseInt(params.id)
  const entry = await prisma.encounterCreature.create({
    data: {
      encounterId,
      quantity: body.quantity ?? 1,
      srdCreatureId: body.srdCreatureId ?? null,
      campaignCreatureId: body.campaignCreatureId ?? null,
      notes: body.notes ?? '',
    },
  })
  return NextResponse.json(entry)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const entryId = searchParams.get('entryId')
  if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 })
  await prisma.encounterCreature.delete({ where: { id: parseInt(entryId) } })
  return NextResponse.json({ ok: true })
}
