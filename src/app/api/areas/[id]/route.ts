export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const area = await prisma.keyedArea.update({
    where: { id: parseInt(params.id) },
    data: {
      ...(body.key !== undefined && { key: body.key }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.readAloud !== undefined && { readAloud: body.readAloud }),
      ...(body.dmNotes !== undefined && { dmNotes: body.dmNotes }),
      ...(body.connections !== undefined && { connections: JSON.stringify(body.connections) }),
      ...(body.order !== undefined && { order: body.order }),
    },
  })
  return NextResponse.json(area)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.keyedArea.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
