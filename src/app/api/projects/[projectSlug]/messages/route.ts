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

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

  const systemPrompt = `You are Daneel, the AI assistant for the writing project "${project.name}". You are part of a collaborative team chat — multiple writers use this chat to coordinate.${project.description ? `\nProject: ${project.description}` : ''}

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
      .filter(tc => ['update_document', 'patch_document', 'create_chapter', 'create_character', 'update_character', 'delete_character', 'sync_characters_batch', 'create_world_entry', 'update_world_entry', 'delete_world_entry', 'sync_world_entries_batch', 'update_chapter', 'patch_chapter', 'create_poll', 'create_polls_batch', 'assign_task', 'assign_tasks_batch'].includes(tc.name))
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
