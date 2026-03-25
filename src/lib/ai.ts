export type AIProvider = 'anthropic' | 'openai' | 'openclaw'

// ─── Anthropic / OpenAI streaming ────────────────────────────────────────────

export async function* streamAIChat(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  systemPrompt: string
  provider: 'anthropic' | 'openai'
  apiKey: string
}): AsyncGenerator<string> {
  const { messages, systemPrompt, provider, apiKey } = params

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    })
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  } else {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey })
    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content
      if (text) yield text
    }
  }
}

// ─── OpenClaw / MG420Bot provider ────────────────────────────────────────────

export type OpenClawContext = {
  project: { id: number; slug: string; name: string }
  documents: Array<{ key: string; title: string; content: string }>
  characters: Array<{ name: string; role: string; description: string; notes: string }>
  worldEntries: Array<{ name: string; type: string; description: string }>
  styleGuide: string
}

export async function* streamOpenClaw(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  systemPrompt: string
  openClawBaseUrl: string
  openClawApiKey?: string
  openClawAgentId?: string
  context: OpenClawContext
}): AsyncGenerator<string> {
  const {
    messages,
    systemPrompt,
    openClawBaseUrl,
    openClawApiKey,
    openClawAgentId,
    context,
  } = params

  const url = new URL('/novel-agent', openClawBaseUrl).toString()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (openClawApiKey) {
    headers['Authorization'] = `Bearer ${openClawApiKey}`
  }

  // Full payload sent to the OpenClaw endpoint
  const payload = {
    agentId: openClawAgentId || undefined,
    mode: 'agent',
    project: context.project,
    context: {
      documents: context.documents,
      characters: context.characters,
      worldEntries: context.worldEntries,
      styleGuide: context.styleGuide,
    },
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch (err) {
    throw new Error(
      `OpenClaw provider unreachable at ${url}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body.error ?? body.message ?? ''
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new Error(
      `OpenClaw provider error: ${res.status}${detail ? ' — ' + detail : ''}`
    )
  }

  const data = await res.json()

  if (typeof data.reply !== 'string') {
    throw new Error('OpenClaw provider returned an unexpected response shape (expected { reply: string })')
  }

  yield data.reply
}

// ─── System prompt builder (shared) ──────────────────────────────────────────

export function buildSystemPrompt(params: {
  characters: Array<{ name: string; role: string; description: string; traits: string }>
  worldEntries: Array<{ name: string; type: string; description: string }>
  styleGuide: string
  chapter?: { title: string; content: string; synopsis: string } | null
}): string {
  const { characters, worldEntries, styleGuide, chapter } = params

  const characterList =
    characters.length > 0
      ? characters
          .map((c) => {
            let traits: string[] = []
            try {
              traits = JSON.parse(c.traits)
            } catch {}
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

  const chapterContext = chapter
    ? `\n\n## Current Chapter: "${chapter.title}"${chapter.synopsis ? `\nSynopsis: ${chapter.synopsis}` : ''}${chapter.content ? `\n\nContent (HTML):\n${chapter.content}` : '\n(Chapter is empty)'}`
    : ''

  return `You are a collaborative fiction writing assistant.
${styleGuide ? `\n## Style Guide\n${styleGuide}\n` : ''}
## Characters
${characterList}

## World Building
${worldList}${chapterContext}

## Your Role
- Help write, continue, and refine story content while matching the established voice and style
- Brainstorm plot ideas, character arcs, and world building
- Review and suggest edits to existing prose
- Answer questions about the story and maintain consistency with established facts
- When writing prose, match the tone, style, and vocabulary of the style guide

Always stay true to the established characters, world, and style.`
}
