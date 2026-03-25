import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const poll = await prisma.poll.findUnique({
    where: { id },
    include: { votes: true },
  })
  if (!poll) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...poll, options: JSON.parse(poll.options) })
}
