export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

const GALLERY_DIR = join(process.cwd(), 'data', 'gallery')
const MAX_BYTES = 20 * 1024 * 1024  // 20 MB per image

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export async function GET(
  request: Request,
  { params }: { params: { projectSlug: string } }
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const imageType = searchParams.get('type')

  const images = await (prisma as any).projectImage.findMany({
    where: {
      projectId: project.id,
      ...(imageType ? { imageType } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(images)
}

export async function POST(
  request: Request,
  { params }: { params: { projectSlug: string } }
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const imageType = (formData.get('imageType') as string | null) ?? 'concept_art'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })

  const mimeType = file.type.toLowerCase()
  const ext = ALLOWED_TYPES[mimeType]
  if (!ext) return NextResponse.json({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' }, { status: 400 })

  const filename = `${randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()

  await mkdir(GALLERY_DIR, { recursive: true })
  await writeFile(join(GALLERY_DIR, filename), Buffer.from(bytes))

  const image = await (prisma as any).projectImage.create({
    data: {
      projectId: project.id,
      imageType,
      title: title || file.name.replace(/\.[^.]+$/, ''),
      filename,
      url: `/api/gallery/${filename}`,
    },
  })

  return NextResponse.json(image)
}
