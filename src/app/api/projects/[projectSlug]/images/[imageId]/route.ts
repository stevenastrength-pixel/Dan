export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

const GALLERY_DIR = join(process.cwd(), 'data', 'gallery')

export async function PATCH(
  request: Request,
  { params }: { params: { projectSlug: string; imageId: string } }
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const image = await (prisma as any).projectImage.findFirst({
    where: { id: params.imageId, projectId: project.id },
  })
  if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

  const body = await request.json()
  const updated = await (prisma as any).projectImage.update({
    where: { id: params.imageId },
    data: { title: String(body.title ?? image.title).trim() },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: { projectSlug: string; imageId: string } }
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const image = await (prisma as any).projectImage.findFirst({
    where: { id: params.imageId, projectId: project.id },
  })
  if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

  await (prisma as any).projectImage.delete({ where: { id: params.imageId } })

  // Best-effort delete the file (ignore if already gone)
  try {
    await unlink(join(GALLERY_DIR, image.filename))
  } catch { /* no-op */ }

  return NextResponse.json({ ok: true })
}
