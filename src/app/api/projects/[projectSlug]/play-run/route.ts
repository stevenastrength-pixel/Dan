export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

// GET: fetch active run with players, log (last 100), combatants
export async function GET(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const run = await prisma.playRun.findFirst({
    where: { projectId: project.id, state: 'active' },
    include: {
      players: true,
      combatants: { orderBy: [{ sortOrder: 'asc' }, { initiative: 'desc' }] },
      log: { orderBy: { createdAt: 'asc' }, take: 100 },
      explored: true,
    },
  })

  return NextResponse.json(run ?? null)
}

// POST: join or create the active run
export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify user is a party member with a character sheet
  const partyMember = await prisma.partyMember.findFirst({
    where: { projectId: project.id, username: user.username },
    include: { characterSheet: true },
  })
  if (!partyMember) return NextResponse.json({ error: 'You are not in the party for this campaign.' }, { status: 403 })
  if (!partyMember.characterSheet) return NextResponse.json({ error: 'You need a character sheet to play.' }, { status: 400 })

  const sheet = partyMember.characterSheet

  // Get or create active run
  let run = await prisma.playRun.findFirst({ where: { projectId: project.id, state: 'active' } })
  if (!run) {
    // Find starting location (first keyed area with order = 0, or just any location)
    const firstLocation = await prisma.location.findFirst({
      where: { projectId: project.id, parentLocationId: null },
      orderBy: { name: 'asc' },
    })
    run = await prisma.playRun.create({
      data: {
        projectId: project.id,
        name: `${project.name} — Adventure`,
        currentLocationId: firstLocation?.id ?? null,
      },
    })
  }

  // Join run if not already in it
  const existing = await prisma.playRunPlayer.findFirst({ where: { runId: run.id, username: user.username } })
  if (!existing) {
    let spellSlots: Record<string, unknown> = {}
    try { spellSlots = JSON.parse(sheet.spellSlots) } catch {}

    await prisma.playRunPlayer.create({
      data: {
        runId: run.id,
        username: user.username,
        characterSheetId: sheet.id,
        characterName: sheet.characterName,
        currentHP: sheet.currentHP,
        maxHP: sheet.maxHP,
        tempHP: sheet.tempHP,
        level: sheet.level,
        xp: sheet.xp,
        spellSlots: JSON.stringify(spellSlots),
        inventory: sheet.inventory,
      },
    })

    // Add welcome log entry
    await prisma.playRunLog.create({
      data: {
        runId: run.id,
        type: 'system',
        content: `${sheet.characterName} (${user.username}) has joined the adventure.`,
      },
    })
  }

  // Return full run
  const full = await prisma.playRun.findUnique({
    where: { id: run.id },
    include: {
      players: true,
      combatants: { orderBy: [{ sortOrder: 'asc' }, { initiative: 'desc' }] },
      log: { orderBy: { createdAt: 'asc' }, take: 100 },
      explored: true,
    },
  })
  return NextResponse.json(full)
}

// PATCH: update run state (currentKeyedAreaId, inCombat, roundNumber, state)
export async function PATCH(request: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const run = await prisma.playRun.findFirst({ where: { projectId: project.id, state: 'active' } })
  if (!run) return NextResponse.json({ error: 'No active run' }, { status: 404 })

  const body = await request.json()
  const updated = await prisma.playRun.update({
    where: { id: run.id },
    data: {
      ...(body.currentLocationId !== undefined && { currentLocationId: body.currentLocationId }),
      ...(body.currentKeyedAreaId !== undefined && { currentKeyedAreaId: body.currentKeyedAreaId }),
      ...(body.inCombat !== undefined && { inCombat: body.inCombat }),
      ...(body.roundNumber !== undefined && { roundNumber: body.roundNumber }),
      ...(body.state !== undefined && { state: body.state }),
    },
    include: {
      players: true,
      combatants: { orderBy: [{ sortOrder: 'asc' }, { initiative: 'desc' }] },
      log: { orderBy: { createdAt: 'asc' }, take: 100 },
      explored: true,
    },
  })
  return NextResponse.json(updated)
}

// DELETE: end (wipe) the active run
export async function DELETE(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.playRun.updateMany({
    where: { projectId: project.id, state: 'active' },
    data: { state: 'wiped' },
  })
  return NextResponse.json({ ok: true })
}
