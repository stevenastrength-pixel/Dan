export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { callAnthropicWithTools, callOpenAIWithTools, callOpenClawWithTools, type ToolDef } from '@/lib/ai'

// ─── Crawler AI tools ────────────────────────────────────────────────────────

const CRAWLER_TOOLS: ToolDef[] = [
  {
    name: 'narrate',
    description: 'Add a narration entry to the play log. Use for describing rooms, events, atmosphere.',
    input_schema: { type: 'object', properties: { text: { type: 'string', description: 'Narration text in second person.' } }, required: ['text'] },
  },
  {
    name: 'npc_dialogue',
    description: 'Add NPC dialogue to the play log.',
    input_schema: { type: 'object', properties: { npcName: { type: 'string' }, text: { type: 'string' } }, required: ['npcName', 'text'] },
  },
  {
    name: 'move_party',
    description: 'Move the party to a different keyed area. Call this when players choose to move.',
    input_schema: { type: 'object', properties: { keyedAreaId: { type: 'number', description: 'The id of the keyed area to move to.' }, locationId: { type: 'number', description: 'The parent location id.' } }, required: ['keyedAreaId', 'locationId'] },
  },
  {
    name: 'trigger_combat',
    description: 'Start combat with monsters from an encounter. Rolls initiative for all combatants.',
    input_schema: {
      type: 'object',
      properties: {
        encounterId: { type: 'number', description: 'The encounter to load monsters from (optional — can add monsters manually).' },
        monsters: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, maxHP: { type: 'number' }, AC: { type: 'number' }, initiative: { type: 'number' }, srdCreatureId: { type: 'number' }, campaignCreatureId: { type: 'number' } } }, description: 'Monsters to add to combat.' },
        description: { type: 'string', description: 'Brief combat opening narration.' },
      },
      required: ['monsters', 'description'],
    },
  },
  {
    name: 'resolve_attack',
    description: 'Resolve a player attack against a target. Provide the roll and damage; Daneel applies the result.',
    input_schema: {
      type: 'object',
      properties: {
        attackerName: { type: 'string' },
        targetName: { type: 'string' },
        targetId: { type: 'number', description: 'PlayRunCombatant id of the target.' },
        attackRoll: { type: 'number', description: 'Total attack roll (d20 + modifiers).' },
        targetAC: { type: 'number' },
        damage: { type: 'number', description: 'Damage to apply if hit.' },
        damageType: { type: 'string' },
        narrative: { type: 'string', description: 'One sentence describing the attack.' },
      },
      required: ['attackerName', 'targetName', 'targetId', 'attackRoll', 'targetAC', 'damage', 'narrative'],
    },
  },
  {
    name: 'monster_action',
    description: 'Take a monster action — attack a player or use an ability. Daneel resolves damage.',
    input_schema: {
      type: 'object',
      properties: {
        monsterId: { type: 'number', description: 'PlayRunCombatant id of the acting monster.' },
        monsterName: { type: 'string' },
        targetPlayerId: { type: 'number', description: 'PlayRunPlayer id of the target player.' },
        targetName: { type: 'string' },
        attackRoll: { type: 'number' },
        targetAC: { type: 'number' },
        damage: { type: 'number' },
        narrative: { type: 'string' },
      },
      required: ['monsterId', 'monsterName', 'targetPlayerId', 'targetName', 'attackRoll', 'targetAC', 'damage', 'narrative'],
    },
  },
  {
    name: 'resolve_skill_check',
    description: 'Ask a player to roll a skill check and determine success/failure.',
    input_schema: {
      type: 'object',
      properties: {
        playerId: { type: 'number', description: 'PlayRunPlayer id.' },
        playerName: { type: 'string' },
        skill: { type: 'string', description: 'e.g. Perception, Stealth, Persuasion.' },
        dc: { type: 'number' },
        roll: { type: 'number', description: 'The total roll result.' },
        success: { type: 'boolean' },
        narrative: { type: 'string', description: 'What happens as a result.' },
      },
      required: ['playerName', 'skill', 'dc', 'roll', 'success', 'narrative'],
    },
  },
  {
    name: 'award_xp',
    description: 'Award XP to all players after defeating an encounter or completing a quest objective.',
    input_schema: { type: 'object', properties: { amount: { type: 'number', description: 'XP per player.' }, reason: { type: 'string' } }, required: ['amount', 'reason'] },
  },
  {
    name: 'award_loot',
    description: 'Give the party loot (items or currency).',
    input_schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'string' }, description: 'Item names.' },
        gp: { type: 'number' },
        narrative: { type: 'string' },
      },
      required: ['narrative'],
    },
  },
  {
    name: 'mark_explored',
    description: 'Mark a keyed area as explored and optionally an encounter as cleared.',
    input_schema: { type: 'object', properties: { keyedAreaId: { type: 'number' }, encounterId: { type: 'number' } }, required: ['keyedAreaId'] },
  },
  {
    name: 'advance_quest',
    description: 'Update a quest status.',
    input_schema: { type: 'object', properties: { questId: { type: 'number' }, newStatus: { type: 'string', description: 'active | complete | failed' }, narrative: { type: 'string' } }, required: ['questId', 'newStatus', 'narrative'] },
  },
  {
    name: 'end_combat',
    description: 'End combat, clear combatants from the run.',
    input_schema: { type: 'object', properties: { narrative: { type: 'string', description: 'Victory/conclusion narration.' } }, required: ['narrative'] },
  },
  {
    name: 'player_death',
    description: 'Trigger the death handling flow for a player.',
    input_schema: { type: 'object', properties: { playerId: { type: 'number' }, playerName: { type: 'string' }, narrative: { type: 'string' } }, required: ['playerId', 'playerName', 'narrative'] },
  },
]

