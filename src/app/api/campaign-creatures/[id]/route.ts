export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const creature = await prisma.campaignCreature.findUnique({ where: { id: parseInt(params.id) } })
  if (!creature) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(creature)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const jsonFields = ['speed','savingThrows','skills','damageResistances','damageImmunities','damageVulnerabilities','conditionImmunities','traits','actions','bonusActions','reactions','legendaryActions','lairActions']
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue
    data[k] = jsonFields.includes(k) ? JSON.stringify(v) : v
  }
  const creature = await prisma.campaignCreature.update({ where: { id: parseInt(params.id) }, data })
  return NextResponse.json(creature)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.campaignCreature.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
