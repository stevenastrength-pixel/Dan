export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getProject(slug: string) {
  return prisma.project.findUnique({ where: { slug } })
}

export async function GET(
  _: Request,
  { params }: { params: { projectSlug: string; key: string } }
) {
  const project = await getProject(params.projectSlug)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const doc = await prisma.projectDocument.findUnique({
    where: { projectId_key: { projectId: project.id, key: params.key } },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(doc)
}

export async function PUT(
  request: Request,
  { params }: { params: { projectSlug: string; key: string } }
) {
  const project = await getProject(params.projectSlug)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()

  const doc = await prisma.projectDocument.upsert({
    where: { projectId_key: { projectId: project.id, key: params.key } },
    update: { content: body.content ?? '', title: body.title },
    create: {
      projectId: project.id,
      key: params.key,
      title: body.title ?? params.key,
      content: body.content ?? '',
    },
  })
  return NextResponse.json(doc)
}
