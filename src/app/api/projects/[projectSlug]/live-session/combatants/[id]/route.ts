export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH: update a combatant (HP, conditions, initiative, spell slots, etc.)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await request.json()

  const data: Record<string, unknown> = {}
  if (body.currentHP !== undefined)  data.currentHP = Number(body.currentHP)
  if (body.maxHP !== undefined)      data.maxHP = Number(body.maxHP)
  if (body.tempHP !== undefined)     data.tempHP = Number(body.tempHP)
  if (body.AC !== undefined)         data.AC = Number(body.AC)
  if (body.speed !== undefined)      data.speed = Number(body.speed)
  if (body.initiative !== undefined) data.initiative = Number(body.initiative)
  if (body.sortOrder !== undefined)  data.sortOrder = Number(body.sortOrder)
  if (body.inspiration !== undefined) data.inspiration = Boolean(body.inspiration)
  if (body.deathSaveSuccesses !== undefined) data.deathSaveSuccesses = Number(body.deathSaveSuccesses)
  if (body.deathSaveFailures !== undefined)  data.deathSaveFailures = Number(body.deathSaveFailures)
  if (body.notes !== undefined)  data.notes = String(body.notes)
  if (body.name !== undefined)   data.name = String(body.name)
  if (body.conditions !== undefined) {
    data.conditions = typeof body.conditions === 'string' ? body.conditions : JSON.stringify(body.conditions)
  }
  if (body.spellSlots !== undefined) {
    data.spellSlots = typeof body.spellSlots === 'string' ? body.spellSlots : JSON.stringify(body.spellSlots)
  }

  const combatant = await prisma.combatant.update({ where: { id }, data })
  return NextResponse.json(combatant)
}

// DELETE: remove a combatant
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await prisma.combatant.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ ok: true })
}
