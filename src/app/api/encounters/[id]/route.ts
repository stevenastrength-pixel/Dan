export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const encounter = await prisma.encounter.findUnique({
    where: { id: parseInt(params.id) },
    include: { creatures: true, location: true, keyedArea: true },
  })
  if (!encounter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(encounter)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const encounter = await prisma.encounter.update({
    where: { id: parseInt(params.id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.encounterType !== undefined && { encounterType: body.encounterType }),
      ...(body.difficulty !== undefined && { difficulty: body.difficulty }),
      ...(body.readAloud !== undefined && { readAloud: body.readAloud }),
      ...(body.summary !== undefined && { summary: body.summary }),
      ...(body.tactics !== undefined && { tactics: body.tactics }),
      ...(body.dmNotes !== undefined && { dmNotes: body.dmNotes }),
      ...(body.locationId !== undefined && { locationId: body.locationId }),
      ...(body.rewardText !== undefined && { rewardText: body.rewardText }),
      ...(body.trapTrigger !== undefined && { trapTrigger: body.trapTrigger }),
      ...(body.detectionDC !== undefined && { detectionDC: body.detectionDC }),
      ...(body.disarmDC !== undefined && { disarmDC: body.disarmDC }),
      ...(body.trapEffect !== undefined && { trapEffect: body.trapEffect }),
      ...(body.trapReset !== undefined && { trapReset: body.trapReset }),
    },
  })
  return NextResponse.json(encounter)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.encounter.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
