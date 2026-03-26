import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: { projectSlug: string } }
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ pendingPolls: 0, pendingTasks: 0 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ pendingPolls: 0, pendingTasks: 0 })

  // Open polls the user hasn't voted on yet
  const openPolls = await prisma.poll.findMany({
    where: { projectId: project.id, status: 'OPEN' },
    include: { votes: { where: { voterName: user.username } } },
  })
  const pendingPolls = openPolls.filter(p => p.votes.length === 0).length

  // Tasks assigned to user that aren't done
  const pendingTasks = await prisma.task.count({
    where: { projectId: project.id, assignedTo: user.username, status: { not: 'DONE' } },
  })

  return NextResponse.json({ pendingPolls, pendingTasks })
}
