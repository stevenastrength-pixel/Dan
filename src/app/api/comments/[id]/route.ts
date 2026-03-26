export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const comment = await prisma.comment.update({
    where: { id: params.id },
    data: { resolved: body.resolved },
  })
  return NextResponse.json(comment)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.comment.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