// ─── Tool handler ─────────────────────────────────────────────────────────────

async function handleCrawlerTool(name: string, input: Record<string, unknown>, runId: number): Promise<string> {

  if (name === 'narrate') {
    await prisma.playRunLog.create({ data: { runId, type: 'narration', content: String(input.text) } })
    return 'Narration logged.'
  }

  if (name === 'npc_dialogue') {
    await prisma.playRunLog.create({ data: { runId, type: 'dialogue', content: String(input.text), speakerName: String(input.npcName) } })
    return 'Dialogue logged.'
  }

  if (name === 'move_party') {
    const keyedAreaId = Number(input.keyedAreaId)
    const locationId = Number(input.locationId)
    const area = await prisma.keyedArea.findUnique({ where: { id: keyedAreaId }, include: { location: true } })
    if (!area) return `Error: keyed area ${keyedAreaId} not found.`
    await prisma.playRun.update({ where: { id: runId }, data: { currentKeyedAreaId: keyedAreaId, currentLocationId: locationId } })
    await prisma.playRunLog.create({ data: { runId, type: 'system', content: `The party moves to: **${area.title}** (${area.location.name})` } })
    const readAloud = area.readAloud?.trim()
    if (readAloud) {
      await prisma.playRunLog.create({ data: { runId, type: 'narration', content: readAloud } })
    }
    return `Party moved to "${area.title}". Read aloud delivered.`
  }

  if (name === 'trigger_combat') {
    const monsters = (input.monsters as Array<{ name: string; maxHP: number; AC: number; initiative: number; srdCreatureId?: number; campaignCreatureId?: number }>) ?? []
    await prisma.playRun.update({ where: { id: runId }, data: { inCombat: true, roundNumber: 1 } })
    // Add monster combatants
    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i]
      await prisma.playRunCombatant.create({
        data: {
          runId,
          name: m.name,
          type: 'monster',
          initiative: m.initiative ?? Math.floor(Math.random() * 20) + 1,
          sortOrder: i,
          currentHP: m.maxHP,
          maxHP: m.maxHP,
          AC: m.AC,
          srdCreatureId: m.srdCreatureId ?? null,
          campaignCreatureId: m.campaignCreatureId ?? null,
        },
      })
    }
    await prisma.playRunLog.create({ data: { runId, type: 'combat', content: String(input.description) } })
    return `Combat started with ${monsters.length} monsters.`
  }

  if (name === 'resolve_attack') {
    const { attackerName, targetName, targetId, attackRoll, targetAC, damage, narrative } = input as { attackerName: string; targetName: string; targetId: number; attackRoll: number; targetAC: number; damage: number; narrative: string }
    const hit = attackRoll >= targetAC
    let result = ''
    if (hit) {
      const combatant = await prisma.playRunCombatant.findUnique({ where: { id: targetId } })
      if (combatant) {
        const newHP = Math.max(0, combatant.currentHP - damage)
        await prisma.playRunCombatant.update({ where: { id: targetId }, data: { currentHP: newHP, isDefeated: newHP === 0 } })
        result = `Hit! ${damage} damage. ${targetName} HP: ${newHP}/${combatant.maxHP}${newHP === 0 ? ' — DEFEATED' : ''}`
      }
    } else {
      result = `Miss (rolled ${attackRoll} vs AC ${targetAC}).`
    }
    await prisma.playRunLog.create({ data: { runId, type: 'combat', content: `${narrative} ${result}` } })
    return result
  }

  if (name === 'monster_action') {
    const { monsterId, monsterName, targetPlayerId, targetName, attackRoll, targetAC, damage, narrative } = input as { monsterId: number; monsterName: string; targetPlayerId: number; targetName: string; attackRoll: number; targetAC: number; damage: number; narrative: string }
    const hit = attackRoll >= targetAC
    let result = ''
    if (hit) {
      const player = await prisma.playRunPlayer.findUnique({ where: { id: targetPlayerId } })
      if (player) {
        const newHP = Math.max(0, player.currentHP - damage)
        await prisma.playRunPlayer.update({ where: { id: targetPlayerId }, data: { currentHP: newHP, deathState: newHP === 0 ? 'unconscious' : 'alive' } })
        result = `Hit! ${damage} damage to ${targetName}. HP: ${newHP}/${player.maxHP}${newHP === 0 ? ' — UNCONSCIOUS' : ''}`
      }
    } else {
      result = `${monsterName} misses (rolled ${attackRoll} vs AC ${targetAC}).`
    }
    await prisma.playRunLog.create({ data: { runId, type: 'combat', content: `${narrative} ${result}` } })
    return result
  }

  if (name === 'resolve_skill_check') {
    const { playerName, skill, dc, roll, success, narrative } = input as { playerName: string; skill: string; dc: number; roll: number; success: boolean; narrative: string }
    const content = `**${playerName}** rolls ${skill} (DC ${dc}): **${roll}** — ${success ? 'Success!' : 'Failure.'} ${narrative}`
    await prisma.playRunLog.create({ data: { runId, type: 'skill', content } })
    return `Skill check logged: ${success ? 'success' : 'failure'}.`
  }

  if (name === 'award_xp') {
    const amount = Number(input.amount)
    const players = await prisma.playRunPlayer.findMany({ where: { runId, isActive: true } })
    for (const p of players) {
      await prisma.playRunPlayer.update({ where: { id: p.id }, data: { xp: p.xp + amount } })
    }
    await prisma.playRunLog.create({ data: { runId, type: 'system', content: `+${amount} XP — ${String(input.reason)}` } })
    return `Awarded ${amount} XP to ${players.length} players.`
  }

  if (name === 'award_loot') {
    const items: string[] = (input.items as string[]) ?? []
    const gp = Number(input.gp ?? 0)
    let lootText = String(input.narrative)
    if (items.length > 0) lootText += ` Items: ${items.join(', ')}.`
    if (gp > 0) lootText += ` ${gp} gp.`
    await prisma.playRunLog.create({ data: { runId, type: 'loot', content: lootText } })
    return 'Loot logged.'
  }

  if (name === 'mark_explored') {
    const keyedAreaId = Number(input.keyedAreaId)
    const encounterId = input.encounterId ? Number(input.encounterId) : null
    try {
      await prisma.playRunExplored.create({ data: { runId, keyedAreaId, encounterId } })
    } catch { /* already explored — unique constraint */ }
    if (encounterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.encounter as any).update({ where: { id: encounterId }, data: { isPlaytested: true, playtestedAt: new Date() } })
    }
    return 'Area marked as explored.'
  }

  if (name === 'advance_quest') {
    const questId = Number(input.questId)
    await prisma.quest.update({ where: { id: questId }, data: { status: String(input.newStatus) } })
    await prisma.playRunLog.create({ data: { runId, type: 'system', content: `Quest updated: ${String(input.narrative)}` } })
    return 'Quest advanced.'
  }

  if (name === 'end_combat') {
    await prisma.playRun.update({ where: { id: runId }, data: { inCombat: false, roundNumber: 1 } })
    await prisma.playRunCombatant.updateMany({ where: { runId }, data: { isDefeated: true } })
    await prisma.playRunLog.create({ data: { runId, type: 'combat', content: String(input.narrative) } })
    return 'Combat ended.'
  }

  if (name === 'player_death') {
    const playerId = Number(input.playerId)
    await prisma.playRunPlayer.update({ where: { id: playerId }, data: { deathState: 'unconscious' } })
    await prisma.playRunLog.create({ data: { runId, type: 'death', content: String(input.narrative), speakerName: String(input.playerName) } })
    return 'Death state logged.'
  }

  return `Unknown tool: ${name}`
}

