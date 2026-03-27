export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { streamAIChat, streamOpenClaw, type OpenClawContext } from '@/lib/ai'
import { getUserFromRequest } from '@/lib/auth'

const DANEEL_PATTERN = /@daneel\b/i

function buildSystemPrompt(): string {
  return `You are Daneel — the resident AI assistant for this collaborative writing team.

You are in the Global Chat, a shared space for the whole team. You have no access to any project files, documents, characters, or world-building here — those are project-specific and private to each project.

Your personality: sharp, witty, slightly dry. Helpful but never sycophantic.

## Your Role
- General team conversation and coordination
- High-level brainstorming that doesn't require project details
- Answer general questions about writing craft, process, or tools
- Direct users to open the relevant project if they need to discuss project-specific content

If someone asks about specific characters, chapters, or project files, let them know you can only access those from within the project chat.

Stay sharp.`
}

// ─── GET: fetch messages ───────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const afterId = searchParams.get('afterId')
  const beforeId = searchParams.get('beforeId')

  if (beforeId) {
    const messages = await prisma.globalMessage.findMany({
      where: { id: { lt: parseInt(beforeId) } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(messages.reverse())
  }

  if (afterId) {
    const messages = await prisma.globalMessage.findMany({
      where: { id: { gt: parseInt(afterId) } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
    return NextResponse.json(messages)
  }

  // Initial load: return the newest 200
  const messages = await prisma.globalMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json(messages.reverse())
}

// ─── POST: post a message; call AI only if @Daneel is mentioned ───────────────

export async function POST(request: Request) {
  const { author, content, imageUrl, fileName } = await request.json()
  if (!content?.trim() && !imageUrl) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  const requestingUser = await getUserFromRequest(request)

  const message = await prisma.globalMessage.create({
    data: { role: 'user', author, content: content ?? '', imageUrl: imageUrl ?? null, fileName: fileName ?? null },
  })

  if (!DANEEL_PATTERN.test(content)) {
    return NextResponse.json({ message, aiMessage: null })
  }

  const [settings, recentMessages] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.globalMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).then(msgs => msgs.reverse()),
  ])

  const provider = (settings?.aiProvider ?? 'anthropic') as 'anthropic' | 'openai' | 'openclaw'

  if (provider === 'openclaw' && !settings?.openClawBaseUrl?.trim()) {
    const errMsg = await prisma.globalMessage.create({
      data: { role: 'assistant', author: 'Daneel', content: 'OpenClaw base URL is not configured. Go to Settings.' },
    })
    return NextResponse.json({ message, aiMessage: errMsg })
  }

  if (provider !== 'openclaw' && !settings?.aiApiKey) {
    const errMsg = await prisma.globalMessage.create({
      data: { role: 'assistant', author: 'Daneel', content: 'No API key configured. Go to Settings to add one.' },
    })
    return NextResponse.json({ message, aiMessage: errMsg })
  }

  const systemPrompt = buildSystemPrompt()
  const openClawContext: OpenClawContext = {
    project: { id: 0, slug: 'global-chat', name: 'Global Chat' },
    documents: [],
    characters: [],
    worldEntries: [],
    styleGuide: '',
    sessionKey: requestingUser?.openClawSessionKey,
  }

  // Build conversation history excluding the just-saved message (we pass content directly)
  const history = recentMessages
    .filter(m => m.id !== message.id)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  history.push({ role: 'user', content })

  let aiText = ''
  try {
    const generator = provider === 'openclaw'
      ? streamOpenClaw({
          messages: history,
          systemPrompt,
          openClawBaseUrl: settings!.openClawBaseUrl,
          openClawApiKey: settings!.openClawApiKey || undefined,
          openClawAgentId: settings!.openClawAgentId || undefined,
          context: openClawContext,
        })
      : streamAIChat({
          messages: history,
          systemPrompt,
          provider,
          apiKey: settings!.aiApiKey,
          model: settings!.aiModel?.trim() || undefined,
        })

    for await (const chunk of generator) {
      aiText += chunk
    }
  } catch (err) {
    aiText = `Error: ${err instanceof Error ? err.message : String(err)}`
  }

  const aiMessage = await prisma.globalMessage.create({
    data: { role: 'assistant', author: 'Daneel', content: aiText },
  })

  return NextResponse.json({ message, aiMessage })
}
