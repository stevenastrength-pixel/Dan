import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORE_DOC_ORDER = ['story_bible', 'project_instructions', 'wake_prompt']

export async function GET(_: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const docs = await prisma.projectDocument.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'asc' },
  })

  // Sort: core docs first, then the rest alphabetically
  docs.sort((a, b) => {
    const ai = CORE_DOC_ORDER.indexOf(a.key)
    const bi = CORE_DOC_ORDER.indexOf(b.key)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.title.localeCompare(b.title)
  })

  return NextResponse.json(docs)
}

export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { key, title } = body
  if (!key || !title) return NextResponse.json({ error: 'key and title required' }, { status: 400 })

  const doc = await prisma.projectDocument.create({
    data: { projectId: project.id, key, title },
  })
  return NextResponse.json(doc, { status: 201 })
}
