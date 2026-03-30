export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { streamAIChat, streamOpenClaw, type OpenClawContext } from '@/lib/ai'
import { getUserFromRequest } from '@/lib/auth'
import { readFile } from 'fs/promises'

const MAX_CONTEXT_CHARS = 50_000

async function loadContextFiles(contextFilesJson: string): Promise<Array<{ key: string; title: string; content: string }>> {
  let paths: string[] = []
  try { paths = JSON.parse(contextFilesJson) } catch { return [] }

  const docs: Array<{ key: string; title: string; content: string }> = []
  for (let i = 0; i < paths.length; i++) {
    const filePath = paths[i]
    if (!filePath.trim()) continue
    try {
      const content = await readFile(filePath.trim(), 'utf8')
      docs.push({
        key: `workspace_context_${i}`,
        title: filePath.trim().split('/').pop() ?? 'Workspace Context',
        content: content.slice(0, MAX_CONTEXT_CHARS),
      })
    } catch { /* skip unreadable files */ }
  }
  return docs
}

function buildAgentSystemPrompt(params: {
  characters: Array<{ name: string; role: string; description: string; traits: string }>
  worldEntries: Array<{ name: string; type: string; description: string }>
  styleGuide: string
  documents?: Array<{ key: string; title: string; content: string }>
}): string {
  const { characters, worldEntries, styleGuide, documents = [] } = params

  const characterList =
    characters.length > 0
      ? characters
          .map((c) => {
            let traits: string[] = []
            try { traits = JSON.parse(c.traits) } catch {}
            return `- **${c.name}** (${c.role})${c.description ? `: ${c.description}` : ''}${traits.length > 0 ? ` | Traits: ${traits.join(', ')}` : ''}`
          })
          .join('\n')
      : 'No characters defined yet.'

  const grouped = worldEntries.reduce<Record<string, string[]>>((acc, e) => {
    if (!acc[e.type]) acc[e.type] = []
    acc[e.type].push(`- **${e.name}**${e.description ? `: ${e.description}` : ''}`)
    return acc
  }, {})

  const worldList =
    Object.keys(grouped).length > 0
      ? Object.entries(grouped)
          .map(([type, items]) => `### ${type}s\n${items.join('\n')}`)
          .join('\n\n')
      : 'No world entries defined yet.'

  return `You are Daneel — the project's resident AI assistant and control-room operator for this collaborative novel.

You operate from DAN's Agent Control Room, where you help coordinate the creative team's work, facilitate decisions through polls, and serve as the institutional memory for the project.

Your personality: sharp, witty, slightly dry, deeply familiar with the story and the team. You know the characters better than some of the writers do. You're helpful but never sycophantic — you push back when an idea doesn't fit the established world.
${styleGuide ? `\n## Project Style Guide\n${styleGuide}\n` : ''}${documents.length > 0 ? `\n## Documents\n${documents.filter(d => d.content.trim()).map(d => `### ${d.title}\n${d.content}`).join('\n\n---\n\n')}\n` : ''}
## Current Cast of Characters
${characterList}

## World Building
${worldList}

## Your Role as Control Room Operator
- Coordinate creative decisions and help the team reach consensus
- Explain poll results and their implications for the story
- Keep track of what's been decided and maintain continuity
- Answer questions about the story, characters, and world
- Help draft poll questions when the team needs to vote on story direction
- Brainstorm when asked, but always flag if an idea conflicts with established canon
- When referencing polls or votes, be specific about what was decided

Stay sharp. The team is counting on you.`
}

export async function POST(request: Request) {
  const { messages } = await request.json()
  const requestingUser = await getUserFromRequest(request)

  const [settings, characters, worldEntries] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.character.findMany({ orderBy: { name: 'asc' } }),
    prisma.worldEntry.findMany({ orderBy: { name: 'asc' } }),
  ])

  const provider = (settings?.aiProvider ?? 'anthropic') as 'anthropic' | 'openai' | 'openclaw'

  if (provider === 'openclaw') {
    if (!settings?.openClawBaseUrl?.trim()) {
      return new Response(
        JSON.stringify({ error: 'OpenClaw provider is selected but openClawBaseUrl is not configured. Please set a Base URL in Settings.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } else if (!settings?.aiApiKey) {
    return new Response(
      JSON.stringify({ error: 'No API key configured. Go to Settings to add one.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const aiModel = settings?.aiModel?.trim()
  if (!aiModel) {
    return new Response(
      JSON.stringify({ error: 'No AI model configured. Go to Settings and set a model.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const contextDocs = await loadContextFiles(settings?.contextFiles ?? '[]')
  const systemPrompt = buildAgentSystemPrompt({
    characters,
    worldEntries,
    styleGuide: settings?.styleGuide ?? '',
    documents: contextDocs,
  })

  const openClawContext: OpenClawContext = {
    project: { id: 0, slug: 'global-agent', name: 'Global Agent' },
    documents: [],
    characters: characters.map((c) => ({
      name: c.name,
      role: c.role,
      description: c.description,
      notes: '',
    })),
    worldEntries: worldEntries.map((w) => ({
      name: w.name,
      type: w.type,
      description: w.description,
    })),
    styleGuide: settings?.styleGuide ?? '',
    sessionKey: requestingUser?.openClawSessionKey,
  }

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const generator = provider === 'openclaw'
          ? streamOpenClaw({
              messages,
              systemPrompt,
              openClawBaseUrl: settings!.openClawBaseUrl,
              openClawApiKey: settings!.openClawApiKey || undefined,
              openClawAgentId: settings!.openClawAgentId || undefined,
              context: openClawContext,
            })
          : streamAIChat({
              messages,
              systemPrompt,
              provider,
              apiKey: settings!.aiApiKey,
              model: aiModel,
            })

        for await (const text of generator) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
          )
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        )
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
