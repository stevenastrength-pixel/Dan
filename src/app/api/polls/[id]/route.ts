export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const poll = await prisma.poll.findUnique({
    where: { id },
    include: { votes: true },
  })
  if (!poll) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...poll, options: JSON.parse(poll.options) })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const id = parseInt(params.id)
  await prisma.poll.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
