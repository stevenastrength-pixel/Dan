export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectSlug = searchParams.get('projectSlug')
  if (!projectSlug) return NextResponse.json({ error: 'projectSlug required' }, { status: 400 })
  const project = await prisma.project.findUnique({ where: { slug: projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const locations = await prisma.location.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
    include: { keyedAreas: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json(locations)
}

export async function POST(request: Request) {
  const body = await request.json()
  const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const location = await prisma.location.create({
    data: {
      projectId: project.id,
      name: body.name,
      locationType: body.locationType ?? 'dungeon',
      description: body.description ?? '',
      atmosphere: body.atmosphere ?? '',
      parentLocationId: body.parentLocationId ?? null,
    },
  })
  return NextResponse.json(location)
}
