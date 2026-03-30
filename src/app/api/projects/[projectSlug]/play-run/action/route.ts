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
  {
    name: 'yield_turn',
    description: 'Hand control back to the players after resolving a round or when you need their next action. Call this AFTER narrate, not before. The prompt must be a single short sentence — never a menu, never a list of options.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'ONE sentence handed to players, e.g. "The goblin staggers — what do you do?" or "Round 2 — declare your action." Never list options.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'roll_dice',
    description: 'Roll dice and get a true random result from the server. ALWAYS call this before any attack (resolve_attack or monster_action) to get the real rolled numbers. Never guess or invent roll results yourself.',
    input_schema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of dice (e.g. 1 for 1d20, 2 for 2d6).' },
        sides: { type: 'number', description: 'Sides per die (e.g. 20 for d20, 8 for d8, 6 for d6).' },
        modifier: { type: 'number', description: 'Flat modifier to add to the total (e.g. attack bonus or damage modifier). Omit or use 0 if none.' },
        purpose: { type: 'string', description: 'Brief label for this roll, e.g. "attack roll", "damage roll", "monster attack".' },
      },
      required: ['count', 'sides'],
    },
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

  if (name === 'yield_turn') {
    // Enforce a single-sentence prompt — strip anything after the first newline or bullet
    let prompt = String(input.prompt ?? 'What do you do?')
    prompt = prompt.split('\n')[0].split(' - ')[0].trim()
    if (!prompt) prompt = 'What do you do?'
    await prisma.playRunLog.create({ data: { runId, type: 'system', content: prompt, speakerName: 'Daneel' } })
    return 'Turn yielded. Awaiting player response.'
  }

  if (name === 'roll_dice') {
    const count = Math.max(1, Math.floor(Number(input.count ?? 1)))
    const sides = Math.max(2, Math.floor(Number(input.sides ?? 20)))
    const modifier = Math.floor(Number(input.modifier ?? 0))
    const rolls: number[] = []
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1)
    }
    const rawSum = rolls.reduce((a, b) => a + b, 0)
    const total = rawSum + modifier
    const rollStr = count > 1 ? `[${rolls.join(', ')}]` : `${rolls[0]}`
    const label = input.purpose ? ` (${String(input.purpose)})` : ''
    return `${count}d${sides}${modifier > 0 ? '+' + modifier : modifier < 0 ? modifier : ''}${label}: rolled ${rollStr}${modifier !== 0 ? ` + ${modifier}` : ''} = **${total}**`
  }

  return `Unknown tool: ${name}`
}

// ─── Build system prompt for crawler mode ────────────────────────────────────