// ─── Build system prompt for crawler mode ────────────────────────────────────

async function buildCrawlerPrompt(project: { id: number; name: string; description?: string | null; minLevel?: number | null; maxLevel?: number | null; partySize?: number | null }, run: { id: number; currentKeyedAreaId?: number | null; currentLocationId?: number | null; inCombat: boolean; roundNumber: number }) {

  type Doc = { title: string; content: string }
  type Quest = { id: number; name: string; description: string | null }
  type Player = { characterName: string; username: string; currentHP: number; maxHP: number; tempHP: number; level: number; xp: number; deathState: string }
  type Combatant = { id: number; name: string; currentHP: number; maxHP: number; AC: number; initiative: number }
  type Explored = { keyedAreaId: number | null }

  const [documents, quests, players, combatants, explored] = await Promise.all([
    prisma.projectDocument.findMany({ where: { projectId: project.id } }) as Promise<Doc[]>,
    prisma.quest.findMany({ where: { projectId: project.id, status: 'active' }, take: 10 }) as Promise<Quest[]>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).playRunPlayer.findMany({ where: { runId: run.id, isActive: true } }) as Promise<Player[]>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).playRunCombatant.findMany({ where: { runId: run.id, isDefeated: false }, orderBy: [{ sortOrder: 'asc' }] }) as Promise<Combatant[]>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).playRunExplored.findMany({ where: { runId: run.id } }) as Promise<Explored[]>,
  ])

  // Current area context
  let areaContext = 'The party has not entered a specific area yet.'
  let connectionsContext = ''
  if (run.currentKeyedAreaId) {
    const area = await prisma.keyedArea.findUnique({
      where: { id: run.currentKeyedAreaId },
      include: { location: { include: { keyedAreas: { orderBy: { order: 'asc' }, select: { id: true, key: true, title: true } } } } },
    })
    if (area) {
      areaContext = `**Current Area:** ${area.key} — ${area.title} (${area.location.name})\n**Read Aloud:** ${area.readAloud ?? '(none)'}\n**DM Notes:** ${area.dmNotes ?? '(none)'}`
      const exploredIds = new Set(explored.map(e => e.keyedAreaId))
      const otherAreas = area.location.keyedAreas.filter(a => a.id !== area.id)
      if (otherAreas.length > 0) {
        connectionsContext = `\n**Other areas in ${area.location.name}:** ${otherAreas.map(a => `${a.key} — ${a.title} (id: ${a.id})${exploredIds.has(a.id) ? ' [explored]' : ''}`).join(', ')}`
      }
    }
  }

  // Party state
  const partyLines = players.map(p =>
    `- **${p.characterName}** (${p.username}): HP ${p.currentHP}/${p.maxHP}${p.tempHP > 0 ? `+${p.tempHP}tmp` : ''}, Level ${p.level}, XP ${p.xp}, ${p.deathState !== 'alive' ? `**${p.deathState.toUpperCase()}**` : 'alive'}`
  ).join('\n')

  // Combat state
  const combatLines = run.inCombat && combatants.length > 0
    ? `\n## Combat (Round ${run.roundNumber})\n` + combatants.map(c => `- ${c.name} (id: ${c.id}): HP ${c.currentHP}/${c.maxHP}, AC ${c.AC}, initiative ${c.initiative}`).join('\n')
    : ''

  // Campaign docs (trimmed)
  const MAX = 2000
  const docText = documents.filter(d => d.content.trim()).map(d => {
    const body = d.content.length > MAX ? d.content.slice(0, MAX) + '\n…(truncated)' : d.content
    return `## ${d.title}\n${body}`
  }).join('\n\n---\n\n')

  // Active quests
  const questLines = quests.length > 0
    ? quests.map(q => `- **${q.name}** (id: ${q.id}): ${q.description?.slice(0, 80) ?? ''}`).join('\n')
    : 'No active quests.'

  return `You are Daneel, the DM running the campaign "${project.name}" for a group of players.

Your job: narrate the campaign, respond to player actions, run combat, and guide the story. You have full access to all campaign content — use it faithfully.

## RULES
- Narrate in second person ("You enter the chamber…")
- Use the Read Aloud text verbatim (or lightly adapted) when the party enters a new area — deliver it via the narrate tool
- NEVER reveal DM Notes to players — use them only for internal reasoning
- Be concise in combat; more descriptive in exploration
- ALWAYS call tools to change game state — never just describe it in prose
- When players move to a new area, call move_party first, then narrate
- When combat starts, call trigger_combat immediately
- When a monster attacks, call monster_action to apply damage
- When a player attacks, resolve_attack to apply the result
- When combat ends, call end_combat

## Campaign Info
${project.description ?? ''}
Level range: ${project.minLevel ?? 1}–${project.maxLevel ?? 10}

## Current Location
${areaContext}${connectionsContext}${combatLines}

## Party
${partyLines}

## Active Quests
${questLines}

## Campaign Documents
${docText}`
}

