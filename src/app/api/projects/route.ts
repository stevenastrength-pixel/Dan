import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORE_DOCS = [
  { key: 'story_bible', title: 'Story Bible' },
  { key: 'project_instructions', title: 'Project Instructions' },
  { key: 'wake_prompt', title: 'Wake Prompt' },
]

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { chapters: true, characters: true, polls: true } },
    },
  })
  return NextResponse.json(projects)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, description } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const baseSlug = toSlug(name.trim())
  let slug = baseSlug
  let attempt = 0
  while (await prisma.project.findUnique({ where: { slug } })) {
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() ?? '',
      documents: {
        create: CORE_DOCS,
      },
    },
    include: { documents: true },
  })

  return NextResponse.json(project, { status: 201 })
}
