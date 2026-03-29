export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST: add a combatant to the active session
export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const session = await prisma.liveSession.findFirst({
    where: { projectId: project.id, isActive: true },
  })
  if (!session) return NextResponse.json({ error: 'No active session' }, { status: 404 })

  const body = await request.json()

  // sortOrder = max existing + 1
  const maxOrder = await prisma.combatant.aggregate({
    where: { sessionId: session.id },
    _max: { sortOrder: true },
  })

  const combatant = await prisma.combatant.create({
    data: {
      sessionId: session.id,
      name: body.name ?? 'Unknown',
      type: body.type ?? 'monster',
      initiative: body.initiative ?? 0,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      currentHP: body.currentHP ?? body.maxHP ?? 10,
      maxHP: body.maxHP ?? 10,
      tempHP: body.tempHP ?? 0,
      AC: body.AC ?? 10,
      speed: body.speed ?? 30,
      conditions: '[]',
      spellSlots: typeof body.spellSlots === 'string' ? body.spellSlots : JSON.stringify(body.spellSlots ?? {}),
      inspiration: body.inspiration ?? false,
      deathSaveSuccesses: body.deathSaveSuccesses ?? 0,
      deathSaveFailures: body.deathSaveFailures ?? 0,
      notes: body.notes ?? '',
      characterSheetId: body.characterSheetId ?? null,
      srdCreatureId: body.srdCreatureId ?? null,
      campaignCreatureId: body.campaignCreatureId ?? null,
    },
  })

  return NextResponse.json(combatant)
}
