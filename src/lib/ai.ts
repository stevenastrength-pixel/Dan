export type AIProvider = 'anthropic' | 'openai' | 'openclaw'

// ─── Default models ───────────────────────────────────────────────────────────

const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-6'
const DEFAULT_ANTHROPIC_TOOL_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_OPENAI_MODEL = 'gpt-5.4'
const DEFAULT_OPENAI_TOOL_MODEL = 'gpt-5.4-nano'

// ─── Shared types ─────────────────────────────────────────────────────────────

export type ToolDef = {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export type ToolCall = {
  name: string
  input: Record<string, unknown>
  result: string
}

// ─── Anthropic / OpenAI streaming (no tools) ─────────────────────────────────

export async function* streamAIChat(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  systemPrompt: string
  provider: 'anthropic' | 'openai'
  apiKey: string
  model?: string
}): AsyncGenerator<string> {
  const { messages, systemPrompt, provider, apiKey, model } = params

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })
    const stream = client.messages.stream({
      model: model || DEFAULT_ANTHROPIC_MODEL,
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
      model: model || DEFAULT_OPENAI_MODEL,
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

// ─── OpenClaw provider (streaming chat, no tools) ────────────────────────────

export type OpenClawContext = {
  project: { id: number; slug: string; name: string }
  documents: Array<{ key: string; title: string; content: string }>
  characters: Array<{ name: string; role: string; description: string; notes: string }>
  worldEntries: Array<{ name: string; type: string; description: string }>
  styleGuide: string
  sessionKey?: string
}

export async function* streamOpenClaw(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  systemPrompt: string
  openClawBaseUrl: string
  openClawApiKey?: string
  openClawAgentId?: string
  context: OpenClawContext
}): AsyncGenerator<string> {
  const { messages, systemPrompt, openClawBaseUrl, openClawApiKey, openClawAgentId, context } = params

  const url = new URL('/dan-agent', openClawBaseUrl).toString()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (openClawApiKey) headers['Authorization'] = `Bearer ${openClawApiKey}`

  const payload = {
    agentId: openClawAgentId || undefined,
    sessionKey: context.sessionKey || undefined,
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
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
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
    throw new Error(`OpenClaw provider error: ${res.status}${detail ? ' — ' + detail : ''}`)
  }

  const data = await res.json()
  if (typeof data.reply !== 'string') {
    throw new Error('OpenClaw provider returned an unexpected response shape (expected { reply: string })')
  }

  yield data.reply
}

// ─── Anthropic agentic loop (with tools) ─────────────────────────────────────

/**
 * Call Claude with tools. Runs the full agentic loop:
 * send → check for tool_use → execute → send result → get final text.
 */
export async function callAnthropicWithTools(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
  systemPrompt: string
  apiKey: string
  model?: string
  tools: ToolDef[]
  onToolCall: (name: string, input: Record<string, unknown>) => Promise<string>
}): Promise<{ text: string; toolCalls: ToolCall[] }> {
  const { messages, systemPrompt, apiKey, model, tools, onToolCall } = params
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const toolCalls: ToolCall[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentMessages: any[] = [...messages]

  for (let i = 0; i < 10; i++) {
    console.log(`[tool loop] iteration ${i}, messages: ${currentMessages.length}`)
    const response = await client.messages.create({
      model: model || DEFAULT_ANTHROPIC_TOOL_MODEL,
      max_tokens: 8096,
      system: systemPrompt,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
      messages: currentMessages,
    })

    if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
      const text = response.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === 'text')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text as string)
        .join('')
      return { text, toolCalls }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use') as any[]

    currentMessages = [...currentMessages, { role: 'assistant', content: response.content }]

    const toolResults = []
    for (const block of toolUseBlocks) {
      const result = await onToolCall(block.name, block.input)
      toolCalls.push({ name: block.name, input: block.input, result })
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
    }

    currentMessages = [...currentMessages, { role: 'user', content: toolResults }]
  }

  return { text: '(Tool loop limit reached)', toolCalls }
}

// ─── OpenAI agentic loop (with tools) ────────────────────────────────────────