// ─── POST: player sends an action ────────────────────────────────────────────

export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const run = await prisma.playRun.findFirst({ where: { projectId: project.id, state: 'active' } })
  if (!run) return NextResponse.json({ error: 'No active run' }, { status: 404 })

  const settings = await prisma.settings.findFirst()
  if (!settings?.aiApiKey && settings?.aiProvider !== 'openclaw') {
    return NextResponse.json({ error: 'No API key configured.' }, { status: 400 })
  }

  const body = await request.json()
  const playerText: string = body.text ?? ''
  const partyOnly: boolean = body.partyOnly === true

  // Log player message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const player = await (prisma as any).playRunPlayer.findFirst({ where: { runId: run.id, username: user.username } }) as { id: number; characterName: string } | null
  await (prisma as any).playRunLog.create({
    data: {
      runId: run.id,
      type: partyOnly ? 'dialogue' : 'system',
      content: playerText,
      speakerName: player?.characterName ?? user.username,
    },
  })

  // Party-only: skip AI, just return updated run
  if (partyOnly) {
    const updated = await (prisma as any).playRun.findUnique({
      where: { id: run.id },
      include: {
        players: true,
        combatants: { orderBy: [{ sortOrder: 'asc' }, { initiative: 'desc' }] },
        log: { orderBy: { createdAt: 'asc' }, take: 100 },
        explored: true,
      },
    })
    return NextResponse.json(updated)
  }

  // Build context and recent log for AI
  type LogRow = { id: number; type: string; content: string; speakerName: string; createdAt: Date }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentLog: LogRow[] = await ((prisma as any).playRunLog.findMany({
    where: { runId: run.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  }) as Promise<LogRow[]>).then((r: LogRow[]) => r.reverse())

  const systemPrompt = await buildCrawlerPrompt(project as Parameters<typeof buildCrawlerPrompt>[0], run)

  // Build message history from recent log
  const aiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const entry of recentLog) {
    if (entry.speakerName && entry.speakerName !== 'Daneel' && entry.type === 'system') {
      aiMessages.push({ role: 'user', content: `${entry.speakerName}: ${entry.content}` })
    } else if (entry.type === 'narration' || entry.type === 'dialogue' || entry.type === 'combat' || entry.type === 'loot' || entry.type === 'skill' || entry.type === 'death') {
      aiMessages.push({ role: 'assistant', content: entry.content })
    }
  }
  // Ensure final message is the player's action
  if (aiMessages.length === 0 || aiMessages[aiMessages.length - 1].role !== 'user') {
    aiMessages.push({ role: 'user', content: `${player?.characterName ?? user.username}: ${playerText}` })
  }

  const provider = (settings?.aiProvider ?? 'anthropic') as 'anthropic' | 'openai' | 'openclaw'
  const aiModel = settings?.aiModel?.trim()

  try {
    let finalText = ''

    if (!aiModel && provider !== 'openclaw') {
      await prisma.playRunLog.create({ data: { runId: run.id, type: 'system', content: '(No AI model configured. Go to Settings and set a model.)' } })
      return NextResponse.json({ ok: true })
    }

    const onToolCall = async (toolName: string, toolInput: Record<string, unknown>) => {
      return await handleCrawlerTool(toolName, toolInput, run.id)
    }

    if (provider === 'anthropic') {
      const result = await callAnthropicWithTools({ messages: aiMessages, systemPrompt, tools: CRAWLER_TOOLS, apiKey: settings!.aiApiKey!, model: aiModel!, onToolCall })
      finalText = result.text
    } else if (provider === 'openai') {
      const result = await callOpenAIWithTools({ messages: aiMessages, systemPrompt, tools: CRAWLER_TOOLS, apiKey: settings!.aiApiKey!, model: aiModel!, onToolCall })
      finalText = result.text
    } else {
      const result = await callOpenClawWithTools({ messages: aiMessages, systemPrompt, tools: CRAWLER_TOOLS, openClawBaseUrl: settings!.openClawBaseUrl!, context: { project: { id: project.id, slug: params.projectSlug, name: project.name }, documents: [], characters: [], worldEntries: [], styleGuide: '' }, onToolCall })
      finalText = result.text
    }

    // Log Daneel's final text response if present
    if (finalText?.trim()) {
      await prisma.playRunLog.create({ data: { runId: run.id, type: 'narration', content: finalText.trim(), speakerName: 'Daneel' } })
    }
  } catch (err) {
    console.error('[Crawler AI error]', err)
    await prisma.playRunLog.create({ data: { runId: run.id, type: 'system', content: `(Daneel encountered an error: ${err instanceof Error ? err.message : 'Unknown'})` } })
  }

  // Return updated run
  const updated = await prisma.playRun.findUnique({
    where: { id: run.id },
    include: {
      players: true,
      combatants: { orderBy: [{ sortOrder: 'asc' }, { initiative: 'desc' }] },
      log: { orderBy: { createdAt: 'asc' }, take: 100 },
      explored: true,
    },
  })
  return NextResponse.json(updated)
}