async function buildCrawlerPrompt(project: { id: number; name: string; description?: string | null; minLevel?: number | null; maxLevel?: number | null; partySize?: number | null }, run: { id: number; currentKeyedAreaId?: number | null; currentLocationId?: number | null; inCombat: boolean; roundNumber: number }) {

  type Doc = { title: string; content: string }
  type Quest = { id: number; name: string; description: string | null }
  type Player = { characterName: string; username: string; currentHP: number; maxHP: number; tempHP: number; level: number; xp: number; deathState: string }
  type Combatant = { id: number; name: string; type: string; currentHP: number; maxHP: number; AC: number; initiative: number; isDefeated: boolean }
  type Explored = { keyedAreaId: number | null }
  type CharSheet = { username: string; attacks: string; inventory: string }

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

  // Load character sheets to get attacks + equipped items
  const charSheets = await prisma.characterSheet.findMany({
    where: { projectId: project.id, username: { in: players.map(p => p.username) } },
    select: { username: true, attacks: true, inventory: true },
  }) as CharSheet[]
  const sheetByUser = new Map(charSheets.map(s => [s.username, s]))

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
  const partyLines = players.map(p => {
    const cs = sheetByUser.get(p.username)
    let attackSummary = ''
    let gearSummary = ''
    if (cs) {
      try {
        const attacks: Array<{ name: string; attackBonus: number; damage: string; damageType: string; range: string }> = JSON.parse(cs.attacks)
        if (attacks.length > 0) {
          attackSummary = ` | Attacks: ${attacks.map(a => `${a.name} (+${a.attackBonus} ${a.damage} ${a.damageType}, ${a.range})`).join(', ')}`
        }
      } catch {}
      try {
        const inv: Array<{ name: string; quantity: number; isEquipped: boolean }> = JSON.parse(cs.inventory)
        const equipped = inv.filter(i => i.isEquipped).map(i => i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)
        if (equipped.length > 0) gearSummary = ` | Equipped: ${equipped.join(', ')}`
      } catch {}
    }
    return `- **${p.characterName}** (${p.username}): HP ${p.currentHP}/${p.maxHP}${p.tempHP > 0 ? `+${p.tempHP}tmp` : ''}, Level ${p.level}, XP ${p.xp}, ${p.deathState !== 'alive' ? `**${p.deathState.toUpperCase()}**` : 'alive'}${attackSummary}${gearSummary}`
  }).join('\n')

  // Combat state — show initiative tracker sorted by initiative desc
  const livingCombatants = combatants.filter(c => !c.isDefeated)
  const allCombatants = [...combatants].sort((a, b) => b.initiative - a.initiative)
  const combatLines = run.inCombat && allCombatants.length > 0
    ? `\n## ⚔️ COMBAT — Round ${run.roundNumber}\n` +
      `Initiative order:\n` +
      allCombatants.map((c, i) => {
        const tag = c.isDefeated ? ' [DEFEATED]' : ''
        return `  ${i + 1}. ${c.name} (id: ${c.id}, ${c.type === 'monster' ? 'monster' : 'player'}) — HP ${c.currentHP}/${c.maxHP}, AC ${c.AC}, initiative ${c.initiative}${tag}`
      }).join('\n') +
      `\n\nLiving enemies: ${livingCombatants.length}. Players act first, then all living monsters retaliate.`
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

  return `You are Daneel, the Dungeon Master running the D&D 5th Edition campaign "${project.name}".

You run the game strictly by D&D 5e rules — action economy, spell slots, conditions, saving throws, skill checks, initiative, death saves, exhaustion, all of it. When a rule applies, apply it correctly. When a player does something that has a mechanical consequence under 5e, handle it mechanically.

Your job: narrate the campaign, respond to player actions, run combat, and guide the story. You have full access to all campaign content — use it faithfully.

## RULES — NON-NEGOTIABLE
These are hard rules. You MUST follow them every single response without exception.

**Narration:**
- Narrate in second person ("You enter the chamber…")
- Deliver Read Aloud text verbatim via the narrate tool when entering a new area
- NEVER reveal DM Notes to players

**Tool use is MANDATORY — not optional:**
- You MUST use tools for ALL game state changes. Never describe a game event in prose that should be a tool call.
- If enemies are present and the player takes a hostile action → call trigger_combat BEFORE any narration
- If a player attacks → call resolve_attack. Do NOT describe the hit or miss in prose first.
- If a monster acts → call monster_action. Do NOT narrate the monster's attack without calling the tool.
- If the party moves → call move_party BEFORE narrating the new location.
- If combat ends → call end_combat immediately. Do NOT narrate victory without calling the tool first.
- If XP or loot should be awarded → call award_xp / award_loot. Do NOT mention rewards in prose.
- NEVER free-narrate a combat exchange as a substitute for tool calls. Tools determine outcomes; narration describes them after.

**NEVER ask for clarification — EVER. Always assume and resolve immediately:**
- "I attack" → attack the nearest/most threatening enemy with their primary weapon. Do not ask which enemy or which weapon.
- "I cast a spell" → pick the most situationally appropriate spell they have.
- "I do something" → interpret it generously, make a ruling, execute it with tools.
- Asking the player a question before acting is a FAILURE. Make the ruling. Call the tools. Narrate the result.

**TURN-BASED COMBAT — one full round per player message, every time:**

This is D&D 5e turn-based combat. Each player message = one round. You execute the full round mechanically then hand control back. Never wait for permission. Never present options.

ROUND SEQUENCE (execute every tool in this order, no skipping):

STEP 1 — PLAYER'S ACTION:
  a. call roll_dice(count=1, sides=20, modifier=[attack bonus from Party section], purpose="attack roll")
  b. Note the total. If total ≥ target's AC → HIT. If total < AC → MISS.
  c. On a HIT: call roll_dice with the weapon's damage dice (longsword: 1d8+mod, shortsword: 1d6+mod, dagger: 1d4+mod, greatsword: 2d6+mod)
  d. call resolve_attack(attackerName, targetName, targetId, attackRoll=<step a total>, targetAC, damage=<step c total>, narrative="one sentence")
  Natural 20 = crit (double damage dice). Natural 1 = automatic miss.

STEP 2 — EVERY LIVING MONSTER RETALIATES (do this for EACH one):
  a. call roll_dice(count=1, sides=20, modifier=[monster bonus], purpose="[MonsterName] attack")
     Monster bonuses: goblin/kobold +4, orc +5, skeleton +4, zombie +3, troll +7, dragon +10, giant rat +3
  b. If total ≥ player's AC → HIT
  c. On HIT: call roll_dice for damage (goblin: 1d6+2, orc: 1d8+3, skeleton: 1d6+2, zombie: 1d6+1, giant rat: 1d4+1)
  d. call monster_action(monsterId, monsterName, targetPlayerId, targetName, attackRoll, targetAC, damage, narrative="one sentence")

STEP 3 — CHECK COMBAT END:
  If all monsters defeated → call end_combat, then award_xp, award_loot, mark_explored (in that order)

STEP 4 — NARRATE:
  call narrate ONCE. Two to four sentences covering what happened this round. Reference actual results from the tool responses (hit/miss, damage dealt, HP remaining). No menus, no options.

STEP 5 — YIELD:
  call yield_turn with ONE sentence: current round status + "What do you do?" e.g. "Round 2 — the goblin staggers at 2 HP. What do you do?"

## TOOL CALL BUDGET
Maximum 15 tool calls per response. With 2 monsters that's: 2 roll_dice (player) + 1 resolve_attack + 4 roll_dice (monsters) + 2 monster_action + 1 narrate + 1 yield_turn = 11 calls. You have headroom. If you are running low, call yield_turn immediately.

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
  // During combat, append a silent execution directive so the model runs tools instead of presenting options
  const playerActionLine = `${player?.characterName ?? user.username}: ${playerText}`
  const combatDirective = run.inCombat
    ? `\n\n[DM INSTRUCTION — DO NOT SHOW TO PLAYERS: Combat is active. Execute the full combat round RIGHT NOW using tools in this exact order: (1) roll_dice for the player's attack, (2) resolve_attack, (3) roll_dice + monster_action for each living enemy, (4) narrate once with the outcomes, (5) yield_turn with a one-sentence prompt. Do NOT present options. Do NOT ask what they want to do. Execute immediately.]`
    : ''
  if (aiMessages.length === 0 || aiMessages[aiMessages.length - 1].role !== 'user') {
    aiMessages.push({ role: 'user', content: playerActionLine + combatDirective })
  } else {
    // Replace the last user message with the combat-annotated version
    aiMessages[aiMessages.length - 1] = { role: 'user', content: playerActionLine + combatDirective }
  }

  const provider = (settings?.aiProvider ?? 'anthropic') as 'anthropic' | 'openai' | 'openclaw'
  const aiModel = settings?.aiModel?.trim()

  try {
    let finalText = ''

    if (!aiModel && provider !== 'openclaw') {
      await prisma.playRunLog.create({ data: { runId: run.id, type: 'system', content: '(No AI model configured. Go to Settings.)' } })
      return NextResponse.json({ ok: true })
    }

    const onToolCall = async (toolName: string, toolInput: Record<string, unknown>) => {
      return await handleCrawlerTool(toolName, toolInput, run.id)
    }

    if (provider === 'anthropic') {
      const result = await callAnthropicWithTools({ messages: aiMessages, systemPrompt, tools: CRAWLER_TOOLS, apiKey: settings!.aiApiKey!, model: aiModel!, onToolCall, forceToolUse: true })
      finalText = result.text
    } else if (provider === 'openai') {
      const result = await callOpenAIWithTools({ messages: aiMessages, systemPrompt, tools: CRAWLER_TOOLS, apiKey: settings!.aiApiKey!, model: aiModel!, onToolCall, forceToolUse: true })
      finalText = result.text
    } else {
      const result = await callOpenClawWithTools({ messages: aiMessages, systemPrompt, tools: CRAWLER_TOOLS, openClawBaseUrl: settings!.openClawBaseUrl!, openClawApiKey: settings?.openClawApiKey ?? undefined, context: { project: { id: project.id, slug: params.projectSlug, name: project.name }, documents: [], characters: [], worldEntries: [], styleGuide: '', sessionKey: `play-run-${run.id}` }, onToolCall })
      finalText = result.text
    }

    // Log Daneel's final text response if present (strip known provider noise)
    const cleanText = (finalText ?? '')
      .replace(/no response from openclaw\.?/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (cleanText) {
      await prisma.playRunLog.create({ data: { runId: run.id, type: 'narration', content: cleanText, speakerName: 'Daneel' } })
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
