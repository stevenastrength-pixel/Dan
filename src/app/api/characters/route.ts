export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectSlug = searchParams.get('projectSlug')

  if (projectSlug) {
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const characters = await prisma.character.findMany({
      where: { projectId: project.id },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(characters)
  }

  const characters = await prisma.character.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(characters)
}

export async function POST(request: Request) {
  const body = await request.json()

  let projectId = 1
  if (body.projectSlug) {
    const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    projectId = project.id
  }

  const character = await prisma.character.create({ data: { name: body.name, projectId } })
  return NextResponse.json(character)
}
