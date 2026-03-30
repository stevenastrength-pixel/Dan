export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

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
  const isNewRun = !run
  if (!run) {
    // Find starting location
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

    // Generate cinematic opening intro
    try {
      const settings = await prisma.settings.findFirst()
      const provider = settings?.aiProvider ?? 'anthropic'
      const aiModel = settings?.aiModel?.trim()

      if (aiModel || provider === 'openclaw') {
        const documents = await prisma.projectDocument.findMany({ where: { projectId: project.id }, take: 3 })
        const docSummary = documents.filter(d => d.content.trim())
          .map(d => `${d.title}: ${d.content.slice(0, 500)}`).join('\n\n')

        let startingAreaContext = ''
        if (firstLocation) {
          const firstArea = await prisma.keyedArea.findFirst({
            where: { locationId: firstLocation.id },
            orderBy: { order: 'asc' },
          })
          if (firstArea?.readAloud) startingAreaContext = `\nOpening scene: ${firstArea.readAloud}`
        }

        const p = project as { description?: string | null; minLevel?: number | null; maxLevel?: number | null }
        const introPrompt = `You are Daneel, the DM for the campaign "${project.name}".
${p.description ? `Campaign premise: ${p.description}` : ''}
Level range: ${p.minLevel ?? 1}–${p.maxLevel ?? 10}
${docSummary ? `\nCampaign lore:\n${docSummary}` : ''}
${startingAreaContext}

Write a dramatic, atmospheric campaign opening — like the first page of a novel or the opening crawl of a film. It should:
- Set the world, tone, and stakes in 2-3 vivid paragraphs
- End with a scene-setting sentence that places the players at the threshold of their first adventure
- Be written in second person ("You are…", "The world around you…")
- NOT include any instructions, questions, or game mechanics — pure atmosphere and scene-setting only`

        let introText = ''

        if (provider === 'openclaw') {
          const baseUrl = (settings?.openClawBaseUrl ?? '').replace(/\/$/, '')
          const responsesUrl = baseUrl.endsWith('/v1/responses') ? baseUrl
            : baseUrl.endsWith('/v1') ? baseUrl + '/responses'
            : baseUrl + '/v1/responses'
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (settings?.openClawApiKey) headers['Authorization'] = `Bearer ${settings.openClawApiKey}`
          const res = await fetch(responsesUrl, {
            method: 'POST', headers,
            body: JSON.stringify({ model: 'openclaw', instructions: introPrompt, input: 'Begin.', max_output_tokens: 600 }),
          })
          if (res.ok) {
            const data = await res.json()
            const output = Array.isArray(data.output) ? data.output : []
            for (const item of output) {
              const c = Array.isArray(item.content) ? item.content : []
              for (const block of c) {
                if ((block.type === 'output_text' || block.type === 'text') && block.text) { introText = block.text; break }
              }
              if (introText) break
              if (typeof item.content === 'string' && item.content) { introText = item.content; break }
            }
            if (!introText && data.output_text) introText = data.output_text
          }
        } else if (provider === 'openai') {
          const openai = new OpenAI({ apiKey: settings!.aiApiKey! })
          const resp = await openai.chat.completions.create({
            model: aiModel!,
            messages: [{ role: 'system', content: introPrompt }, { role: 'user', content: 'Begin.' }],
            max_tokens: 600,
          })
          introText = resp.choices[0]?.message?.content ?? ''
        } else {
          const anthropic = new Anthropic({ apiKey: settings!.aiApiKey! })
          const resp = await anthropic.messages.create({
            model: aiModel!, max_tokens: 600,
            system: introPrompt,
            messages: [{ role: 'user', content: 'Begin.' }],
          })
          introText = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
        }

        if (introText.trim()) {
          await prisma.playRunLog.create({
            data: { runId: run.id, type: 'intro', content: introText.trim(), speakerName: 'Daneel' },
          })
        }
      }
    } catch (err) {
      console.error('[Intro generation error]', err)
      // Non-fatal — run continues without intro
    }
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
