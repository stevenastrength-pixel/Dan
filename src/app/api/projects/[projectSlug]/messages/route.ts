export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { streamAIChat, streamOpenClaw, callAnthropicWithTools, callOpenAIWithTools, callOpenClawWithTools, type OpenClawContext, type ToolDef, type ToolCall } from '@/lib/ai'
import { getUserFromRequest } from '@/lib/auth'
import { readFile } from 'fs/promises'

async function loadContextFiles(contextFilesJson: string): Promise<Array<{ key: string; title: string; content: string }>> {
  let paths: string[] = []
  try { paths = JSON.parse(contextFilesJson) } catch { return [] }
  const docs: Array<{ key: string; title: string; content: string }> = []
  for (let i = 0; i < paths.length; i++) {
    const filePath = paths[i]
    if (!filePath.trim()) continue
    try {
      const content = await readFile(filePath.trim(), 'utf8')
      docs.push({ key: `workspace_context_${i}`, title: filePath.trim().split('/').pop() ?? 'Workspace Context', content })
    } catch { /* skip unreadable files */ }
  }
  return docs
}

export const maxDuration = 120 // seconds — allow tool-use loop time

const DANEEL_PATTERN = /@daneel\b/i
const CORE_DOC_ORDER = ['story_bible', 'project_instructions', 'wake_prompt']

// ─── GET: fetch messages (optionally after a given id) ────────────────────────

