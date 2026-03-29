export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectSlug = searchParams.get('projectSlug')
  if (!projectSlug) return NextResponse.json({ error: 'projectSlug required' }, { status: 400 })
  const project = await prisma.project.findUnique({ where: { slug: projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const tables = await prisma.randomTable.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(tables)
}

export async function POST(request: Request) {
  const body = await request.json()
  const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const table = await prisma.randomTable.create({
    data: {
      projectId: project.id,
      name: body.name,
      tableCategory: body.tableCategory ?? 'custom',
      dieSize: body.dieSize ?? 'd20',
      description: body.description ?? '',
      entries: body.entries ? JSON.stringify(body.entries) : '[]',
    },
  })
  return NextResponse.json(table)
}
