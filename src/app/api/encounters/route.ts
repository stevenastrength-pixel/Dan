export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectSlug = searchParams.get('projectSlug')
  if (!projectSlug) return NextResponse.json({ error: 'projectSlug required' }, { status: 400 })
  const project = await prisma.project.findUnique({ where: { slug: projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const encounters = await prisma.encounter.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
    include: { creatures: true },
  })

  // Enrich creatures with stat block summaries
  const srdIds = Array.from(new Set(encounters.flatMap(e => e.creatures.map(c => c.srdCreatureId).filter(Boolean) as number[])))
  const campIds = Array.from(new Set(encounters.flatMap(e => e.creatures.map(c => c.campaignCreatureId).filter(Boolean) as number[])))

  const [srdCreatures, campCreatures] = await Promise.all([
    srdIds.length > 0
      ? prisma.srdCreature.findMany({ where: { id: { in: srdIds } }, select: { id: true, name: true, CR: true, AC: true, HPAverage: true, creatureType: true, size: true } })
      : [],
    campIds.length > 0
      ? prisma.campaignCreature.findMany({ where: { id: { in: campIds } }, select: { id: true, name: true, CR: true, AC: true, HPAverage: true, xpValue: true } })
      : [],
  ])

  const srdMap = Object.fromEntries(srdCreatures.map(c => [c.id, c]))
  const campMap = Object.fromEntries(campCreatures.map(c => [c.id, c]))

  const enriched = encounters.map(enc => ({
    ...enc,
    creatures: enc.creatures.map(c => ({
      ...c,
      srdCreature: c.srdCreatureId ? (srdMap[c.srdCreatureId] ?? null) : null,
      campaignCreature: c.campaignCreatureId ? (campMap[c.campaignCreatureId] ?? null) : null,
    })),
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const body = await request.json()
  const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const encounter = await prisma.encounter.create({
    data: {
      projectId: project.id,
      name: body.name,
      encounterType: body.encounterType ?? 'combat',
      difficulty: body.difficulty ?? 'medium',
      readAloud: body.readAloud ?? '',
      summary: body.summary ?? '',
      tactics: body.tactics ?? '',
      dmNotes: body.dmNotes ?? '',
      locationId: body.locationId ?? null,
      keyedAreaId: body.keyedAreaId ?? null,
      rewardText: body.rewardText ?? '',
      trapTrigger: body.trapTrigger ?? '',
      detectionDC: body.detectionDC ?? null,
      disarmDC: body.disarmDC ?? null,
      trapEffect: body.trapEffect ?? '',
      trapReset: body.trapReset ?? '',
    },
  })
  return NextResponse.json(encounter)
}
