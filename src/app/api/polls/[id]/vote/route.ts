import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await request.json()
  const { voterName, optionIdx } = body

  if (!voterName || optionIdx === undefined) {
    return NextResponse.json({ error: 'voterName and optionIdx are required' }, { status: 400 })
  }

  const poll = await prisma.poll.findUnique({ where: { id } })
  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  if (poll.status === 'CLOSED') return NextResponse.json({ error: 'Poll is closed' }, { status: 400 })

  const options: string[] = JSON.parse(poll.options)
  if (optionIdx < 0 || optionIdx >= options.length) {
    return NextResponse.json({ error: 'Invalid option index' }, { status: 400 })
  }

  const vote = await prisma.vote.upsert({
    where: { pollId_voterName: { pollId: id, voterName } },
    update: { optionIdx },
    create: { pollId: id, voterName, optionIdx },
  })

  const updated = await prisma.poll.findUnique({
    where: { id },
    include: { votes: true },
  })

  return NextResponse.json({
    vote,
    poll: { ...updated, options: JSON.parse(updated!.options) },
  })
}
