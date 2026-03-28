export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request, { params }: { params: { projectSlug: string } }) {
  const [project, user] = await Promise.all([
    prisma.project.findUnique({ where: { slug: params.projectSlug } }),
    getUserFromRequest(request),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const contributors = await prisma.projectContributor.findMany({
    where: { projectId: project.id },
    orderBy: [{ joinedAt: 'asc' }, { username: 'asc' }],
  })

  return NextResponse.json({
    contributors: contributors.map(contributor => contributor.username),
    isContributor: user ? contributors.some(contributor => contributor.username === user.username) : false,
  })
}

export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const contributor = await prisma.projectContributor.upsert({
    where: { projectId_username: { projectId: project.id, username: user.username } },
    create: { projectId: project.id, username: user.username },
    update: {},
  })

  return NextResponse.json({ ok: true, contributor })
}
