export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function DELETE(
  request: Request,
  { params }: { params: { projectSlug: string; messageId: string } }
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const message = await prisma.projectMessage.findUnique({ where: { id: parseInt(params.messageId) } })
  if (!message || message.projectId !== project.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (message.author !== user.username && user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.projectMessage.delete({ where: { id: message.id } })
  return NextResponse.json({ ok: true })
}
