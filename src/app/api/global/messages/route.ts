export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { streamAIChat } from '@/lib/ai'

const DANEEL_PATTERN = /@daneel\b/i

function buildSystemPrompt(params: {
  characters: Array<{ name: string; role: string; description: string; traits: string }>
  worldEntries: Array<{ name: string; type: string; description: string }>
  styleGuide: string
}): string {
  const { characters, worldEntries, styleGuide } = params

  const characterList =
    characters.length > 0
      ? characters.map(c => {
          let traits: string[] = []
          try { traits = JSON.parse(c.traits) } catch {}
          return `- **${c.name}** (${c.role})${c.description ? `: ${c.description}` : ''}${traits.length > 0 ? ` | Traits: ${traits.join(', ')}` : ''}`
        }).join('\n')
      : 'No characters defined yet.'

  const grouped = worldEntries.reduce<Record<string, string[]>>((acc, e) => {
    if (!acc[e.type]) acc[e.type] = []
    acc[e.type].push(`- **${e.name}**${e.description ? `: ${e.description}` : ''}`)
    return acc
  }, {})

  const worldList =
    Object.keys(grouped).length > 0
      ? Object.entries(grouped).map(([type, items]) => `### ${type}s\n${items.join('\n')}`).join('\n\n')
      : 'No world entries defined yet.'

  return `You are Daneel — the resident AI assistant for this collaborative writing team.

You are in the Global Chat, a shared space for all users across all projects. You have broad knowledge of the characters and world but are not focused on any single project here.

Your personality: sharp, witty, slightly dry, deeply familiar with the story and the team. Helpful but never sycophantic — you push back when an idea doesn't fit the established world.
${styleGuide ? `\n## Style Guide\n${styleGuide}\n` : ''}
## Characters (across all projects)
${characterList}

## World Building
${worldList}

## Your Role
- General collaboration and brainstorming across all projects
- Answer questions about any character, world, or story element
- Help the team think through ideas, conflicts, or plot questions
- Coordinate between team members when needed

Stay sharp.`
}

// ─── GET: fetch messages ───────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const afterId = searchParams.get('afterId')

  const messages = await prisma.globalMessage.findMany({
    where: afterId ? { id: { gt: parseInt(afterId) } } : {},
    orderBy: { createdAt: 'asc' },
    take: afterId ? 100 : 200,
  })

  return NextResponse.json(messages)
}

// ─── POST: post a message; call AI only if @Daneel is mentioned ───────────────

export async function POST(request: Request) {
  const { author, content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const message = await prisma.globalMessage.create({
    data: { role: 'user', author, content },
  })

  if (!DANEEL_PATTERN.test(content)) {
    return NextResponse.json({ message, aiMessage: null })
  }

  const [settings, characters, worldEntries, recentMessages] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.character.findMany({ orderBy: { name: 'asc' } }),
    prisma.worldEntry.findMany({ orderBy: { name: 'asc' } }),
    prisma.globalMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).then(msgs => msgs.reverse()),
  ])

  if (!settings?.aiApiKey) {
    const errMsg = await prisma.globalMessage.create({
      data: { role: 'assistant', author: 'Daneel', content: 'No API key configured. Go to Settings to add one.' },
    })
    return NextResponse.json({ message, aiMessage: errMsg })
  }

  const systemPrompt = buildSystemPrompt({
    characters,
    worldEntries,
    styleGuide: settings.styleGuide ?? '',
  })

  // Build conversation history excluding the just-saved message (we pass content directly)
  const history = recentMessages
    .filter(m => m.id !== message.id)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  history.push({ role: 'user', content })

  let aiText = ''
  try {
    const provider = (settings.aiProvider ?? 'anthropic') as 'anthropic' | 'openai'
    for await (const chunk of streamAIChat({
      messages: history,
      systemPrompt,
      provider,
      apiKey: settings.aiApiKey,
      model: settings.aiModel?.trim() || undefined,
    })) {
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
