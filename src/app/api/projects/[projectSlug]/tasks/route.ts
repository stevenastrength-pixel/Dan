import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: { projectSlug: string } }
) {
  const { searchParams } = new URL(request.url)
  const assignedTo = searchParams.get('assignedTo')

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tasks = await prisma.task.findMany({
    where: {
      projectId: project.id,
      ...(assignedTo ? { assignedTo } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(tasks)
}

export async function POST(
  request: Request,
  { params }: { params: { projectSlug: string } }
) {
  const user = await getUserFromRequest(request)
  const { assignedTo, title, description, createdBy } = await request.json()

  if (!assignedTo?.trim() || !title?.trim()) {
    return NextResponse.json({ error: 'assignedTo and title are required' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      assignedTo: assignedTo.trim(),
      title: title.trim(),
      description: description?.trim() ?? '',
      createdBy: createdBy?.trim() || user?.username || 'Unknown',
    },
  })

  return NextResponse.json(task, { status: 201 })
}
