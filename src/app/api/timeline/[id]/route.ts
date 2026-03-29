export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const event = await prisma.timelineEvent.update({
    where: { id: parseInt(params.id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.inWorldDay !== undefined && { inWorldDay: body.inWorldDay }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.triggerCondition !== undefined && { triggerCondition: body.triggerCondition }),
      ...(body.consequence !== undefined && { consequence: body.consequence }),
    },
  })
  return NextResponse.json(event)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.timelineEvent.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
