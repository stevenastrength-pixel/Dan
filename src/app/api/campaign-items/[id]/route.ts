export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const item = await prisma.campaignMagicItem.update({
    where: { id: parseInt(params.id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.rarity !== undefined && { rarity: body.rarity }),
      ...(body.itemType !== undefined && { itemType: body.itemType }),
      ...(body.requiresAttunement !== undefined && { requiresAttunement: body.requiresAttunement }),
      ...(body.attunementNotes !== undefined && { attunementNotes: body.attunementNotes }),
      ...(body.chargesMax !== undefined && { chargesMax: body.chargesMax }),
      ...(body.rechargeCondition !== undefined && { rechargeCondition: body.rechargeCondition }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.properties !== undefined && { properties: body.properties }),
      ...(body.lore !== undefined && { lore: body.lore }),
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.campaignMagicItem.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
