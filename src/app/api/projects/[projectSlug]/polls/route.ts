export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const polls = await prisma.poll.findMany({
    where: { projectId: project.id, ...(status ? { status } : {}) },
    include: { votes: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    polls.map((p) => ({ ...p, options: JSON.parse(p.options) }))
  )
}

export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { question, options, createdBy } = body

  if (!question || !Array.isArray(options) || options.length < 2 || !createdBy) {
    return NextResponse.json(
      { error: 'question, options (min 2), and createdBy are required' },
      { status: 400 }
    )
  }

  const poll = await prisma.poll.create({
    data: {
      projectId: project.id,
      question,
      options: JSON.stringify(options),
      createdBy,
    },
    include: { votes: true },
  })

  return NextResponse.json({ ...poll, options: JSON.parse(poll.options) }, { status: 201 })
}
