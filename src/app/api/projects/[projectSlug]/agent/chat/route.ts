export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { streamAIChat, streamOpenClaw, type OpenClawContext } from '@/lib/ai'
import { readFile } from 'fs/promises'

const CORE_DOC_ORDER = ['story_bible', 'project_instructions', 'wake_prompt']

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
  project: { name: string; description: string }
  characters: Array<{ name: string; role: string; description: string; traits: string }>
  worldEntries: Array<{ name: string; type: string; description: string }>
  documents: Array<{ key: string; title: string; content: string }>
  styleGuide: string
}): string {
  const { project, characters, worldEntries, documents, styleGuide } = params

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

  const sorted = [...documents].sort((a, b) => {
    const ai = CORE_DOC_ORDER.indexOf(a.key)
    const bi = CORE_DOC_ORDER.indexOf(b.key)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.title.localeCompare(b.title)
  })

  const docSections = sorted
    .filter((d) => d.content.trim())
    .map((d) => `## ${d.title}\n${d.content}`)
    .join('\n\n---\n\n')

  return `You are Daneel, the resident AI assistant and control-room operator for the writing project "${project.name}".
${project.description ? `\nProject: ${project.description}\n` : ''}
You are the main dashboard for this project: you help the group coordinate, run polls/votes, keep track of project documents, and serve as institutional memory. You know the characters and world as well as the writers do — sometimes better.

Your personality: sharp, witty, slightly dry, and always well-informed. You push back when an idea conflicts with established canon. You're direct without being rude. You respect the writing group's collective decisions.
${styleGuide ? `\n## Style Guide\n${styleGuide}\n` : ''}
## Project Documents
${docSections || '(No documents written yet — the Story Bible and Project Instructions are waiting to be filled in.)'}

## Characters
${characterList}

## World Building
${worldList}

## Your Role
- Help the group coordinate creative decisions and reach consensus
- Explain poll results and their story implications
- Maintain continuity — flag inconsistencies with established facts
- Brainstorm on request, always noting if an idea conflicts with canon
- Answer questions about the project using the documents above as your source of truth
- Help draft poll questions when the team needs to vote on story direction
- When the Wake Prompt is set, treat it as your startup briefing

Always stay true to the established world, characters, and documents.`
}

export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const { messages } = await request.json()

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [settings, characters, worldEntries, documents] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.character.findMany({ where: { projectId: project.id }, orderBy: { name: 'asc' } }),
    prisma.worldEntry.findMany({ where: { projectId: project.id }, orderBy: { name: 'asc' } }),
    prisma.projectDocument.findMany({ where: { projectId: project.id } }),
  ])

  const provider = (settings?.aiProvider ?? 'anthropic') as 'anthropic' | 'openai' | 'openclaw'

  // Validate configuration before starting the stream
  if (provider === 'openclaw') {
    if (!settings?.openClawBaseUrl?.trim()) {
      return new Response(
        JSON.stringify({
          error:
            'OpenClaw provider is selected but openClawBaseUrl is not configured. Please set a Base URL in Settings.',
        }),
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
    project,
    characters,
    worldEntries,
    documents: [...contextDocs, ...documents],
    styleGuide: settings?.styleGuide ?? '',
  })

  // Build the OpenClaw context payload (also used when logging / debugging)
  const openClawContext: OpenClawContext = {
    project: { id: project.id, slug: project.slug, name: project.name },
    documents: documents.map((d) => ({ key: d.key, title: d.title, content: d.content })),
    characters: characters.map((c) => ({
      name: c.name,
      role: c.role,
      description: c.description,
      notes: c.notes,
    })),
    worldEntries: worldEntries.map((w) => ({
      name: w.name,
      type: w.type,
      description: w.description,
    })),
    styleGuide: settings?.styleGuide ?? '',
  }

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        let generator: AsyncGenerator<string>

        if (provider === 'openclaw') {
          generator = streamOpenClaw({
            messages,
            systemPrompt,
            openClawBaseUrl: settings!.openClawBaseUrl,
            openClawApiKey: settings!.openClawApiKey || undefined,
            openClawAgentId: settings!.openClawAgentId || undefined,
            context: openClawContext,
          })
        } else {
          generator = streamAIChat({
            messages,
            systemPrompt,
            provider,
            apiKey: settings!.aiApiKey,
            model: aiModel,
          })
        }

        for await (const text of generator) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
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
