export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectSlug = searchParams.get('projectSlug')
  if (!projectSlug) return NextResponse.json({ error: 'projectSlug required' }, { status: 400 })
  const project = await prisma.project.findUnique({ where: { slug: projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const creatures = await prisma.campaignCreature.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(creatures)
}

export async function POST(request: Request) {
  const body = await request.json()
  const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const creature = await prisma.campaignCreature.create({
    data: {
      projectId: project.id,
      name: body.name,
      size: body.size ?? '',
      creatureType: body.creatureType ?? '',
      alignment: body.alignment ?? '',
      CR: body.CR ?? '0',
      xpValue: body.xpValue ?? 0,
      isHomebrew: body.isHomebrew ?? true,
      AC: body.AC ?? 10,
      acType: body.acType ?? '',
      HPDice: body.HPDice ?? '',
      HPAverage: body.HPAverage ?? 1,
      speed: body.speed ? JSON.stringify(body.speed) : '{}',
      STR: body.STR ?? 10,
      DEX: body.DEX ?? 10,
      CON: body.CON ?? 10,
      INT: body.INT ?? 10,
      WIS: body.WIS ?? 10,
      CHA: body.CHA ?? 10,
      savingThrows: JSON.stringify(body.savingThrows ?? []),
      skills: JSON.stringify(body.skills ?? []),
      damageResistances: JSON.stringify(body.damageResistances ?? []),
      damageImmunities: JSON.stringify(body.damageImmunities ?? []),
      damageVulnerabilities: JSON.stringify(body.damageVulnerabilities ?? []),
      conditionImmunities: JSON.stringify(body.conditionImmunities ?? []),
      senses: body.senses ?? '',
      languages: body.languages ?? '',
      legendaryResistances: body.legendaryResistances ?? 0,
      isLegendary: body.isLegendary ?? false,
      hasLairActions: body.hasLairActions ?? false,
      traits: JSON.stringify(body.traits ?? []),
      actions: JSON.stringify(body.actions ?? []),
      bonusActions: JSON.stringify(body.bonusActions ?? []),
      reactions: JSON.stringify(body.reactions ?? []),
      legendaryActions: JSON.stringify(body.legendaryActions ?? []),
      lairActions: JSON.stringify(body.lairActions ?? []),
    },
  })
  return NextResponse.json(creature)
}
