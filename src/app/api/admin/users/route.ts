import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: Request) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(users)
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, role } = await request.json()
  if (!['admin', 'contributor'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
  }
  if (id === admin.id && role !== 'admin') {
    return NextResponse.json({ error: 'You cannot demote yourself.' }, { status: 400 })
  }
  const user = await prisma.user.update({ where: { id }, data: { role } })
  return NextResponse.json({ id: user.id, username: user.username, role: user.role })
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()
  if (id === admin.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  }
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
