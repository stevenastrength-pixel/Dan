import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)

  const poll = await prisma.poll.findUnique({ where: { id } })
  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })

  const updated = await prisma.poll.update({
    where: { id },
    data: { status: 'CLOSED' },
    include: { votes: true },
  })

  return NextResponse.json({ ...updated, options: JSON.parse(updated.options) })
}