export async function GET(
  request: Request,
  { params }: { params: { projectSlug: string } }
) {
  const { searchParams } = new URL(request.url)
  const afterId = searchParams.get('afterId')
  const beforeId = searchParams.get('beforeId')
  const pinned = searchParams.get('pinned')

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (pinned === 'true') {
    const messages = await prisma.projectMessage.findMany({
      where: { projectId: project.id, isPinned: true },
      orderBy: { id: 'desc' },
    })
    return NextResponse.json(messages)
  }

  if (beforeId) {
    const messages = await prisma.projectMessage.findMany({
      where: { projectId: project.id, id: { lt: parseInt(beforeId) } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(messages.reverse())
  }

  if (afterId) {
    const messages = await prisma.projectMessage.findMany({
      where: { projectId: project.id, id: { gt: parseInt(afterId) } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
    return NextResponse.json(messages)
  }

  // Initial load: return the newest 200
  const messages = await prisma.projectMessage.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json(messages.reverse())
}

// ─── POST: post a message; call AI only if @Daneel is mentioned ───────────────

export async function POST(
  request: Request,
  { params }: { params: { projectSlug: string } }
) {
  const { author, content, imageUrl, fileName } = await request.json()
  if (!content?.trim() && !imageUrl) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Save the user message
  const message = await prisma.projectMessage.create({
    data: { projectId: project.id, role: 'user', author, content: content ?? '', imageUrl: imageUrl ?? null, fileName: fileName ?? null },
  })

  // Only call AI when @Daneel is mentioned
  if (!DANEEL_PATTERN.test(content)) {
    return NextResponse.json({ message, aiMessage: null })
  }

  // ── Build context and call AI ─────────────────────────────────────────────

  const requestingUser = await getUserFromRequest(request)

  const isCampaign = (project as { type?: string }).type === 'campaign'

  const [settings, characters, worldEntries, documents, chapters, recentMessages, tasks] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.character.findMany({ where: { projectId: project.id }, orderBy: { name: 'asc' } }),
    prisma.worldEntry.findMany({ where: { projectId: project.id }, orderBy: { name: 'asc' } }),
    prisma.projectDocument.findMany({ where: { projectId: project.id } }),
    prisma.chapter.findMany({ where: { projectId: project.id }, orderBy: { order: 'asc' } }),
    prisma.projectMessage.findMany({
      where: {
        projectId: project.id,
        ...(project.contextResetAt ? { createdAt: { gte: project.contextResetAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).then(msgs => msgs.reverse()),
    prisma.task.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } }),
  ])

  // Campaign-only context
  const [campaignQuests, campaignTimeline, campaignLocations] = isCampaign
    ? await Promise.all([
        prisma.quest.findMany({ where: { projectId: project.id }, orderBy: [{ questType: 'asc' }, { name: 'asc' }] }),
        prisma.timelineEvent.findMany({ where: { projectId: project.id }, orderBy: { inWorldDay: 'asc' }, take: 20 }),
        prisma.location.findMany({ where: { projectId: project.id }, orderBy: { name: 'asc' }, select: { id: true, name: true, locationType: true } }),
      ])
    : [[], [], []]

  const provider = (settings?.aiProvider ?? 'anthropic') as 'anthropic' | 'openai' | 'openclaw'
  const contextDocs = await loadContextFiles(settings?.contextFiles ?? '[]')

  if (provider === 'openclaw' && !settings?.openClawBaseUrl?.trim()) {
    const errMsg = await prisma.projectMessage.create({
      data: { projectId: project.id, role: 'assistant', author: 'Daneel', content: 'OpenClaw base URL is not configured. Go to Settings.' },
    })
    return NextResponse.json({ message, aiMessage: errMsg })
  }

  if (provider !== 'openclaw' && !settings?.aiApiKey) {
    const errMsg = await prisma.projectMessage.create({
      data: { projectId: project.id, role: 'assistant', author: 'Daneel', content: 'No API key configured. Go to Settings to add one.' },
    })
    return NextResponse.json({ message, aiMessage: errMsg })
  }

  const docKeys = documents.map(d => d.key)

  // Build system prompt
  const characterList = characters.length > 0
    ? characters.map(c => {
        let traits: string[] = []
        try { traits = JSON.parse(c.traits) } catch {}
        return `- **${c.name}** (id: \`${c.id}\`, role: ${c.role})${c.description ? `: ${c.description}` : ''}${traits.length > 0 ? ` | Traits: ${traits.join(', ')}` : ''}`
      }).join('\n')
    : 'No characters defined yet.'

  const grouped = worldEntries.reduce<Record<string, string[]>>((acc, e) => {
    if (!acc[e.type]) acc[e.type] = []
    acc[e.type].push(`- **${e.name}** (id: \`${e.id}\`)${e.description ? `: ${e.description}` : ''}`)
    return acc
  }, {})
  const worldList = Object.keys(grouped).length > 0
    ? Object.entries(grouped).map(([type, items]) => `### ${type}s\n${items.join('\n')}`).join('\n\n')
    : 'No world entries defined yet.'

  const sorted = [...contextDocs, ...documents].sort((a, b) => {
    const ai = CORE_DOC_ORDER.indexOf(a.key), bi = CORE_DOC_ORDER.indexOf(b.key)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.title.localeCompare(b.title)
  })
  const MAX_DOC_CHARS = 3000
  const docSections = sorted.filter(d => d.content.trim()).map(d => {
    const body = d.content.length > MAX_DOC_CHARS
      ? d.content.slice(0, MAX_DOC_CHARS) + '\n…(truncated)'
      : d.content
    return `## ${d.title}\n${body}`
  }).join('\n\n---\n\n')

  const campaignMeta = isCampaign
    ? `Level range: ${(project as {minLevel?: number}).minLevel ?? 1}–${(project as {maxLevel?: number}).maxLevel ?? 10} | Party size: ${(project as {partySize?: number}).partySize ?? 4} | Leveling: ${(project as {levelingMode?: string}).levelingMode ?? 'milestone'}`
    : ''

  const questList = (campaignQuests as Array<{name: string; questType: string; status: string; id: number; description: string}>).length > 0
    ? (campaignQuests as Array<{name: string; questType: string; status: string; id: number; description: string}>)
        .map(q => `- **${q.name}** (id: ${q.id}, type: ${q.questType}, status: ${q.status})${q.description ? `: ${q.description.slice(0, 100)}` : ''}`)
        .join('\n')
    : 'No quests defined yet.'

  const timelineList = (campaignTimeline as Array<{name: string; inWorldDay: number; id: number; description: string; triggerCondition: string}>).length > 0
    ? (campaignTimeline as Array<{name: string; inWorldDay: number; id: number; description: string; triggerCondition: string}>)
        .map(e => `- Day ${e.inWorldDay}: **${e.name}** (id: ${e.id})${e.triggerCondition ? ` [if: ${e.triggerCondition}]` : ''} — ${e.description.slice(0, 80)}`)
        .join('\n')
    : 'No timeline events defined yet.'

  const locationList = (campaignLocations as Array<{name: string; locationType: string; id: number}>).length > 0
    ? (campaignLocations as Array<{name: string; locationType: string; id: number}>)
        .map(l => `- **${l.name}** (id: ${l.id}, type: ${l.locationType})`)
        .join('\n')
    : 'No locations defined yet.'

  const systemPrompt = isCampaign
    ? `You are Daneel, GM co-author for the campaign "${project.name}". You are part of a collaborative team chat — multiple people use this to build the campaign book together.${project.description ? `\nCampaign: ${project.description}` : ''}
${campaignMeta}

You only respond when directly addressed with @Daneel. Keep responses focused and useful. You can see who said what by looking at the author field.

Your personality: sharp, knowledgeable about 5e rules and published adventure design, opinionated about pacing and encounter balance. You think like a published adventure designer — not just creative writing, but practical GM usability. Direct without being rude. Never say "D&D" — use "the game", "5e", "the system", or refer to mechanics directly.

## YOUR ROLE
You are building a published-quality 5e campaign book — everything that would appear in a purchased module. Think Lost Mine of Phandelver, Curse of Strahd, Tomb of Annihilation: ordered adventure parts with locations, keyed areas, encounters, NPCs, quests, random tables, and a timeline.

## CRITICAL: Tool usage
- create_session to add adventure parts (the ordered spine of the campaign)
- create_location to add named areas (dungeons, towns, regions, buildings)
- create_keyed_area to add numbered rooms/areas inside a location
- create_encounter to add combat, social, exploration, trap, or hazard encounters
- add_creature_to_encounter to link SRD or custom creatures to an encounter
- search_creature to look up monsters by name, CR, or type from the SRD library
- search_spell / search_magic_item for SRD reference lookups
- create_quest, update_quest for quest management
- create_timeline_event for the villain's advancing plan
- create_random_table for encounter/rumor/weather tables
- create_campaign_magic_item for unique items
- create_campaign_creature for custom homebrew monsters
- create_npc to add NPCs (same as create_character but with campaign fields)

## CRITICAL: Document editing
Available document keys: ${docKeys.join(', ') || 'none yet'}.
Use get_document → patch_document for targeted edits. Use update_document only for full rewrites.

## CRITICAL: Creating polls and tasks
create_poll and assign_task MUST be called as tools — writing about them in prose has no effect.

## Campaign Documents
${docSections || '(No documents written yet.)'}

## Adventure Parts (ordered spine)
${chapters.length > 0
  ? chapters.map((c, i) => {
      const ch = c as { id: string; title: string; synopsis: string; content: string; intendedLevel?: number | null }
      return `- Part ${i + 1}: **${ch.title}** (id: \`${ch.id}\`)${ch.intendedLevel ? ` [Level ${ch.intendedLevel}]` : ''}${ch.synopsis ? ` — ${ch.synopsis}` : ''}${ch.content ? '' : ' *(empty)*'}`
    }).join('\n')
  : 'No adventure parts yet.'}

## Locations
${locationList}

## NPCs
${characterList}

## Factions & Lore
${worldList}

## Active Quests
${questList}

## Timeline (villain's advancing plan)
${timelineList}`
    : `You are Daneel, the AI assistant for the writing project "${project.name}". You are part of a collaborative team chat — multiple writers use this chat to coordinate.${project.description ? `\nProject: ${project.description}` : ''}

You only respond when directly addressed with @Daneel. Keep responses focused and useful. You can see who said what by looking at the author field in each message.

Your personality: sharp, witty, slightly dry, always well-informed. You push back when ideas conflict with established canon. Direct without being rude.

## IMPORTANT: Editing documents
Available document keys: ${docKeys.join(', ') || 'none yet'}.

## IMPORTANT: Editing chapters
Chapter IDs are listed in the Chapters section below — use them directly, do NOT ask the user for an ID you already have.
Use create_chapter to create a new chapter. Use get_chapter to read a chapter before editing. Use patch_chapter for targeted edits. Use update_chapter only for full rewrites.

## IMPORTANT: Managing characters
Character IDs are listed in the Characters section below. Use find_character_by_name if you need to resolve a name to an id or confirm whether a character already exists. Use create_character to add someone new to the project database. Use get_character before updating an existing character so you preserve important details. Use update_character to replace the stored fields for a character when asked to sync the database with the Story Bible or other canon documents. Use delete_character only when the user clearly asks to remove a character record from the database. When importing or syncing multiple characters from the Story Bible, prefer sync_characters_batch so you can create/update the whole set in one tool call.

## IMPORTANT: Managing world entries
World entry IDs are listed in the World Building section below. Use find_world_entry_by_name if you need to resolve a name to an id or confirm whether an entry already exists. Use create_world_entry to add a new location, faction, concept, item, or event to the project database. Use get_world_entry before updating an existing entry so you preserve important details. Use update_world_entry to replace the stored fields for an entry when syncing from the Story Bible or other canon documents. Use delete_world_entry only when the user clearly asks to remove a world entry from the database. When importing or syncing multiple locations, factions, concepts, items, or events from the Story Bible, prefer sync_world_entries_batch so you can create/update the whole set in one tool call.

## CRITICAL: Creating polls
When asked to create a poll, you MUST call the create_poll tool — do NOT write poll details in text without calling the tool. Writing about a poll in prose has no effect; only the tool call actually creates one. Call the tool first, then briefly confirm what you created.
Use create_poll when the team faces a genuine creative decision — plot forks, character choices, world-building options. Keep options clear and mutually exclusive.
When creating many polls from a list of open questions, prefer create_polls_batch.

## CRITICAL: Assigning tasks
You MUST call the assign_task tool to assign tasks. Writing "✓ Assigned task" or any similar text in prose does NOT create a task — it is invisible to the system and the user will never see it in their task queue. The ONLY way to create a task is to call the assign_task tool. If you describe a task without calling the tool, you have failed. Call the tool first, then confirm briefly in text.
When creating many tasks from a document or checklist, prefer assign_tasks_batch.

When a user reports completing a task, do NOT automatically assign them a new one unless (a) explicitly asked to, or (b) their queue is empty AND they ask for more work.

For targeted edits (changing a section, adding a line, updating a value):
1. Call get_document to read the current content.
2. Call patch_document with the exact text to find and the replacement text.

For full rewrites only (e.g. "rewrite the whole document from scratch"):
1. Call get_document first.
2. Call update_document with the complete new content.

NEVER use update_document for targeted edits — large documents will exceed output limits. Prefer patch_document for any change that touches less than the whole document.
${documents.find(d => d.key === 'style_guide')?.content?.trim() ? `\n## Style Guide\n${documents.find(d => d.key === 'style_guide')!.content}\n` : ''}
## Project Documents
${docSections || '(No documents written yet.)'}

## Chapters
${chapters.length > 0
  ? chapters.map((c, i) => `- Ch. ${i + 1}: **${c.title}** (id: \`${c.id}\`)${c.synopsis ? ` — ${c.synopsis}` : ''}${c.content ? '' : ' *(empty)*'}`)
      .join('\n')
  : 'No chapters yet.'}

## Characters
${characterList}

## World Building
${worldList}`

  // Convert recent chat to AI message format (user messages attributed by name)
  const aiMessages = recentMessages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.role === 'user' ? `[${m.author}]: ${m.content}` : m.content,
  }))

  const openClawContext: OpenClawContext = {
    project: { id: project.id, slug: project.slug, name: project.name },
    documents: documents.map(d => ({ key: d.key, title: d.title, content: d.content })),
    characters: characters.map(c => ({ name: c.name, role: c.role, description: c.description, notes: c.notes })),
    worldEntries: worldEntries.map(w => ({ name: w.name, type: w.type, description: w.description })),
    styleGuide: documents.find(d => d.key === 'style_guide')?.content ?? '',
    sessionKey: `${requestingUser?.openClawSessionKey ?? 'dan'}-${project.slug}${project.sessionNonce ? `-${project.sessionNonce}` : ''}`,
  }

  // ── Define tools available to Daneel ─────────────────────────────────────

  const tools: ToolDef[] = [
    {
      name: 'get_document',
      description: 'Read the full current content of a project document before editing it. Always call this before update_document.',
      input_schema: {
        type: 'object' as const,
        properties: {
          key: {
            type: 'string',
            description: `The document key to read. Available keys: ${docKeys.join(', ') || 'story_bible, project_instructions, wake_prompt'}`,
          },
        },
        required: ['key'],
      },
    },
    {
      name: 'patch_document',
      description:
        'Make a targeted edit to a document by replacing a specific piece of text. Use this for any change that does not require rewriting the whole document. Call get_document first to get the exact text to search for.',
      input_schema: {
        type: 'object' as const,
        properties: {
          key: {
            type: 'string',
            description: `The document key to patch. Available keys: ${docKeys.join(', ') || 'story_bible, project_instructions, wake_prompt'}`,
          },
          find: {
            type: 'string',
            description: 'The exact text to find in the document (must match character-for-character).',
          },
          replace: {
            type: 'string',
            description: 'The text to replace it with.',
          },
          summary: {
            type: 'string',
            description: 'One sentence describing what changed.',
          },
        },
        required: ['key', 'find', 'replace', 'summary'],
      },
    },
    {
      name: 'update_document',
      description:
        'Replace the ENTIRE content of a document. Only use this for full rewrites. For targeted edits use patch_document instead.',
      input_schema: {
        type: 'object' as const,
        properties: {
          key: {
            type: 'string',
            description: `The document key to update. Available keys: ${docKeys.join(', ') || 'story_bible, project_instructions, wake_prompt'}`,
          },
          content: {
            type: 'string',
            description: 'The complete new content for the document.',
          },
          summary: {
            type: 'string',
            description: 'One or two sentences describing what changed and why.',
          },
        },
        required: ['key', 'content', 'summary'],
      },
    },
    {
      name: 'create_chapter',
      description: 'Create a new chapter in the project. Use this when asked to write a new chapter or when a chapter does not yet exist.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'The chapter title.' },
          content: { type: 'string', description: 'The chapter content.' },
          synopsis: { type: 'string', description: 'A brief synopsis of the chapter (optional).' },
        },
        required: ['title', 'content'],
      },
    },
    {
      name: 'create_character',
      description: 'Create a new character in the project database. Use this when extracting characters from the Story Bible or when the team asks you to add a character record.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'The character name.' },
          role: { type: 'string', description: 'Narrative role such as Protagonist, Antagonist, Supporting, Mentor, Love Interest, or Minor.' },
          description: { type: 'string', description: 'Short character description.' },
          notes: { type: 'string', description: 'Long-form notes, backstory, arc, or canon details.' },
          traits: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of traits to store on the character record.',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'get_character',
      description: 'Read the full current stored data for a character before updating it.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The character id from the Characters list in your context.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'find_character_by_name',
      description: 'Look up one or more characters in this project by name. Use this before updating or deleting when you only know the character name.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Full or partial character name to search for.' },
        },
        required: ['name'],
      },
    },
    {
      name: 'update_character',
      description: 'Update an existing character record with the full new set of stored fields.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The character id.' },
          name: { type: 'string', description: 'The character name.' },
          role: { type: 'string', description: 'Narrative role such as Protagonist, Antagonist, Supporting, Mentor, Love Interest, or Minor.' },
          description: { type: 'string', description: 'Short character description.' },
          notes: { type: 'string', description: 'Long-form notes, backstory, arc, or canon details.' },
          traits: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of traits to store on the character record.',
          },
          summary: { type: 'string', description: 'One or two sentences describing what changed.' },
        },
        required: ['id', 'name', 'role', 'description', 'notes', 'traits', 'summary'],
      },
    },
    {
      name: 'delete_character',
      description: 'Delete a character from the project database. Only use this when the user explicitly asks to remove the record.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The character id.' },
          summary: { type: 'string', description: 'One sentence describing why the character was removed.' },
        },
        required: ['id', 'summary'],
      },
    },
    {
      name: 'sync_characters_batch',
      description: 'Create or update multiple character records in one call. Prefer this when importing or syncing a cast from the Story Bible.',
      input_schema: {
        type: 'object' as const,
        properties: {
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string' },
                description: { type: 'string' },
                notes: { type: 'string' },
                traits: { type: 'array', items: { type: 'string' } },
              },
              required: ['name'],
            },
            description: 'The character records to create or update by name.',
          },
          summary: { type: 'string', description: 'One or two sentences describing what was synced.' },
        },
        required: ['entries', 'summary'],
      },
    },
    {
      name: 'create_world_entry',
      description: 'Create a new world-building entry in the project database.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'The world entry name.' },
          type: { type: 'string', description: 'Entry type such as Location, Faction, Concept, Item, or Event.' },
          description: { type: 'string', description: 'Short entry description.' },
          notes: { type: 'string', description: 'Long-form notes and canon details.' },
        },
        required: ['name'],
      },
    },
    {
      name: 'get_world_entry',
      description: 'Read the full current stored data for a world entry before updating it.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The world entry id from the World Building list in your context.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'find_world_entry_by_name',
      description: 'Look up one or more world entries in this project by name.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Full or partial world entry name to search for.' },
        },
        required: ['name'],
      },
    },
    {
      name: 'update_world_entry',
      description: 'Update an existing world entry with the full new set of stored fields.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The world entry id.' },
          name: { type: 'string', description: 'The world entry name.' },
          type: { type: 'string', description: 'Entry type such as Location, Faction, Concept, Item, or Event.' },
          description: { type: 'string', description: 'Short entry description.' },
          notes: { type: 'string', description: 'Long-form notes and canon details.' },
          summary: { type: 'string', description: 'One or two sentences describing what changed.' },
        },
        required: ['id', 'name', 'type', 'description', 'notes', 'summary'],
      },
    },
    {
      name: 'delete_world_entry',
      description: 'Delete a world entry from the project database. Only use this when the user explicitly asks to remove the record.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The world entry id.' },
          summary: { type: 'string', description: 'One sentence describing why the entry was removed.' },
        },
        required: ['id', 'summary'],
      },
    },
    {
      name: 'sync_world_entries_batch',
      description: 'Create or update multiple world entries in one call. Prefer this when importing or syncing locations, factions, concepts, items, or events from the Story Bible.',
      input_schema: {
        type: 'object' as const,
        properties: {
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                description: { type: 'string' },
                notes: { type: 'string' },
              },
              required: ['name'],
            },
            description: 'The world entries to create or update by name.',
          },
          summary: { type: 'string', description: 'One or two sentences describing what was synced.' },
        },
        required: ['entries', 'summary'],
      },
    },
    {
      name: 'get_chapter',
      description: 'Read the full current content of a chapter before editing it. Always call this before patch_chapter or update_chapter.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The chapter id (from the Chapters list in your context).' },
        },
        required: ['id'],
      },
    },
    {
      name: 'patch_chapter',
      description: 'Make a targeted edit to a chapter by replacing a specific piece of text. Use for any change that does not require rewriting the whole chapter. Call get_chapter first to get the exact text.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The chapter id.' },
          find: { type: 'string', description: 'The exact text to find (must match character-for-character).' },
          replace: { type: 'string', description: 'The replacement text.' },
          summary: { type: 'string', description: 'One sentence describing the change.' },
        },
        required: ['id', 'find', 'replace', 'summary'],
      },
    },
    {
      name: 'update_chapter',
      description: 'Replace the ENTIRE content of a chapter. Only for full rewrites. For targeted edits use patch_chapter instead.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'The chapter id.' },
          content: { type: 'string', description: 'The complete new chapter content.' },
          summary: { type: 'string', description: 'One or two sentences describing what changed and why.' },
        },
        required: ['id', 'content', 'summary'],
      },
    },
    {
      name: 'assign_task',
      description: 'Assign a task to a specific team member. Use this to give someone a clear, actionable to-do item.',
      input_schema: {
        type: 'object' as const,
        properties: {
          assignedTo: {
            type: 'string',
            description: 'The exact username of the person to assign the task to.',
          },
          title: {
            type: 'string',
            description: 'Short, clear task title.',
          },
          description: {
            type: 'string',
            description: 'More detail about what needs to be done (optional).',
          },
        },
        required: ['assignedTo', 'title'],
      },
    },
    {
      name: 'assign_tasks_batch',
      description: 'Create multiple task assignments in one call. Prefer this when turning a list of open items into tasks.',
      input_schema: {
        type: 'object' as const,
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                assignedTo: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['assignedTo', 'title'],
            },
            description: 'The tasks to create.',
          },
          summary: { type: 'string', description: 'One or two sentences describing what was assigned.' },
        },
        required: ['tasks', 'summary'],
      },
    },
    {
      name: 'get_tasks',
      description: 'Get the current task list for the project, optionally filtered by user or status.',
      input_schema: {
        type: 'object' as const,
        properties: {
          assignedTo: { type: 'string', description: 'Filter by username (optional).' },
          status: { type: 'string', description: 'Filter by status: TODO, IN_PROGRESS, or DONE (optional).' },
        },
      },
    },
    {
      name: 'create_poll',
      description: 'Create a poll for the team to vote on. Use this when a creative decision needs team input — plot direction, character choices, world-building options, etc.',
      input_schema: {
        type: 'object' as const,
        properties: {
          question: {
            type: 'string',
            description: 'The poll question.',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'The voting options (minimum 2, maximum 6).',
          },
        },
        required: ['question', 'options'],
      },
    },
    {
      name: 'create_polls_batch',
      description: 'Create multiple polls in one call. Prefer this when turning a list of open questions into polls.',
      input_schema: {
        type: 'object' as const,
        properties: {
          polls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
              },
              required: ['question', 'options'],
            },
            description: 'The polls to create.',
          },
          summary: { type: 'string', description: 'One or two sentences describing what was created.' },
        },
        required: ['polls', 'summary'],
      },
    },
    // ── Campaign-only tools ────────────────────────────────────────────────
    ...(isCampaign ? [
      {
        name: 'create_session',
        description: 'Create a new adventure part (the ordered spine of the campaign). Use for major chapters like "Part 1: The Stolen Forge".',
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string', description: 'Title of this adventure part.' },
            synopsis: { type: 'string', description: 'Brief synopsis of what happens in this part.' },
            intendedLevel: { type: 'number', description: 'Intended PC level for this part (optional).' },
          },
          required: ['title'],
        },
      },
      {
        name: 'update_session',
        description: 'Update an existing adventure part. Call get_chapter first to confirm current content.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'The chapter id (from Adventure Parts list in your context).' },
            title: { type: 'string', description: 'New title (optional).' },
            synopsis: { type: 'string', description: 'New synopsis (optional).' },
            intendedLevel: { type: 'number', description: 'New intended level (optional).' },
            summary: { type: 'string', description: 'One sentence describing the change.' },
          },
          required: ['id', 'summary'],
        },
      },
      {
        name: 'create_location',
        description: 'Create a named location in the campaign — dungeon, town, region, wilderness area, building, or plane.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Location name.' },
            locationType: { type: 'string', description: 'One of: dungeon, town, region, wilderness, building, plane.' },
            description: { type: 'string', description: 'What this place is and its purpose in the adventure.' },
            atmosphere: { type: 'string', description: 'Sights, sounds, smells — the sensory atmosphere (optional).' },
            parentLocationId: { type: 'number', description: 'ID of a parent location if this is nested inside one (optional).' },
          },
          required: ['name'],
        },
      },
      {
        name: 'update_location',
        description: 'Update an existing location record.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'number', description: 'The location id (from Locations list in your context).' },
            name: { type: 'string', description: 'New name (optional).' },
            locationType: { type: 'string', description: 'New type (optional).' },
            description: { type: 'string', description: 'New description (optional).' },
            atmosphere: { type: 'string', description: 'New atmosphere (optional).' },
            summary: { type: 'string', description: 'One sentence describing the change.' },
          },
          required: ['id', 'summary'],
        },
      },
      {
        name: 'create_keyed_area',
        description: 'Create a numbered/keyed area inside a location (e.g. "1. Entry Hall", "B12. Throne Room"). Use for dungeon rooms and building areas.',
        input_schema: {
          type: 'object' as const,
          properties: {
            locationId: { type: 'number', description: 'The location id this area belongs to.' },
            key: { type: 'string', description: 'The area key/number (e.g. "1", "B12", "A").' },
            title: { type: 'string', description: 'Area title (e.g. "Entry Hall").' },
            readAloud: { type: 'string', description: 'Boxed text read aloud to players when they enter.' },
            dmNotes: { type: 'string', description: 'DM-only notes about secrets, mechanics, and context.' },
            connections: { type: 'array', items: { type: 'string' }, description: 'Connected area keys (e.g. ["2", "3", "B1"]).' },
          },
          required: ['locationId', 'key', 'title'],
        },
      },
      {
        name: 'update_keyed_area',
        description: 'Update an existing keyed area.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'number', description: 'The keyed area id.' },
            title: { type: 'string', description: 'New title (optional).' },
            readAloud: { type: 'string', description: 'New read-aloud text (optional).' },
            dmNotes: { type: 'string', description: 'New DM notes (optional).' },
            summary: { type: 'string', description: 'One sentence describing the change.' },
          },
          required: ['id', 'summary'],
        },
      },
      {
        name: 'create_encounter',
        description: 'Create an encounter — combat, social, exploration, trap, or hazard.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Encounter name.' },
            encounterType: { type: 'string', description: 'One of: combat, social, exploration, trap, hazard.' },
            difficulty: { type: 'string', description: 'One of: trivial, easy, medium, hard, deadly.' },
            summary: { type: 'string', description: 'What this encounter is about.' },
            readAloud: { type: 'string', description: 'Boxed text to read aloud (optional).' },
            tactics: { type: 'string', description: 'How enemies or NPCs behave — tactics, morale, goals (optional).' },
            dmNotes: { type: 'string', description: 'DM notes on variants, adjustments, or context (optional).' },
            rewardText: { type: 'string', description: 'Treasure, XP, or story rewards (optional).' },
            locationId: { type: 'number', description: 'Location id to attach this encounter to (optional).' },
            keyedAreaId: { type: 'number', description: 'Keyed area id to attach this encounter to (optional).' },
          },
          required: ['name', 'encounterType'],
        },
      },
      {
        name: 'update_encounter',
        description: 'Update an existing encounter.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'number', description: 'The encounter id.' },
            name: { type: 'string', description: 'New name (optional).' },
            difficulty: { type: 'string', description: 'New difficulty (optional).' },
            summary: { type: 'string', description: 'New summary (optional).' },
            tactics: { type: 'string', description: 'New tactics (optional).' },
            dmNotes: { type: 'string', description: 'New DM notes (optional).' },
            rewardText: { type: 'string', description: 'New reward text (optional).' },
            editSummary: { type: 'string', description: 'One sentence describing the change.' },
          },
          required: ['id', 'editSummary'],
        },
      },
      {
        name: 'add_creature_to_encounter',
        description: 'Add a creature (from SRD or homebrew) to an encounter. Use search_creature first to find the SRD creature id.',
        input_schema: {
          type: 'object' as const,
          properties: {
            encounterId: { type: 'number', description: 'The encounter id.' },
            srdCreatureId: { type: 'number', description: 'SRD creature id (from search_creature). Use this OR campaignCreatureId.' },
            campaignCreatureId: { type: 'number', description: 'Homebrew campaign creature id. Use this OR srdCreatureId.' },
            quantity: { type: 'number', description: 'How many of this creature (default 1).' },
            notes: { type: 'string', description: 'Per-creature notes (renamed, variant stats, special role, etc.).' },
          },
          required: ['encounterId'],
        },
      },
      {
        name: 'search_creature',
        description: 'Search the SRD creature library by name, type, CR range, or legendary status. Returns up to 50 results.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Partial name to search for (optional).' },
            type: { type: 'string', description: 'Creature type like "undead", "dragon", "humanoid" (optional).' },
            crMin: { type: 'string', description: 'Minimum CR as string: "0","1/8","1/4","1/2","1"–"30" (optional).' },
            crMax: { type: 'string', description: 'Maximum CR as string (optional).' },
            legendary: { type: 'boolean', description: 'If true, return only legendary creatures (optional).' },
          },
        },
      },
      {
        name: 'get_creature',
        description: 'Get full stat block for a specific SRD creature by id.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'number', description: 'The SRD creature id (from search_creature results).' },
          },
          required: ['id'],
        },
      },
      {
        name: 'create_quest',
        description: 'Create a quest — main story quest, side quest, faction quest, or personal quest.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Quest name.' },
            questType: { type: 'string', description: 'One of: main, side, faction, personal.' },
            description: { type: 'string', description: 'What the players need to do and why it matters.' },
            rewardText: { type: 'string', description: 'What players get for completing it (optional).' },
            giverCharacterId: { type: 'string', description: 'Character id of the NPC giving this quest (optional).' },
          },
          required: ['name'],
        },
      },
      {
        name: 'update_quest',
        description: 'Update an existing quest — add clues, update description, change reward, link a giver.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'number', description: 'The quest id.' },
            name: { type: 'string', description: 'New name (optional).' },
            description: { type: 'string', description: 'New description (optional).' },
            rewardText: { type: 'string', description: 'New reward text (optional).' },
            summary: { type: 'string', description: 'One sentence describing the change.' },
          },
          required: ['id', 'summary'],
        },
      },
      {
        name: 'advance_quest',
        description: 'Change a quest\'s status. Use when players complete, abandon, or discover a quest.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'number', description: 'The quest id.' },
            status: { type: 'string', description: 'New status: active, resolved, abandoned, or unknown-to-party.' },
            summary: { type: 'string', description: 'One sentence describing why the status changed.' },
          },
          required: ['id', 'status', 'summary'],
        },
      },
      {
        name: 'create_timeline_event',
        description: 'Add an event to the villain\'s timeline / world clock. These are things that happen in the world whether or not the players intervene.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Event name.' },
            inWorldDay: { type: 'number', description: 'In-world day number when this event occurs (0 = campaign start).' },
            description: { type: 'string', description: 'What happens.' },
            triggerCondition: { type: 'string', description: 'Optional: only happens if players did/didn\'t do something.' },
            consequence: { type: 'string', description: 'What changes in the world after this event.' },
          },
          required: ['name', 'inWorldDay', 'description'],
        },
      },
      {
        name: 'update_timeline_event',
        description: 'Update an existing timeline event.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'number', description: 'The timeline event id.' },
            name: { type: 'string', description: 'New name (optional).' },
            inWorldDay: { type: 'number', description: 'New day (optional).' },
            description: { type: 'string', description: 'New description (optional).' },
            triggerCondition: { type: 'string', description: 'New trigger condition (optional).' },
            consequence: { type: 'string', description: 'New consequence (optional).' },
            summary: { type: 'string', description: 'One sentence describing the change.' },
          },
          required: ['id', 'summary'],
        },
      },
      {
        name: 'create_random_table',
        description: 'Create a random table — encounter tables, rumor tables, NPC name tables, weather, trinkets, etc.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Table name (e.g. "Forest Encounter Table").' },
            tableCategory: { type: 'string', description: 'One of: encounter, npc-names, rumors, weather, trinkets, custom.' },
            dieSize: { type: 'string', description: 'Die to roll: d4, d6, d8, d10, d12, d20, d100.' },
            description: { type: 'string', description: 'When and how to use this table (optional).' },
            entries: {
              type: 'array',
              items: { type: 'object', properties: { roll: { type: 'number' }, text: { type: 'string' } }, required: ['roll', 'text'] },
              description: 'Array of {roll, text} entries. Roll should be 1–dieSize.',
            },
          },
          required: ['name', 'entries'],
        },
      },
      {
        name: 'roll_on_table',
        description: 'Roll on an existing random table and return the result.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'number', description: 'The random table id.' },
          },
          required: ['id'],
        },
      },
      {
        name: 'create_campaign_magic_item',
        description: 'Create a unique magic item for this campaign — named swords, quest items, unique wondrous items, etc.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Item name.' },
            rarity: { type: 'string', description: 'One of: common, uncommon, rare, very rare, legendary, artifact.' },
            itemType: { type: 'string', description: 'e.g. weapon, armor, wondrous, ring, rod, staff, wand, potion, scroll.' },
            description: { type: 'string', description: 'What the item does.' },
            requiresAttunement: { type: 'boolean', description: 'Whether the item requires attunement.' },
            attunementNotes: { type: 'string', description: 'Attunement restrictions (e.g. "by a wizard") (optional).' },
            chargesMax: { type: 'number', description: 'Maximum charges (optional).' },
            rechargeCondition: { type: 'string', description: 'How charges recharge (e.g. "1d6+1 at dawn") (optional).' },
            properties: { type: 'string', description: 'Mechanical properties (optional).' },
            lore: { type: 'string', description: 'History and lore (optional).' },
          },
          required: ['name', 'description'],
        },
      },
      {
        name: 'search_magic_item',
        description: 'Search the SRD magic items library by name or rarity.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Partial name to search for (optional).' },
            rarity: { type: 'string', description: 'Rarity filter: common, uncommon, rare, very rare, legendary (optional).' },
          },
        },
      },
      {
        name: 'create_campaign_creature',
        description: 'Create a homebrew/custom creature for this campaign.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Creature name.' },
            size: { type: 'string', description: 'One of: Tiny, Small, Medium, Large, Huge, Gargantuan.' },
            creatureType: { type: 'string', description: 'e.g. undead, humanoid, dragon, construct.' },
            alignment: { type: 'string', description: 'e.g. lawful evil, chaotic neutral.' },
            CR: { type: 'string', description: 'Challenge rating as string: "0","1/8","1/4","1/2","1"–"30".' },
            AC: { type: 'number', description: 'Armor class.' },
            HPAverage: { type: 'number', description: 'Average hit points.' },
            HPDice: { type: 'string', description: 'HP dice expression (e.g. "6d8+12").' },
            STR: { type: 'number' }, DEX: { type: 'number' }, CON: { type: 'number' },
            INT: { type: 'number' }, WIS: { type: 'number' }, CHA: { type: 'number' },
            traits: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, text: { type: 'string' } } }, description: 'Special traits.' },
            actions: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, text: { type: 'string' } } }, description: 'Actions.' },
          },
          required: ['name', 'CR'],
        },
      },
      {
        name: 'update_campaign_creature',
        description: 'Update an existing homebrew campaign creature.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'number', description: 'The campaign creature id.' },
            name: { type: 'string', description: 'New name (optional).' },
            CR: { type: 'string', description: 'New CR (optional).' },
            AC: { type: 'number', description: 'New AC (optional).' },
            HPAverage: { type: 'number', description: 'New average HP (optional).' },
            traits: { type: 'array', items: { type: 'object' }, description: 'New traits array (optional).' },
            actions: { type: 'array', items: { type: 'object' }, description: 'New actions array (optional).' },
            summary: { type: 'string', description: 'One sentence describing the change.' },
          },
          required: ['id', 'summary'],
        },
      },
      {
        name: 'create_npc',
        description: 'Create an NPC in the campaign database with full campaign-specific fields (known info, secrets, faction, location). Preferred over create_character for campaign NPCs.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'NPC name.' },
            role: { type: 'string', description: 'Narrative role: Antagonist, Supporting, Ally, Quest Giver, Merchant, Minor, etc.' },
            description: { type: 'string', description: 'Physical appearance and personality — what players see.' },
            notes: { type: 'string', description: 'DM backstory and arc notes.' },
            knownInfo: { type: 'string', description: 'Information this NPC will share with players (optional).' },
            secrets: { type: 'string', description: 'Hidden truths about this NPC the players may discover (optional).' },
            voiceNotes: { type: 'string', description: 'Voice/accent/mannerism notes for RP (optional).' },
            statBlockRef: { type: 'string', description: 'Reference to stat block (e.g. "SRD: Bandit Captain", "Custom: Vorlag") (optional).' },
            traits: { type: 'array', items: { type: 'string' }, description: 'Personality traits, bonds, flaws (optional).' },
          },
          required: ['name'],
        },
      },
      {
        name: 'update_npc',
        description: 'Update an existing NPC with campaign-specific fields.',
        input_schema: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'The character id (from NPCs list in your context).' },
            name: { type: 'string', description: 'New name (optional).' },
            role: { type: 'string', description: 'New role (optional).' },
            description: { type: 'string', description: 'New description (optional).' },
            notes: { type: 'string', description: 'New notes (optional).' },
            knownInfo: { type: 'string', description: 'New known info (optional).' },
            secrets: { type: 'string', description: 'New secrets (optional).' },
            voiceNotes: { type: 'string', description: 'New voice notes (optional).' },
            statBlockRef: { type: 'string', description: 'New stat block reference (optional).' },
            traits: { type: 'array', items: { type: 'string' }, description: 'New traits array (optional).' },
            summary: { type: 'string', description: 'One sentence describing the change.' },
          },
          required: ['id', 'summary'],
        },
      },
      {
        name: 'search_spell',
        description: 'Search the SRD spell library by name, level, school, or class.',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Partial spell name to search for (optional).' },
            level: { type: 'number', description: 'Spell level 0–9 (optional).' },
            school: { type: 'string', description: 'School of magic: evocation, necromancy, conjuration, etc. (optional).' },
            class: { type: 'string', description: 'Class name: wizard, cleric, druid, sorcerer, etc. (optional).' },
          },
        },
      },
    ] : []),
  ]

  // ── Tool executor ─────────────────────────────────────────────────────────

  const onToolCall = async (name: string, input: Record<string, unknown>): Promise<string> => {
    if (name === 'get_document') {
      const { key } = input as { key: string }
      // Always fetch fresh from DB so we get the latest content
      const doc = await prisma.projectDocument.findUnique({
        where: { projectId_key: { projectId: project.id, key } },
      })
      if (!doc) return `Error: document "${key}" not found.`
      return `Full content of "${doc.title}":\n\n${doc.content || '(empty)'}`
    }
    if (name === 'patch_document') {
      const { key, find, replace, summary } = input as { key: string; find: string; replace: string; summary: string }
      const doc = await prisma.projectDocument.findUnique({
        where: { projectId_key: { projectId: project.id, key } },
      })
      if (!doc) return `Error: document "${key}" not found.`
      if (!doc.content.includes(find)) return `Error: the text to find was not found in "${key}". Call get_document to check the exact current content.`
      const newContent = doc.content.replace(find, replace)
      await prisma.projectDocument.update({
        where: { projectId_key: { projectId: project.id, key } },
        data: { content: newContent },
      })
      return `Patched "${doc.title}". ${summary}`
    }
    if (name === 'update_document') {
      const { key, content, summary } = input as { key: string; content: string; summary: string }
      const doc = documents.find(d => d.key === key)
      if (!doc) return `Error: document "${key}" not found in this project.`
      await prisma.projectDocument.update({
        where: { projectId_key: { projectId: project.id, key } },
        data: { content: content ?? '' },
      })
      return `Successfully updated "${doc.title}". ${summary}`
    }
    if (name === 'create_chapter') {
      const { title, content, synopsis } = input as { title: string; content: string; synopsis?: string }
      if (!title?.trim()) return 'Error: title is required.'
      const maxOrder = await prisma.chapter.findFirst({
        where: { projectId: project.id }, orderBy: { order: 'desc' }, select: { order: true },
      })
      const newChapter = await prisma.chapter.create({
        data: {
          projectId: project.id,
          title: title.trim(),
          content: content ?? '',
          synopsis: synopsis?.trim() ?? '',
          order: (maxOrder?.order ?? 0) + 1,
        },
      })
      return `Created chapter "${newChapter.title}" with id: ${newChapter.id}`
    }
    if (name === 'create_character') {
      const { name, role, description, notes, traits } = input as {
        name: string
        role?: string
        description?: string
        notes?: string
        traits?: string[]
      }
      console.log('[create_character] called with:', { name, role, projectId: project.id })
      if (!name?.trim()) return 'Error: name is required.'

      const existingCharacter = await prisma.character.findFirst({
        where: { projectId: project.id, name: name.trim() },
      })
      if (existingCharacter) {
        return `Error: character "${name.trim()}" already exists with id ${existingCharacter.id}. Use update_character instead.`
      }

      const newCharacter = await prisma.character.create({
        data: {
          projectId: project.id,
          name: name.trim(),
          role: role?.trim() || 'Supporting',
          description: description?.trim() ?? '',
          notes: notes?.trim() ?? '',
          traits: JSON.stringify((traits ?? []).map((trait) => String(trait).trim()).filter(Boolean)),
        },
      })
      console.log('[create_character] created:', newCharacter.id)
      return `Created character "${newCharacter.name}" with id: ${newCharacter.id}`
    }
    if (name === 'get_character') {
      const { id } = input as { id: string }
      const character = await prisma.character.findUnique({ where: { id } })
      if (!character || character.projectId !== project.id) return `Error: character "${id}" not found in this project.`
      return `Stored character record for "${character.name}":\n\n${JSON.stringify({
        id: character.id,
        name: character.name,
        role: character.role,
        description: character.description,
        notes: character.notes,
        traits: (() => {
          try { return JSON.parse(character.traits) } catch { return [] }
        })(),
      }, null, 2)}`
    }
    if (name === 'find_character_by_name') {
      const { name } = input as { name: string }
      if (!name?.trim()) return 'Error: name is required.'
      const matches = await prisma.character.findMany({
        where: {
          projectId: project.id,
          name: { contains: name.trim() },
        },
        orderBy: { name: 'asc' },
      })
      if (matches.length === 0) return `No characters found matching "${name.trim()}".`
      return matches.map((character) => {
        let traits: string[] = []
        try { traits = JSON.parse(character.traits) } catch {}
        return `- ${character.name} (id: ${character.id}, role: ${character.role})${character.description ? ` — ${character.description}` : ''}${traits.length > 0 ? ` | Traits: ${traits.join(', ')}` : ''}`
      }).join('\n')
    }
    if (name === 'update_character') {
      const { id, name, role, description, notes, traits, summary } = input as {
        id: string
        name: string
        role: string
        description: string
        notes: string
        traits: string[]
        summary: string
      }
      const character = await prisma.character.findUnique({ where: { id } })
      if (!character || character.projectId !== project.id) return `Error: character "${id}" not found in this project.`
      await prisma.character.update({
        where: { id },
        data: {
          name: name?.trim() ?? character.name,
          role: role?.trim() ?? character.role,
          description: description ?? '',
          notes: notes ?? '',
          traits: JSON.stringify((traits ?? []).map((trait) => String(trait).trim()).filter(Boolean)),
        },
      })
      return `Updated character "${name?.trim() || character.name}". ${summary}`
    }
    if (name === 'delete_character') {
      const { id, summary } = input as { id: string; summary: string }
      const character = await prisma.character.findUnique({ where: { id } })
      if (!character || character.projectId !== project.id) return `Error: character "${id}" not found in this project.`
      await prisma.character.delete({ where: { id } })
      return `Deleted character "${character.name}". ${summary}`
    }
    if (name === 'sync_characters_batch') {
      const { entries, summary } = input as {
        entries: Array<{
          name: string
          role?: string
          description?: string
          notes?: string
          traits?: string[]
        }>
        summary: string
      }
      if (!Array.isArray(entries) || entries.length === 0) return 'Error: entries must contain at least one character.'

      let created = 0
      let updated = 0
      for (const entry of entries) {
        const characterName = entry.name?.trim()
        if (!characterName) continue

        const existingCharacter = await prisma.character.findFirst({
          where: { projectId: project.id, name: characterName },
        })

        const data = {
          name: characterName,
          role: entry.role?.trim() || 'Supporting',
          description: entry.description?.trim() ?? '',
          notes: entry.notes?.trim() ?? '',
          traits: JSON.stringify((entry.traits ?? []).map((trait) => String(trait).trim()).filter(Boolean)),
        }

        if (existingCharacter) {
          await prisma.character.update({
            where: { id: existingCharacter.id },
            data,
          })
          updated++
        } else {
          await prisma.character.create({
            data: {
              projectId: project.id,
              ...data,
            },
          })
          created++
        }
      }

      return `Character sync complete. Created ${created}, updated ${updated}. ${summary}`
    }
    if (name === 'create_world_entry') {
      const { name, type, description, notes } = input as {
        name: string
        type?: string
        description?: string
        notes?: string
      }
      console.log('[create_world_entry] called with:', { name, type, projectId: project.id })
      if (!name?.trim()) return 'Error: name is required.'

      const existingEntry = await prisma.worldEntry.findFirst({
        where: { projectId: project.id, name: name.trim() },
      })
      if (existingEntry) {
        return `Error: world entry "${name.trim()}" already exists with id ${existingEntry.id}. Use update_world_entry instead.`
      }

      const entry = await prisma.worldEntry.create({
        data: {
          projectId: project.id,
          name: name.trim(),
          type: type?.trim() || 'Location',
          description: description?.trim() ?? '',
          notes: notes?.trim() ?? '',
        },
      })
      console.log('[create_world_entry] created:', entry.id)
      return `Created world entry "${entry.name}" with id: ${entry.id}`
    }
    if (name === 'get_world_entry') {
      const { id } = input as { id: string }
      const entry = await prisma.worldEntry.findUnique({ where: { id } })
      if (!entry || entry.projectId !== project.id) return `Error: world entry "${id}" not found in this project.`
      return `Stored world entry for "${entry.name}":\n\n${JSON.stringify({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        description: entry.description,
        notes: entry.notes,
      }, null, 2)}`
    }
    if (name === 'find_world_entry_by_name') {
      const { name } = input as { name: string }
      if (!name?.trim()) return 'Error: name is required.'
      const matches = await prisma.worldEntry.findMany({
        where: {
          projectId: project.id,
          name: { contains: name.trim() },
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      })
      if (matches.length === 0) return `No world entries found matching "${name.trim()}".`
      return matches.map((entry) =>
        `- ${entry.name} (id: ${entry.id}, type: ${entry.type})${entry.description ? ` — ${entry.description}` : ''}`
      ).join('\n')
    }
    if (name === 'update_world_entry') {
      const { id, name, type, description, notes, summary } = input as {
        id: string
        name: string
        type: string
        description: string
        notes: string
        summary: string
      }
      const entry = await prisma.worldEntry.findUnique({ where: { id } })
      if (!entry || entry.projectId !== project.id) return `Error: world entry "${id}" not found in this project.`
      await prisma.worldEntry.update({
        where: { id },
        data: {
          name: name?.trim() ?? entry.name,
          type: type?.trim() ?? entry.type,
          description: description ?? '',
          notes: notes ?? '',
        },
      })
      return `Updated world entry "${name?.trim() || entry.name}". ${summary}`
    }
    if (name === 'delete_world_entry') {
      const { id, summary } = input as { id: string; summary: string }
      const entry = await prisma.worldEntry.findUnique({ where: { id } })
      if (!entry || entry.projectId !== project.id) return `Error: world entry "${id}" not found in this project.`
      await prisma.worldEntry.delete({ where: { id } })
      return `Deleted world entry "${entry.name}". ${summary}`
    }
    if (name === 'sync_world_entries_batch') {
      const { entries, summary } = input as {
        entries: Array<{
          name: string
          type?: string
          description?: string
          notes?: string
        }>
        summary: string
      }
      if (!Array.isArray(entries) || entries.length === 0) return 'Error: entries must contain at least one world entry.'

      let created = 0
      let updated = 0
      for (const entry of entries) {
        const entryName = entry.name?.trim()
        if (!entryName) continue

        const existingEntry = await prisma.worldEntry.findFirst({
          where: { projectId: project.id, name: entryName },
        })

        const data = {
          name: entryName,
          type: entry.type?.trim() || 'Location',
          description: entry.description?.trim() ?? '',
          notes: entry.notes?.trim() ?? '',
        }

        if (existingEntry) {
          await prisma.worldEntry.update({
            where: { id: existingEntry.id },
            data,
          })
          updated++
        } else {
          await prisma.worldEntry.create({
            data: {
              projectId: project.id,
              ...data,
            },
          })
          created++
        }
      }

      return `World entry sync complete. Created ${created}, updated ${updated}. ${summary}`
    }
    if (name === 'get_chapter') {
      const { id } = input as { id: string }
      const chapter = await prisma.chapter.findUnique({ where: { id } })
      if (!chapter) return `Error: chapter "${id}" not found.`
      return `Full content of chapter "${chapter.title}":\n\n${chapter.content || '(empty)'}`
    }
    if (name === 'patch_chapter') {
      const { id, find, replace, summary } = input as { id: string; find: string; replace: string; summary: string }
      const chapter = await prisma.chapter.findUnique({ where: { id } })
      if (!chapter) return `Error: chapter "${id}" not found.`
      if (!chapter.content.includes(find)) return `Error: the text to find was not found in "${chapter.title}". Call get_chapter to check the exact current content.`
      await prisma.chapter.update({ where: { id }, data: { content: chapter.content.replace(find, replace) } })
      return `Patched chapter "${chapter.title}". ${summary}`
    }
    if (name === 'update_chapter') {
      const { id, content, summary } = input as { id: string; content: string; summary: string }
      const chapter = await prisma.chapter.findUnique({ where: { id } })
      if (!chapter) return `Error: chapter "${id}" not found.`
      await prisma.chapter.update({ where: { id }, data: { content: content ?? '' } })
      return `Updated chapter "${chapter.title}". ${summary}`
    }
    if (name === 'get_tasks') {
      const { assignedTo, status } = input as { assignedTo?: string; status?: string }
      const filtered = await prisma.task.findMany({
        where: {
          projectId: project.id,
          ...(assignedTo ? { assignedTo } : {}),
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: 'asc' },
      })
      if (filtered.length === 0) return 'No tasks found matching those filters.'
      return filtered.map(t => `[${t.status}] @${t.assignedTo}: "${t.title}"${t.description ? ` — ${t.description}` : ''}`).join('\n')
    }
    if (name === 'assign_task') {
      const { assignedTo, title, description } = input as { assignedTo: string; title: string; description?: string }
      console.log('[assign_task] called with:', { assignedTo, title, projectId: project.id })
      if (!assignedTo?.trim()) return 'Error: assignedTo is required.'
      if (!title?.trim()) return 'Error: title is required.'
      try {
        const newTask = await prisma.task.create({
          data: {
            projectId: project.id,
            assignedTo: assignedTo.trim(),
            title: title.trim(),
            description: description?.trim() ?? '',
            createdBy: 'Daneel',
          },
        })
        console.log('[assign_task] created:', newTask.id)
        createdTask = newTask
        return `Task assigned to @${assignedTo.trim()}: "${title.trim()}"${description ? ` — ${description}` : ''}`
      } catch (err) {
        console.error('[assign_task] DB error:', err)
        return `Error creating task: ${err instanceof Error ? err.message : String(err)}`
      }
    }
    if (name === 'assign_tasks_batch') {
      const { tasks, summary } = input as {
        tasks: Array<{ assignedTo: string; title: string; description?: string }>
        summary: string
      }
      if (!Array.isArray(tasks) || tasks.length === 0) return 'Error: tasks must contain at least one task.'

      let created = 0
      for (const task of tasks) {
        const assignedTo = task.assignedTo?.trim()
        const title = task.title?.trim()
        if (!assignedTo || !title) continue
        await prisma.task.create({
          data: {
            projectId: project.id,
            assignedTo,
            title,
            description: task.description?.trim() ?? '',
            createdBy: 'Daneel',
          },
        })
        created++
      }
      return `Task batch complete. Created ${created} task${created === 1 ? '' : 's'}. ${summary}`
    }
    if (name === 'create_poll') {
      const { question, options } = input as { question: string; options: string[] }
      console.log('[create_poll] called with:', { question, options, projectId: project.id })
      if (!question?.trim()) return 'Error: question is required.'
      const valid = (options ?? []).filter((o: string) => o?.trim())
      if (valid.length < 2) return 'Error: at least 2 options are required.'
      if (valid.length > 6) return 'Error: maximum 6 options allowed.'
      const newPoll = await prisma.poll.create({
        data: {
          projectId: project.id,
          question: question.trim(),
          options: JSON.stringify(valid.map((o: string) => o.trim())),
          createdBy: 'Daneel',
        },
        include: { votes: true },
      })
      console.log('[create_poll] created:', newPoll.id)
      createdPoll = { ...newPoll, options: JSON.parse(newPoll.options) }
      return `Poll created: "${question.trim()}" with options: ${valid.join(', ')}`
    }
    if (name === 'create_polls_batch') {
      const { polls, summary } = input as {
        polls: Array<{ question: string; options: string[] }>
        summary: string
      }
      if (!Array.isArray(polls) || polls.length === 0) return 'Error: polls must contain at least one poll.'

      let created = 0
      for (const poll of polls) {
        const question = poll.question?.trim()
        const valid = (poll.options ?? []).filter((option) => option?.trim()).map((option) => option.trim())
        if (!question || valid.length < 2 || valid.length > 6) continue
        const newPoll = await prisma.poll.create({
          data: {
            projectId: project.id,
            question,
            options: JSON.stringify(valid),
            createdBy: 'Daneel',
          },
          include: { votes: true },
        })
        createdPoll = { ...newPoll, options: JSON.parse(newPoll.options) }
        created++
      }
      return `Poll batch complete. Created ${created} poll${created === 1 ? '' : 's'}. ${summary}`
    }
    // ── Campaign tool handlers ────────────────────────────────────────────
    if (name === 'create_session') {
      const { title, synopsis, intendedLevel } = input as { title: string; synopsis?: string; intendedLevel?: number }
      if (!title?.trim()) return 'Error: title is required.'
      const maxOrder = await prisma.chapter.findFirst({
        where: { projectId: project.id }, orderBy: { order: 'desc' }, select: { order: true },
      })
      const part = await prisma.chapter.create({
        data: {
          projectId: project.id,
          title: title.trim(),
          content: '',
          synopsis: synopsis?.trim() ?? '',
          order: (maxOrder?.order ?? 0) + 1,
          ...(intendedLevel != null ? { intendedLevel } : {}),
        },
      })
      return `Created adventure part "${part.title}" (id: ${part.id})${intendedLevel != null ? ` [Level ${intendedLevel}]` : ''}`
    }
    if (name === 'update_session') {
      const { id, title, synopsis, intendedLevel, summary } = input as { id: string; title?: string; synopsis?: string; intendedLevel?: number; summary: string }
      const chapter = await prisma.chapter.findUnique({ where: { id } })
      if (!chapter || chapter.projectId !== project.id) return `Error: adventure part "${id}" not found.`
      await prisma.chapter.update({
        where: { id },
        data: {
          ...(title ? { title: title.trim() } : {}),
          ...(synopsis != null ? { synopsis: synopsis.trim() } : {}),
          ...(intendedLevel != null ? { intendedLevel } : {}),
        },
      })
      return `Updated adventure part "${title?.trim() ?? chapter.title}". ${summary}`
    }
    if (name === 'create_location') {
      const { name: locName, locationType, description, atmosphere, parentLocationId } = input as {
        name: string; locationType?: string; description?: string; atmosphere?: string; parentLocationId?: number
      }
      if (!locName?.trim()) return 'Error: name is required.'
      const loc = await prisma.location.create({
        data: {
          projectId: project.id,
          name: locName.trim(),
          locationType: locationType?.trim() ?? 'dungeon',
          description: description?.trim() ?? '',
          atmosphere: atmosphere?.trim() ?? '',
          ...(parentLocationId != null ? { parentLocationId } : {}),
        },
      })
      return `Created location "${loc.name}" (id: ${loc.id}, type: ${loc.locationType})`
    }
    if (name === 'update_location') {
      const { id, name: locName, locationType, description, atmosphere, summary } = input as {
        id: number; name?: string; locationType?: string; description?: string; atmosphere?: string; summary: string
      }
      const loc = await prisma.location.findUnique({ where: { id } })
      if (!loc || loc.projectId !== project.id) return `Error: location "${id}" not found.`
      await prisma.location.update({
        where: { id },
        data: {
          ...(locName ? { name: locName.trim() } : {}),
          ...(locationType ? { locationType: locationType.trim() } : {}),
          ...(description != null ? { description: description.trim() } : {}),
          ...(atmosphere != null ? { atmosphere: atmosphere.trim() } : {}),
        },
      })
      return `Updated location "${locName?.trim() ?? loc.name}". ${summary}`
    }
    if (name === 'create_keyed_area') {
      const { locationId, key, title, readAloud, dmNotes, connections } = input as {
        locationId: number; key: string; title: string; readAloud?: string; dmNotes?: string; connections?: string[]
      }
      if (!locationId) return 'Error: locationId is required.'
      if (!key?.trim()) return 'Error: key is required.'
      if (!title?.trim()) return 'Error: title is required.'
      const loc = await prisma.location.findUnique({ where: { id: locationId } })
      if (!loc || loc.projectId !== project.id) return `Error: location "${locationId}" not found.`
      const maxOrder = await prisma.keyedArea.findFirst({
        where: { locationId }, orderBy: { order: 'desc' }, select: { order: true },
      })
      const area = await prisma.keyedArea.create({
        data: {
          locationId,
          key: key.trim(),
          title: title.trim(),
          readAloud: readAloud?.trim() ?? '',
          dmNotes: dmNotes?.trim() ?? '',
          connections: JSON.stringify(connections ?? []),
          order: (maxOrder?.order ?? 0) + 1,
        },
      })
      return `Created keyed area "${area.key}. ${area.title}" (id: ${area.id}) in ${loc.name}`
    }
    if (name === 'update_keyed_area') {
      const { id, title, readAloud, dmNotes, summary } = input as {
        id: number; title?: string; readAloud?: string; dmNotes?: string; summary: string
      }
      const area = await prisma.keyedArea.findUnique({ where: { id } })
      if (!area) return `Error: keyed area "${id}" not found.`
      await prisma.keyedArea.update({
        where: { id },
        data: {
          ...(title ? { title: title.trim() } : {}),
          ...(readAloud != null ? { readAloud: readAloud.trim() } : {}),
          ...(dmNotes != null ? { dmNotes: dmNotes.trim() } : {}),
        },
      })
      return `Updated keyed area "${title?.trim() ?? area.title}". ${summary}`
    }
    if (name === 'create_encounter') {
      const { name: encName, encounterType, difficulty, summary: encSummary, readAloud, tactics, dmNotes, rewardText, locationId, keyedAreaId } = input as {
        name: string; encounterType?: string; difficulty?: string; summary?: string; readAloud?: string; tactics?: string; dmNotes?: string; rewardText?: string; locationId?: number; keyedAreaId?: number
      }
      if (!encName?.trim()) return 'Error: name is required.'
      const enc = await prisma.encounter.create({
        data: {
          projectId: project.id,
          name: encName.trim(),
          encounterType: encounterType?.trim() ?? 'combat',
          difficulty: difficulty?.trim() ?? 'medium',
          summary: encSummary?.trim() ?? '',
          readAloud: readAloud?.trim() ?? '',
          tactics: tactics?.trim() ?? '',
          dmNotes: dmNotes?.trim() ?? '',
          rewardText: rewardText?.trim() ?? '',
          ...(locationId != null ? { locationId } : {}),
          ...(keyedAreaId != null ? { keyedAreaId } : {}),
        },
      })
      return `Created ${enc.encounterType} encounter "${enc.name}" (id: ${enc.id}, difficulty: ${enc.difficulty})`
    }
    if (name === 'update_encounter') {
      const { id, name: encName, difficulty, summary: encSummary, tactics, dmNotes, rewardText, editSummary } = input as {
        id: number; name?: string; difficulty?: string; summary?: string; tactics?: string; dmNotes?: string; rewardText?: string; editSummary: string
      }
      const enc = await prisma.encounter.findUnique({ where: { id } })
      if (!enc || enc.projectId !== project.id) return `Error: encounter "${id}" not found.`
      await prisma.encounter.update({
        where: { id },
        data: {
          ...(encName ? { name: encName.trim() } : {}),
          ...(difficulty ? { difficulty: difficulty.trim() } : {}),
          ...(encSummary != null ? { summary: encSummary.trim() } : {}),
          ...(tactics != null ? { tactics: tactics.trim() } : {}),
          ...(dmNotes != null ? { dmNotes: dmNotes.trim() } : {}),
          ...(rewardText != null ? { rewardText: rewardText.trim() } : {}),
        },
      })
      return `Updated encounter "${encName?.trim() ?? enc.name}". ${editSummary}`
    }
    if (name === 'add_creature_to_encounter') {
      const { encounterId, srdCreatureId, campaignCreatureId, quantity, notes } = input as {
        encounterId: number; srdCreatureId?: number; campaignCreatureId?: number; quantity?: number; notes?: string
      }
      if (!encounterId) return 'Error: encounterId is required.'
      if (!srdCreatureId && !campaignCreatureId) return 'Error: srdCreatureId or campaignCreatureId is required.'
      const enc = await prisma.encounter.findUnique({ where: { id: encounterId } })
      if (!enc || enc.projectId !== project.id) return `Error: encounter "${encounterId}" not found.`
      const ec = await prisma.encounterCreature.create({
        data: {
          encounterId,
          quantity: quantity ?? 1,
          ...(srdCreatureId != null ? { srdCreatureId } : {}),
          ...(campaignCreatureId != null ? { campaignCreatureId } : {}),
          notes: notes?.trim() ?? '',
        },
      })
      let creatureName = `creature id ${srdCreatureId ?? campaignCreatureId}`
      if (srdCreatureId) {
        const srd = await prisma.srdCreature.findUnique({ where: { id: srdCreatureId }, select: { name: true } })
        if (srd) creatureName = srd.name
      }
      return `Added ${ec.quantity}× ${creatureName} to encounter "${enc.name}"`
    }
    if (name === 'search_creature') {
      const { name: cName, type, crMin, crMax, legendary } = input as {
        name?: string; type?: string; crMin?: string; crMax?: string; legendary?: boolean
      }
      const CR_ORDER = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','30']
      const creatures = await prisma.srdCreature.findMany({
        where: {
          ...(cName ? { name: { contains: cName } } : {}),
          ...(type ? { creatureType: { contains: type } } : {}),
          ...(legendary === true ? { isLegendary: true } : {}),
        },
        orderBy: { name: 'asc' },
        take: 50,
        select: { id: true, name: true, size: true, creatureType: true, alignment: true, CR: true, xpValue: true, AC: true, HPAverage: true, isLegendary: true },
      })
      let results = creatures
      if (crMin || crMax) {
        const minIdx = crMin ? CR_ORDER.indexOf(crMin) : 0
        const maxIdx = crMax ? CR_ORDER.indexOf(crMax) : CR_ORDER.length - 1
        results = creatures.filter(c => { const idx = CR_ORDER.indexOf(c.CR); return idx >= minIdx && idx <= maxIdx })
      }
      if (results.length === 0) return 'No creatures found matching those criteria.'
      return results.map(c => `- **${c.name}** (id: ${c.id}) | CR ${c.CR} | ${c.size} ${c.creatureType} | AC ${c.AC}, HP ${c.HPAverage}${c.isLegendary ? ' | Legendary' : ''}`).join('\n')
    }
    if (name === 'get_creature') {
      const { id } = input as { id: number }
      const creature = await prisma.srdCreature.findUnique({ where: { id } })
      if (!creature) return `Error: SRD creature "${id}" not found.`
      return `**${creature.name}** (CR ${creature.CR})\n${JSON.stringify(creature, null, 2)}`
    }
    if (name === 'create_quest') {
      const { name: qName, questType, description, rewardText, giverCharacterId } = input as {
        name: string; questType?: string; description?: string; rewardText?: string; giverCharacterId?: string
      }
      if (!qName?.trim()) return 'Error: name is required.'
      const quest = await prisma.quest.create({
        data: {
          projectId: project.id,
          name: qName.trim(),
          questType: questType?.trim() ?? 'main',
          description: description?.trim() ?? '',
          rewardText: rewardText?.trim() ?? '',
          ...(giverCharacterId ? { giverCharacterId } : {}),
        },
      })
      return `Created ${quest.questType} quest "${quest.name}" (id: ${quest.id})`
    }
    if (name === 'update_quest') {
      const { id, name: qName, description, rewardText, summary } = input as {
        id: number; name?: string; description?: string; rewardText?: string; summary: string
      }
      const quest = await prisma.quest.findUnique({ where: { id } })
      if (!quest || quest.projectId !== project.id) return `Error: quest "${id}" not found.`
      await prisma.quest.update({
        where: { id },
        data: {
          ...(qName ? { name: qName.trim() } : {}),
          ...(description != null ? { description: description.trim() } : {}),
          ...(rewardText != null ? { rewardText: rewardText.trim() } : {}),
        },
      })
      return `Updated quest "${qName?.trim() ?? quest.name}". ${summary}`
    }
    if (name === 'advance_quest') {
      const { id, status, summary } = input as { id: number; status: string; summary: string }
      const quest = await prisma.quest.findUnique({ where: { id } })
      if (!quest || quest.projectId !== project.id) return `Error: quest "${id}" not found.`
      await prisma.quest.update({ where: { id }, data: { status: status.trim() } })
      return `Quest "${quest.name}" → ${status}. ${summary}`
    }
    if (name === 'create_timeline_event') {
      const { name: evName, inWorldDay, description, triggerCondition, consequence } = input as {
        name: string; inWorldDay: number; description: string; triggerCondition?: string; consequence?: string
      }
      if (!evName?.trim()) return 'Error: name is required.'
      const ev = await prisma.timelineEvent.create({
        data: {
          projectId: project.id,
          name: evName.trim(),
          inWorldDay: inWorldDay ?? 0,
          description: description?.trim() ?? '',
          triggerCondition: triggerCondition?.trim() ?? '',
          consequence: consequence?.trim() ?? '',
        },
      })
      return `Created timeline event "${ev.name}" on day ${ev.inWorldDay} (id: ${ev.id})`
    }
    if (name === 'update_timeline_event') {
      const { id, name: evName, inWorldDay, description, triggerCondition, consequence, summary } = input as {
        id: number; name?: string; inWorldDay?: number; description?: string; triggerCondition?: string; consequence?: string; summary: string
      }
      const ev = await prisma.timelineEvent.findUnique({ where: { id } })
      if (!ev || ev.projectId !== project.id) return `Error: timeline event "${id}" not found.`
      await prisma.timelineEvent.update({
        where: { id },
        data: {
          ...(evName ? { name: evName.trim() } : {}),
          ...(inWorldDay != null ? { inWorldDay } : {}),
          ...(description != null ? { description: description.trim() } : {}),
          ...(triggerCondition != null ? { triggerCondition: triggerCondition.trim() } : {}),
          ...(consequence != null ? { consequence: consequence.trim() } : {}),
        },
      })
      return `Updated timeline event "${evName?.trim() ?? ev.name}". ${summary}`
    }
    if (name === 'create_random_table') {
      const { name: tName, tableCategory, dieSize, description, entries } = input as {
        name: string; tableCategory?: string; dieSize?: string; description?: string; entries: Array<{ roll: number; text: string }>
      }
      if (!tName?.trim()) return 'Error: name is required.'
      if (!Array.isArray(entries) || entries.length === 0) return 'Error: entries must contain at least one entry.'
      const table = await prisma.randomTable.create({
        data: {
          projectId: project.id,
          name: tName.trim(),
          tableCategory: tableCategory?.trim() ?? 'custom',
          dieSize: dieSize?.trim() ?? 'd20',
          description: description?.trim() ?? '',
          entries: JSON.stringify(entries),
        },
      })
      return `Created random table "${table.name}" (id: ${table.id}) with ${entries.length} entries`
    }
    if (name === 'roll_on_table') {
      const { id } = input as { id: number }
      const table = await prisma.randomTable.findUnique({ where: { id } })
      if (!table || table.projectId !== project.id) return `Error: random table "${id}" not found.`
      let entries: Array<{ roll: number; text: string }> = []
      try { entries = JSON.parse(table.entries) } catch { return 'Error: table entries are malformed.' }
      if (entries.length === 0) return 'Error: table has no entries.'
      const dieSizes: Record<string, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }
      const max = dieSizes[table.dieSize] ?? 20
      const roll = Math.floor(Math.random() * max) + 1
      const sorted = [...entries].sort((a, b) => a.roll - b.roll)
      const result = sorted.find(e => e.roll >= roll) ?? sorted[sorted.length - 1]
      return `Rolled ${table.dieSize} on "${table.name}": **${roll}** → ${result.text}`
    }
    if (name === 'create_campaign_magic_item') {
      const { name: iName, rarity, itemType, description, requiresAttunement, attunementNotes, chargesMax, rechargeCondition, properties, lore } = input as {
        name: string; rarity?: string; itemType?: string; description: string; requiresAttunement?: boolean; attunementNotes?: string; chargesMax?: number; rechargeCondition?: string; properties?: string; lore?: string
      }
      if (!iName?.trim()) return 'Error: name is required.'
      const item = await prisma.campaignMagicItem.create({
        data: {
          projectId: project.id,
          name: iName.trim(),
          rarity: rarity?.trim() ?? 'uncommon',
          itemType: itemType?.trim() ?? 'wondrous',
          description: description?.trim() ?? '',
          requiresAttunement: requiresAttunement ?? false,
          attunementNotes: attunementNotes?.trim() ?? '',
          ...(chargesMax != null ? { chargesMax } : {}),
          rechargeCondition: rechargeCondition?.trim() ?? '',
          properties: properties?.trim() ?? '',
          lore: lore?.trim() ?? '',
        },
      })
      return `Created magic item "${item.name}" (id: ${item.id}, rarity: ${item.rarity})`
    }
    if (name === 'search_magic_item') {
      const { name: iName, rarity } = input as { name?: string; rarity?: string }
      const items = await prisma.srdMagicItem.findMany({
        where: {
          ...(iName ? { name: { contains: iName } } : {}),
          ...(rarity ? { rarity } : {}),
        },
        orderBy: { name: 'asc' },
        take: 50,
      })
      if (items.length === 0) return 'No SRD magic items found matching those criteria.'
      return items.map(i => `- **${i.name}** (id: ${i.id}) | ${i.rarity} ${i.itemType}${i.requiresAttunement ? ' | Requires attunement' : ''}`).join('\n')
    }
    if (name === 'create_campaign_creature') {
      const { name: cName, size, creatureType, alignment, CR, AC, HPAverage, HPDice, STR, DEX, CON, INT, WIS, CHA, traits, actions } = input as {
        name: string; size?: string; creatureType?: string; alignment?: string; CR: string; AC?: number; HPAverage?: number; HPDice?: string; STR?: number; DEX?: number; CON?: number; INT?: number; WIS?: number; CHA?: number; traits?: Array<{name: string; text: string}>; actions?: Array<{name: string; text: string}>
      }
      if (!cName?.trim()) return 'Error: name is required.'
      const creature = await prisma.campaignCreature.create({
        data: {
          projectId: project.id,
          name: cName.trim(),
          size: size?.trim() ?? 'Medium',
          creatureType: creatureType?.trim() ?? '',
          alignment: alignment?.trim() ?? '',
          CR: CR?.trim() ?? '0',
          AC: AC ?? 10,
          HPAverage: HPAverage ?? 1,
          HPDice: HPDice?.trim() ?? '',
          STR: STR ?? 10, DEX: DEX ?? 10, CON: CON ?? 10,
          INT: INT ?? 10, WIS: WIS ?? 10, CHA: CHA ?? 10,
          traits: JSON.stringify(traits ?? []),
          actions: JSON.stringify(actions ?? []),
        },
      })
      return `Created homebrew creature "${creature.name}" (id: ${creature.id}, CR ${creature.CR})`
    }
    if (name === 'update_campaign_creature') {
      const { id, name: cName, CR, AC, HPAverage, traits, actions, summary } = input as {
        id: number; name?: string; CR?: string; AC?: number; HPAverage?: number; traits?: Array<object>; actions?: Array<object>; summary: string
      }
      const creature = await prisma.campaignCreature.findUnique({ where: { id } })
      if (!creature || creature.projectId !== project.id) return `Error: campaign creature "${id}" not found.`
      await prisma.campaignCreature.update({
        where: { id },
        data: {
          ...(cName ? { name: cName.trim() } : {}),
          ...(CR ? { CR: CR.trim() } : {}),
          ...(AC != null ? { AC } : {}),
          ...(HPAverage != null ? { HPAverage } : {}),
          ...(traits != null ? { traits: JSON.stringify(traits) } : {}),
          ...(actions != null ? { actions: JSON.stringify(actions) } : {}),
        },
      })
      return `Updated campaign creature "${cName?.trim() ?? creature.name}". ${summary}`
    }
    if (name === 'create_npc') {
      const { name: npcName, role, description, notes, knownInfo, secrets, voiceNotes, statBlockRef, traits } = input as {
        name: string; role?: string; description?: string; notes?: string; knownInfo?: string; secrets?: string; voiceNotes?: string; statBlockRef?: string; traits?: string[]
      }
      if (!npcName?.trim()) return 'Error: name is required.'
      const existing = await prisma.character.findFirst({ where: { projectId: project.id, name: npcName.trim() } })
      if (existing) return `Error: NPC "${npcName.trim()}" already exists with id ${existing.id}. Use update_npc instead.`
      const npc = await prisma.character.create({
        data: {
          projectId: project.id,
          name: npcName.trim(),
          role: role?.trim() || 'Supporting',
          description: description?.trim() ?? '',
          notes: notes?.trim() ?? '',
          traits: JSON.stringify((traits ?? []).map(t => String(t).trim()).filter(Boolean)),
          knownInfo: knownInfo?.trim() ?? '',
          secrets: secrets?.trim() ?? '',
          voiceNotes: voiceNotes?.trim() ?? '',
          statBlockRef: statBlockRef?.trim() ?? '',
        },
      })
      return `Created NPC "${npc.name}" (id: ${npc.id})`
    }
    if (name === 'update_npc') {
      const { id, name: npcName, role, description, notes, knownInfo, secrets, voiceNotes, statBlockRef, traits, summary } = input as {
        id: string; name?: string; role?: string; description?: string; notes?: string; knownInfo?: string; secrets?: string; voiceNotes?: string; statBlockRef?: string; traits?: string[]; summary: string
      }
      const npc = await prisma.character.findUnique({ where: { id } })
      if (!npc || npc.projectId !== project.id) return `Error: NPC "${id}" not found in this project.`
      await prisma.character.update({
        where: { id },
        data: {
          ...(npcName ? { name: npcName.trim() } : {}),
          ...(role ? { role: role.trim() } : {}),
          ...(description != null ? { description: description.trim() } : {}),
          ...(notes != null ? { notes: notes.trim() } : {}),
          ...(traits != null ? { traits: JSON.stringify(traits.map(t => String(t).trim()).filter(Boolean)) } : {}),
          ...(knownInfo != null ? { knownInfo: knownInfo.trim() } : {}),
          ...(secrets != null ? { secrets: secrets.trim() } : {}),
          ...(voiceNotes != null ? { voiceNotes: voiceNotes.trim() } : {}),
          ...(statBlockRef != null ? { statBlockRef: statBlockRef.trim() } : {}),
        },
      })
      return `Updated NPC "${npcName?.trim() ?? npc.name}". ${summary}`
    }
    if (name === 'search_spell') {
      const { name: sName, level, school, class: className } = input as {
        name?: string; level?: number; school?: string; class?: string
      }
      const spells = await prisma.srdSpell.findMany({
        where: {
          ...(sName ? { name: { contains: sName } } : {}),
          ...(level != null ? { level } : {}),
          ...(school ? { school: { contains: school } } : {}),
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
        take: 50,
      })
      const results = className
        ? spells.filter(s => {
            try { return (JSON.parse(s.classes) as string[]).some(c => c.toLowerCase().includes(className.toLowerCase())) }
            catch { return false }
          })
        : spells
      if (results.length === 0) return 'No spells found matching those criteria.'
      return results.map(s => `- **${s.name}** (id: ${s.id}) | Level ${s.level} ${s.school}${s.concentration ? ' (Concentration)' : ''}${s.ritual ? ' (Ritual)' : ''} | ${s.castingTime}, ${s.range}`).join('\n')
    }
    return `Unknown tool: ${name}`
  }

  // ── Call AI ───────────────────────────────────────────────────────────────

  const aiModel = settings?.aiModel?.trim() || undefined

  let aiContent = ''
  let pollCreated = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createdPoll: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createdTask: any = null
  try {
    let text = ''
    let toolCallsMade: ToolCall[] = []

    if (provider === 'anthropic') {
      const result = await callAnthropicWithTools({
        messages: aiMessages, systemPrompt, apiKey: settings!.aiApiKey,
        model: aiModel, tools, onToolCall,
      })
      text = result.text
      toolCallsMade = result.toolCalls
    } else if (provider === 'openai') {
      const result = await callOpenAIWithTools({
        messages: aiMessages, systemPrompt, apiKey: settings!.aiApiKey,
        model: aiModel, tools, onToolCall,
      })
      text = result.text
      toolCallsMade = result.toolCalls
    } else {
      // OpenClaw — use tool protocol if tools are defined
      const result = await callOpenClawWithTools({
        messages: aiMessages, systemPrompt,
        openClawBaseUrl: settings!.openClawBaseUrl,
        openClawApiKey: settings!.openClawApiKey || undefined,
        openClawAgentId: settings!.openClawAgentId || undefined,
        context: openClawContext, tools, onToolCall,
      })
      text = result.text
      toolCallsMade = result.toolCalls
    }

    pollCreated = toolCallsMade.some(tc => tc.name === 'create_poll' || tc.name === 'create_polls_batch')
    const editLog = toolCallsMade
      .filter(tc => ['update_document', 'patch_document', 'create_chapter', 'create_character', 'update_character', 'delete_character', 'sync_characters_batch', 'create_world_entry', 'update_world_entry', 'delete_world_entry', 'sync_world_entries_batch', 'update_chapter', 'patch_chapter', 'create_poll', 'create_polls_batch', 'assign_task', 'assign_tasks_batch', 'create_session', 'update_session', 'create_location', 'create_keyed_area', 'create_encounter', 'update_encounter', 'add_creature_to_encounter', 'create_quest', 'update_quest', 'advance_quest', 'create_timeline_event', 'update_timeline_event', 'create_random_table', 'create_campaign_magic_item', 'create_campaign_creature', 'create_npc', 'update_npc'].includes(tc.name))
      .map(tc => {
        if (tc.name === 'create_poll') {
          const { question, options } = tc.input as { question: string; options: string[] }
          return `📊 Created poll: **"${question}"** — ${options.join(' / ')}`
        }
        if (tc.name === 'create_polls_batch') {
          const polls = (tc.input as { polls: Array<{ question: string }>; summary: string }).polls ?? []
          return `📊 Created ${polls.length} poll${polls.length === 1 ? '' : 's'}: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'assign_task') {
          const { assignedTo, title } = tc.input as { assignedTo: string; title: string }
          return `✓ Assigned task to @${assignedTo}: **"${title}"**`
        }
        if (tc.name === 'assign_tasks_batch') {
          const tasks = (tc.input as { tasks: Array<{ title: string }>; summary: string }).tasks ?? []
          return `✓ Assigned ${tasks.length} task${tasks.length === 1 ? '' : 's'}: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'create_chapter') {
          return `📖 Created chapter **"${(tc.input as { title: string }).title}"**`
        }
        if (tc.name === 'create_character') {
          return `👤 Added character **"${(tc.input as { name: string }).name}"**`
        }
        if (tc.name === 'update_character') {
          return `👤 Updated character **"${(tc.input as { name: string }).name}"**: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'delete_character') {
          const deleted = characters.find(c => c.id === (tc.input as { id: string }).id)
          return `👤 Removed character **"${deleted?.name ?? (tc.input as { id: string }).id}"**: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'sync_characters_batch') {
          const entries = (tc.input as { entries: Array<{ name: string }>; summary: string }).entries ?? []
          return `👥 Synced ${entries.length} character record${entries.length === 1 ? '' : 's'}: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'create_world_entry') {
          return `🌍 Added world entry **"${(tc.input as { name: string }).name}"**`
        }
        if (tc.name === 'update_world_entry') {
          return `🌍 Updated world entry **"${(tc.input as { name: string }).name}"**: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'delete_world_entry') {
          const deleted = worldEntries.find(w => w.id === (tc.input as { id: string }).id)
          return `🌍 Removed world entry **"${deleted?.name ?? (tc.input as { id: string }).id}"**: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'sync_world_entries_batch') {
          const entries = (tc.input as { entries: Array<{ name: string }>; summary: string }).entries ?? []
          return `🌍 Synced ${entries.length} ${entries.length === 1 ? 'world entry' : 'world entries'}: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'update_chapter' || tc.name === 'patch_chapter') {
          const chapter = chapters.find(c => c.id === (tc.input as { id: string }).id)
          return `📖 Updated chapter **"${chapter?.title ?? (tc.input as { id: string }).id}"**: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'create_session') {
          return `📖 Created adventure part **"${(tc.input as { title: string }).title}"**`
        }
        if (tc.name === 'update_session') {
          return `📖 Updated adventure part: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'create_location') {
          return `🗺️ Created location **"${(tc.input as { name: string }).name}"**`
        }
        if (tc.name === 'create_keyed_area') {
          return `🗺️ Created area **${(tc.input as { key: string }).key}. ${(tc.input as { title: string }).title}**`
        }
        if (tc.name === 'create_encounter') {
          return `⚔️ Created encounter **"${(tc.input as { name: string }).name}"**`
        }
        if (tc.name === 'update_encounter') {
          return `⚔️ Updated encounter: ${(tc.input as { editSummary: string }).editSummary}`
        }
        if (tc.name === 'add_creature_to_encounter') {
          return `⚔️ Added creature to encounter`
        }
        if (tc.name === 'create_quest') {
          return `📜 Created quest **"${(tc.input as { name: string }).name}"**`
        }
        if (tc.name === 'update_quest') {
          return `📜 Updated quest: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'advance_quest') {
          return `📜 Quest status updated: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'create_timeline_event') {
          return `⏱️ Added timeline event **"${(tc.input as { name: string }).name}"** on day ${(tc.input as { inWorldDay: number }).inWorldDay}`
        }
        if (tc.name === 'update_timeline_event') {
          return `⏱️ Updated timeline event: ${(tc.input as { summary: string }).summary}`
        }
        if (tc.name === 'create_random_table') {
          return `🎲 Created random table **"${(tc.input as { name: string }).name}"**`
        }
        if (tc.name === 'create_campaign_magic_item') {
          return `✨ Created magic item **"${(tc.input as { name: string }).name}"**`
        }
        if (tc.name === 'create_campaign_creature') {
          return `🐉 Created homebrew creature **"${(tc.input as { name: string }).name}"**`
        }
        if (tc.name === 'create_npc') {
          return `👤 Created NPC **"${(tc.input as { name: string }).name}"**`
        }
        if (tc.name === 'update_npc') {
          return `👤 Updated NPC: ${(tc.input as { summary: string }).summary}`
        }
        return `📝 Updated **${(tc.input as { key: string }).key}**: ${(tc.input as { summary: string }).summary}`
      })
      .join('\n')
    aiContent = editLog ? `${editLog}\n\n${text}` : text
  } catch (err) {
    console.error('[Daneel AI error]', err)
    aiContent = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }

  const aiMessage = await prisma.projectMessage.create({
    data: { projectId: project.id, role: 'assistant', author: 'Daneel', content: aiContent },
  })

  return NextResponse.json({ message, aiMessage, pollCreated, createdPoll, createdTask })
}