export async function callOpenAIWithTools(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
  systemPrompt: string
  apiKey: string
  model?: string
  tools: ToolDef[]
  onToolCall: (name: string, input: Record<string, unknown>) => Promise<string>
}): Promise<{ text: string; toolCalls: ToolCall[] }> {
  const { messages, systemPrompt, apiKey, model, tools, onToolCall } = params
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })

  const toolCalls: ToolCall[] = []

  const openAITools = tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentMessages: any[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  for (let i = 0; i < 10; i++) {
    console.log(`[tool loop openai] iteration ${i}, messages: ${currentMessages.length}`)
    const response = await client.chat.completions.create({
      model: model || DEFAULT_OPENAI_TOOL_MODEL,
      tools: openAITools,
      messages: currentMessages,
    })

    const choice = response.choices[0]

    if (choice.finish_reason !== 'tool_calls') {
      return { text: choice.message.content ?? '', toolCalls }
    }

    currentMessages = [...currentMessages, choice.message]

    const toolResultMessages = []
    for (const tc of choice.message.tool_calls ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tcAny = tc as any
      let input: Record<string, unknown> = {}
      try { input = JSON.parse(tcAny.function.arguments) } catch {}
      const result = await onToolCall(tcAny.function.name, input)
      toolCalls.push({ name: tcAny.function.name, input, result })
      toolResultMessages.push({
        role: 'tool' as const,
        tool_call_id: tc.id,
        content: result,
      })
    }

    currentMessages = [...currentMessages, ...toolResultMessages]
  }

  return { text: '(Tool loop limit reached)', toolCalls }
}

// ─── OpenClaw agentic loop (with tools) ──────────────────────────────────────

/**
 * Multi-turn tool protocol for OpenClaw.
 *
 * DAN sends tool definitions and messages.
 * The OpenClaw server responds with either:
 *   { reply: string }                          — final text, done
 *   { toolCalls: [{id, name, input}] }          — wants tool execution
 *
 * When toolCalls are returned, DAN executes them and sends
 * another request with { toolResults: [{id, result}] } for the server
 * to continue. Repeats until a final { reply } is received.
 */
export async function callOpenClawWithTools(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  systemPrompt: string
  openClawBaseUrl: string
  openClawApiKey?: string
  openClawAgentId?: string
  context: OpenClawContext
  tools: ToolDef[]
  onToolCall: (name: string, input: Record<string, unknown>) => Promise<string>
}): Promise<{ text: string; toolCalls: ToolCall[] }> {
  const {
    messages, systemPrompt, openClawBaseUrl, openClawApiKey,
    openClawAgentId, context, tools, onToolCall,
  } = params

  const url = new URL('/dan-agent', openClawBaseUrl).toString()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (openClawApiKey) headers['Authorization'] = `Bearer ${openClawApiKey}`

  const toolCalls: ToolCall[] = []

  const post = async (extra: Record<string, unknown>) => {
    const payload = {
      agentId: openClawAgentId || undefined,
      sessionKey: context.sessionKey || undefined,
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
      tools,
      ...extra,
    }

    let res: Response
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
    } catch (err) {
      throw new Error(
        `OpenClaw unreachable at ${url}: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    if (!res.ok) {
      let detail = ''
      try { const b = await res.json(); detail = b.error ?? b.message ?? '' } catch {
        detail = await res.text().catch(() => '')
      }
      throw new Error(`OpenClaw error: ${res.status}${detail ? ' — ' + detail : ''}`)
    }

    return await res.json()
  }

  // Initial request
  let data = await post({})

  for (let i = 0; i < 10; i++) {
    // Final reply
    if (typeof data.reply === 'string') {
      return { text: data.reply, toolCalls }
    }

    // Tool calls requested
    if (!Array.isArray(data.toolCalls) || data.toolCalls.length === 0) {
      throw new Error('OpenClaw returned neither reply nor toolCalls.')
    }

    const toolResults: Array<{ id: string; result: string }> = []
    for (const tc of data.toolCalls as Array<{ id: string; name: string; input: Record<string, unknown> }>) {
      const result = await onToolCall(tc.name, tc.input)
      toolCalls.push({ name: tc.name, input: tc.input, result })
      toolResults.push({ id: tc.id, result })
    }

    data = await post({ toolResults })
  }

  return { text: '(Tool loop limit reached)', toolCalls }
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
