export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sheet = await prisma.characterSheet.findFirst({
    where: { projectId: project.id, username: user.username },
  })

  return NextResponse.json(sheet ?? null)
}

export async function PUT(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()

  // Find existing sheet
  const existing = await prisma.characterSheet.findFirst({
    where: { projectId: project.id, username: user.username },
  })

  const data = {
    characterName: body.characterName ?? 'Unnamed Adventurer',
    className: body.className ?? '',
    subclass: body.subclass ?? '',
    race: body.race ?? '',
    background: body.background ?? '',
    alignment: body.alignment ?? '',
    level: Number(body.level ?? 1),
    xp: Number(body.xp ?? 0),
    STR: Number(body.STR ?? 10),
    DEX: Number(body.DEX ?? 10),
    CON: Number(body.CON ?? 10),
    INT: Number(body.INT ?? 10),
    WIS: Number(body.WIS ?? 10),
    CHA: Number(body.CHA ?? 10),
    maxHP: Number(body.maxHP ?? 10),
    currentHP: Number(body.currentHP ?? body.maxHP ?? 10),
    tempHP: Number(body.tempHP ?? 0),
    AC: Number(body.AC ?? 10),
    speed: Number(body.speed ?? 30),
    proficiencyBonus: Number(body.proficiencyBonus ?? 2),
    initiative: Number(body.initiative ?? 0),
    inspiration: Boolean(body.inspiration),
    savingThrowProfs: typeof body.savingThrowProfs === 'string' ? body.savingThrowProfs : JSON.stringify(body.savingThrowProfs ?? {}),
    skillProfs: typeof body.skillProfs === 'string' ? body.skillProfs : JSON.stringify(body.skillProfs ?? {}),
    deathSaveSuccesses: Number(body.deathSaveSuccesses ?? 0),
    deathSaveFailures: Number(body.deathSaveFailures ?? 0),
    attacks: typeof body.attacks === 'string' ? body.attacks : JSON.stringify(body.attacks ?? []),
    spellSlots: typeof body.spellSlots === 'string' ? body.spellSlots : JSON.stringify(body.spellSlots ?? {}),
    spellsPrepared: typeof body.spellsPrepared === 'string' ? body.spellsPrepared : JSON.stringify(body.spellsPrepared ?? []),
    inventory: typeof body.inventory === 'string' ? body.inventory : JSON.stringify(body.inventory ?? []),
    currency: typeof body.currency === 'string' ? body.currency : JSON.stringify(body.currency ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
    features: typeof body.features === 'string' ? body.features : JSON.stringify(body.features ?? []),
    personalityTraits: body.personalityTraits ?? '',
    ideals: body.ideals ?? '',
    bonds: body.bonds ?? '',
    flaws: body.flaws ?? '',
    backstory: body.backstory ?? '',
    conditions: typeof body.conditions === 'string' ? body.conditions : JSON.stringify(body.conditions ?? []),
  }

  const sheet = existing
    ? await prisma.characterSheet.update({ where: { id: existing.id }, data })
    : await prisma.characterSheet.create({ data: { ...data, projectId: project.id, username: user.username } })

  // Auto-link sheet to the party member record if one exists
  const partyMember = await prisma.partyMember.findUnique({
    where: { projectId_username: { projectId: project.id, username: user.username } },
  })
  if (partyMember && partyMember.characterSheetId !== sheet.id) {
    await prisma.partyMember.update({
      where: { projectId_username: { projectId: project.id, username: user.username } },
      data: { characterSheetId: sheet.id },
    })
  }

  return NextResponse.json(sheet)
}
