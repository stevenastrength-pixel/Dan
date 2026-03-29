export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const quest = await prisma.quest.update({
    where: { id: parseInt(params.id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.questType !== undefined && { questType: body.questType }),
      ...(body.rewardText !== undefined && { rewardText: body.rewardText }),
      ...(body.giverCharacterId !== undefined && { giverCharacterId: body.giverCharacterId }),
      ...(body.locationId !== undefined && { locationId: body.locationId }),
    },
  })
  return NextResponse.json(quest)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.quest.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
