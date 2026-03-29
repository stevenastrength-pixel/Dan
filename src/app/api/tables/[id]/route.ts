export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const table = await prisma.randomTable.update({
    where: { id: parseInt(params.id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.tableCategory !== undefined && { tableCategory: body.tableCategory }),
      ...(body.dieSize !== undefined && { dieSize: body.dieSize }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.entries !== undefined && { entries: typeof body.entries === 'string' ? body.entries : JSON.stringify(body.entries) }),
    },
  })
  return NextResponse.json(table)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.randomTable.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
