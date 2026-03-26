export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectSlug = searchParams.get('projectSlug')

  if (projectSlug) {
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const entries = await prisma.worldEntry.findMany({
      where: { projectId: project.id },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(entries)
  }

  const entries = await prisma.worldEntry.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] })
  return NextResponse.json(entries)
}

export async function POST(request: Request) {
  const body = await request.json()

  let projectId = 1
  if (body.projectSlug) {
    const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    projectId = project.id
  }

  const entry = await prisma.worldEntry.create({
    data: { name: body.name, type: body.type ?? 'Location', projectId },
  })
  return NextResponse.json(entry)
}
