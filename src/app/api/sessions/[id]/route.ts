export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await prisma.session.findUnique({ where: { id: parseInt(params.id) } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(session)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const session = await prisma.session.update({
    where: { id: parseInt(params.id) },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.summary !== undefined && { summary: body.summary }),
      ...(body.outline !== undefined && { outline: body.outline }),
      ...(body.intendedLevel !== undefined && { intendedLevel: body.intendedLevel }),
      ...(body.order !== undefined && { order: body.order }),
    },
  })
  return NextResponse.json(session)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.session.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
