export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { streamAIChat, buildSystemPrompt } from '@/lib/ai'

export async function POST(request: Request) {
  const { messages, chapterId } = await request.json()

  // Load settings and context from the database
  const [settings, characters, worldEntries] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.character.findMany({ orderBy: { name: 'asc' } }),
    prisma.worldEntry.findMany({ orderBy: { name: 'asc' } }),
  ])

  if (!settings?.aiApiKey) {
    return new Response(
      JSON.stringify({ error: 'No API key configured. Go to Settings to add one.' }),
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
    styleGuide: settings.styleGuide,
    chapter,
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const generator = streamAIChat({
          messages,
          systemPrompt,
          provider: settings.aiProvider as 'anthropic' | 'openai',
          apiKey: settings.aiApiKey,
          model: settings.aiModel?.trim() || undefined,
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
