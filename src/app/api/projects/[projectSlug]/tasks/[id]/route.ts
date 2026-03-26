export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function PATCH(
  request: Request,
  { params }: { params: { projectSlug: string; id: string } }
) {
  const { status, title, description } = await request.json()
  const id = parseInt(params.id)

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: { projectSlug: string; id: string } }
) {
  const user = await getUserFromRequest(request)
  const id = parseInt(params.id)

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only admin or the assigned user can delete
  if (user?.role !== 'admin' && user?.username !== task.assignedTo) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
