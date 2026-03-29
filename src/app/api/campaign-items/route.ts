export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectSlug = searchParams.get('projectSlug')
  if (!projectSlug) return NextResponse.json({ error: 'projectSlug required' }, { status: 400 })
  const project = await prisma.project.findUnique({ where: { slug: projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const items = await prisma.campaignMagicItem.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const body = await request.json()
  const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const item = await prisma.campaignMagicItem.create({
    data: {
      projectId: project.id,
      name: body.name,
      rarity: body.rarity ?? 'uncommon',
      itemType: body.itemType ?? 'wondrous',
      requiresAttunement: body.requiresAttunement ?? false,
      attunementNotes: body.attunementNotes ?? '',
      chargesMax: body.chargesMax ?? null,
      rechargeCondition: body.rechargeCondition ?? '',
      description: body.description ?? '',
      properties: body.properties ?? '',
      lore: body.lore ?? '',
    },
  })
  return NextResponse.json(item)
}
