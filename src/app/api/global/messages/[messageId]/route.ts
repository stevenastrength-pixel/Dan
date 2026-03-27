export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function DELETE(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const message = await prisma.globalMessage.findUnique({ where: { id: parseInt(params.messageId) } })
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (message.author !== user.username && user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.globalMessage.delete({ where: { id: message.id } })
  return NextResponse.json({ ok: true })
}
