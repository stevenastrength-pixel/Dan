export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const locationId = parseInt(params.id)
  const maxOrder = await prisma.keyedArea.findFirst({
    where: { locationId }, orderBy: { order: 'desc' }, select: { order: true },
  })
  const area = await prisma.keyedArea.create({
    data: {
      locationId,
      key: body.key,
      title: body.title ?? '',
      readAloud: body.readAloud ?? '',
      dmNotes: body.dmNotes ?? '',
      connections: body.connections ? JSON.stringify(body.connections) : '[]',
      order: (maxOrder?.order ?? 0) + 1,
    },
  })
  return NextResponse.json(area)
}
