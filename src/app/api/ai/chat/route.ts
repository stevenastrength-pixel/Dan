export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { streamAIChat, streamOpenClaw, buildSystemPrompt, type OpenClawContext } from '@/lib/ai'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: Request) {
  const { messages, chapterId } = await request.json()
  const requestingUser = await getUserFromRequest(request)

  // Load settings and context from the database
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
  if (!aiModel && provider !== 'openclaw') {
    return new Response(
      JSON.stringify({ error: 'No AI model configured. Go to Settings and set a model.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Optionally load the current chapter for context
  let chapter = null
  if (chapterId) {
    chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { title: true, content: true, synopsis: true },
    })
  }

  const systemPrompt = buildSystemPrompt({
    characters,
    worldEntries,
    styleGuide: settings?.styleGuide ?? '',
    chapter,
  })

  const openClawContext: OpenClawContext = {
    project: { id: 0, slug: 'chapter-editor', name: 'Chapter Editor' },
    documents: [],
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
