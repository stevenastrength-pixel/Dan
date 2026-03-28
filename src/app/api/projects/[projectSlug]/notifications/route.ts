export const dynamic = 'force-dynamic'

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

  const contributor = await prisma.projectContributor.findUnique({
    where: { projectId_username: { projectId: project.id, username: user.username } },
  })

  // Only registered contributors block poll completion and get poll reminders.
  const pendingPolls = contributor
    ? (await prisma.poll.findMany({
        where: { projectId: project.id, status: 'OPEN' },
        include: { votes: { where: { voterName: user.username } } },
      })).filter(p => p.votes.length === 0).length
    : 0

  // Tasks assigned to user that aren't done
  const pendingTasks = await prisma.task.count({
    where: { projectId: project.id, assignedTo: user.username, status: { not: 'DONE' } },
  })

  return NextResponse.json({ pendingPolls, pendingTasks })
}
