export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { createProject } from '@/lib/projectCreation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    where: type ? { type } : undefined,
    include: {
      _count: {
        select: {
          chapters: true,
          sessions: true,
          polls: { where: { status: 'OPEN' } },
          tasks: { where: { status: { not: 'DONE' } } },
        },
      },
    },
  })
  return NextResponse.json(projects)
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  const body = await request.json()
  const { name, description, type, premise, setting, minLevel, maxLevel, partySize, levelingMode } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const project = await createProject({
    name,
    type: type === 'campaign' ? 'campaign' : 'novel',
    description,
    premise,
    setting,
    minLevel,
    maxLevel,
    partySize,
    levelingMode,
    creatorUsername: user?.username,
  })

  // Return full project with documents for client compatibility
  const full = await prisma.project.findUnique({
    where: { id: project.id },
    include: { documents: true },
  })

  return NextResponse.json(full, { status: 201 })
}
