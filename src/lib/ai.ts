export type AIProvider = 'anthropic' | 'openai' | 'openclaw'

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

type OpenClawResponsesMessageItem = {
  type: 'message'
  role: 'system' | 'developer' | 'user' | 'assistant'
  content: string
}

type OpenClawFunctionCallOutputItem = {
  type: 'function_call_output'
  call_id: string
  output: string
}

type OpenClawInputItem = OpenClawResponsesMessageItem | OpenClawFunctionCallOutputItem

type OpenClawResponsesRequest = {
  model: string
  instructions?: string
  input: string | OpenClawInputItem[]
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: ToolDef['input_schema']
    }
  }>
  max_output_tokens?: number
}

type OpenClawResponsesOutputItem = {
  type?: string
  role?: string
  name?: string
  arguments?: string
  call_id?: string
  content?: Array<{ type?: string; text?: string }> | string
  text?: string
}

type OpenClawResponsesResponse = {
  output?: OpenClawResponsesOutputItem[]
  error?: { message?: string; type?: string } | string
}

const OPENCLAW_LOG_LIMIT = 20000
const OPENCLAW_DEBUG_LOGS = process.env.OPENCLAW_DEBUG_LOGS === '1'

function normalizeOpenClawResponsesUrl(baseUrl: string): string {
  const url = new URL(baseUrl)
  if (url.pathname.endsWith('/v1/responses')) return url.toString()
  url.pathname = url.pathname.replace(/\/$/, '') + '/v1/responses'
  return url.toString()
}

function buildOpenClawHeaders(params: {
  openClawApiKey?: string
  openClawAgentId?: string
  sessionKey?: string
}): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (params.openClawApiKey) headers.Authorization = `Bearer ${params.openClawApiKey}`
  if (params.openClawAgentId) headers['x-openclaw-agent-id'] = params.openClawAgentId
  if (params.sessionKey) headers['x-openclaw-session-key'] = params.sessionKey
  return headers
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch (err) {
    return `[unserializable: ${err instanceof Error ? err.message : String(err)}]`
  }
}

function truncateForLog(text: string): string {
  return text.length > OPENCLAW_LOG_LIMIT
    ? text.slice(0, OPENCLAW_LOG_LIMIT) + '\n...[truncated]'
    : text
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted = { ...headers }
  if (redacted.Authorization) redacted.Authorization = 'Bearer [redacted]'
  return redacted
}

function logOpenClaw(tag: string, payload: unknown) {
  if (!OPENCLAW_DEBUG_LOGS) return
  console.log(tag, truncateForLog(safeStringify(payload)))
}

function errorOpenClaw(tag: string, payload: unknown) {
  if (!OPENCLAW_DEBUG_LOGS) return
  console.error(tag, truncateForLog(safeStringify(payload)))
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b: unknown) => {
        if (typeof b === 'object' && b !== null && 'text' in b && typeof (b as Record<string, unknown>).text === 'string') {
          return (b as Record<string, unknown>).text as string
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return String(content ?? '')
}

function toOpenClawInputMessages(messages: Array<{ role: 'user' | 'assistant'; content: unknown }>): OpenClawResponsesMessageItem[] {
  return messages.map((message) => ({
    type: 'message',
    role: message.role,
    content: extractTextContent(message.content),
  }))
}

function parseOpenClawErrorBody(body: unknown): string {
  if (!body) return ''
  if (typeof body === 'string') return body
  if (typeof body === 'object' && body !== null) {
    const asRecord = body as Record<string, unknown>
    const nested = asRecord.error
    if (typeof nested === 'string') return nested
    if (typeof nested === 'object' && nested !== null && typeof (nested as Record<string, unknown>).message === 'string') {
      return (nested as Record<string, unknown>).message as string
    }
    if (typeof asRecord.message === 'string') return asRecord.message
  }
  return ''
}

function extractOpenClawText(data: OpenClawResponsesResponse): string {
  const output = Array.isArray(data.output) ? data.output : []
  const textParts: string[] = []

  for (const item of output) {
    if (item.type === 'message') {
      if (typeof item.content === 'string') {
        textParts.push(item.content)
        continue
      }
      for (const part of item.content ?? []) {
        if (part.type === 'output_text' && typeof part.text === 'string') {
          textParts.push(part.text)
        }
      }
      continue
    }

    if (item.type === 'output_text' && typeof item.text === 'string') {
      textParts.push(item.text)
    }
  }

  return textParts.join('')
}

function extractOpenClawFunctionCalls(data: OpenClawResponsesResponse): Array<{ id: string; name: string; input: Record<string, unknown> }> {
  const output = Array.isArray(data.output) ? data.output : []
  const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

  for (const item of output) {
    if (item.type !== 'function_call' || !item.call_id || !item.name) continue
    let input: Record<string, unknown> = {}
    if (typeof item.arguments === 'string' && item.arguments.trim()) {
      try {
        input = JSON.parse(item.arguments)
      } catch {}
    }

    // Some gateways/models may wrap multiple tool calls in a single
    // "parallel" meta-call. Expand that wrapper so DAN executes each
    // requested tool instead of only handling the outer envelope.
    if (item.name === 'multi_tool_use.parallel' || item.name === 'parallel') {
      const toolUses = Array.isArray(input.tool_uses) ? input.tool_uses : []
      for (let i = 0; i < toolUses.length; i++) {
        const toolUse = toolUses[i] as Record<string, unknown>
        const rawName = typeof toolUse.recipient_name === 'string'
          ? toolUse.recipient_name
          : typeof toolUse.name === 'string'
            ? toolUse.name
            : ''
        const expandedName = rawName.includes('.')
          ? rawName.split('.').pop() || rawName
          : rawName
        const expandedInput =
          typeof toolUse.parameters === 'object' && toolUse.parameters !== null
            ? toolUse.parameters as Record<string, unknown>
            : typeof toolUse.input === 'object' && toolUse.input !== null
              ? toolUse.input as Record<string, unknown>
              : {}

        if (expandedName) {
          toolCalls.push({
            id: `${item.call_id}:${i}`,
            name: expandedName,
            input: expandedInput,
          })
        }
      }
      continue
    }

    toolCalls.push({ id: item.call_id, name: item.name, input })
  }

  return toolCalls
}

async function postOpenClawResponses(params: {
  openClawBaseUrl: string
  openClawApiKey?: string
  openClawAgentId?: string
  sessionKey?: string
  body: OpenClawResponsesRequest
}): Promise<OpenClawResponsesResponse> {
  const url = normalizeOpenClawResponsesUrl(params.openClawBaseUrl)
  const headers = buildOpenClawHeaders({
    openClawApiKey: params.openClawApiKey,
    openClawAgentId: params.openClawAgentId,
    sessionKey: params.sessionKey,
  })

  logOpenClaw('[openclaw] request', {
    url,
    headers: redactHeaders(headers),
    body: params.body,
  })

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(params.body),
    })
  } catch (err) {
    throw new Error(
      `OpenClaw provider unreachable at ${url}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    let detail = ''
    let loggedBody = ''
    try {
      const parsed = await res.json()
      detail = parseOpenClawErrorBody(parsed)
      loggedBody = safeStringify(parsed)
    } catch {
      loggedBody = await res.text().catch(() => '')
      detail = loggedBody
    }
    errorOpenClaw('[openclaw] response error', {
      url,
      status: res.status,
      body: loggedBody,
    })
    throw new Error(`OpenClaw provider error: ${res.status}${detail ? ' — ' + detail : ''}`)
  }

  const rawText = await res.text()
  logOpenClaw('[openclaw] response', {
    url,
    status: res.status,
    body: rawText,
  })

  try {
    return JSON.parse(rawText) as OpenClawResponsesResponse
  } catch (err) {
    throw new Error(`OpenClaw provider returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ─── Anthropic / OpenAI streaming (no tools) ─────────────────────────────────

export async function* streamAIChat(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  systemPrompt: string
  provider: 'anthropic' | 'openai'
  apiKey: string
  model: string
}): AsyncGenerator<string> {
  const { messages, systemPrompt, provider, apiKey, model } = params

  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })
    const stream = client.messages.stream({
      model,
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
      model,
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

  const data = await postOpenClawResponses({
    openClawBaseUrl,
    openClawApiKey,
    openClawAgentId,
    sessionKey: context.sessionKey,
    body: {
      model: 'openclaw',
      instructions: systemPrompt,
      input: toOpenClawInputMessages(messages),
      max_output_tokens: 4096,
    },
  })

  const text = extractOpenClawText(data)
  if (!text) {
    throw new Error('OpenClaw provider returned an unexpected response shape (expected assistant text output)')
  }

  yield text
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
  model: string
  tools: ToolDef[]
  onToolCall: (name: string, input: Record<string, unknown>) => Promise<string>
  forceToolUse?: boolean
}): Promise<{ text: string; toolCalls: ToolCall[] }> {
  const { messages, systemPrompt, apiKey, model, tools, onToolCall, forceToolUse } = params
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const toolCalls: ToolCall[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentMessages: any[] = [...messages]

  for (let i = 0; i < 15; i++) {
    console.log(`[tool loop] iteration ${i}, messages: ${currentMessages.length}`)
    const response = await client.messages.create({
      model,
      max_tokens: 8096,
      system: systemPrompt,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
      tool_choice: (forceToolUse && i === 0) ? { type: 'any' } : { type: 'auto' },
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

  console.warn('[tool loop] limit reached after 15 iterations — requesting wrap-up')
  try {
    const wrapUp = await client.messages.create({
      model,
      max_tokens: 400,
      system: systemPrompt + '\n\nYou have used the maximum number of tool calls for this turn. Do NOT call any more tools. Write a brief closing narration to resolve the current situation and hand control back to the players.',
      messages: currentMessages,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapText = wrapUp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text as string).join('')
    return { text: wrapText, toolCalls }
  } catch {
    return { text: '', toolCalls }
  }
}

// ─── OpenAI agentic loop (with tools) ────────────────────────────────────────

export async function callOpenAIWithTools(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
  systemPrompt: string
  apiKey: string
  model: string
  tools: ToolDef[]
  onToolCall: (name: string, input: Record<string, unknown>) => Promise<string>
  forceToolUse?: boolean
}): Promise<{ text: string; toolCalls: ToolCall[] }> {
  const { messages, systemPrompt, apiKey, model, tools, onToolCall, forceToolUse } = params
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

  for (let i = 0; i < 15; i++) {
    console.log(`[tool loop openai] iteration ${i}, messages: ${currentMessages.length}`)
    const response = await client.chat.completions.create({
      model,
      tools: openAITools,
      tool_choice: (forceToolUse && i === 0) ? 'required' : 'auto',
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

  console.warn('[tool loop openai] limit reached after 15 iterations — requesting wrap-up')
  try {
    const wrapUp = await client.chat.completions.create({
      model,
      messages: [
        ...currentMessages,
        { role: 'user', content: 'You have used the maximum number of tool calls for this turn. Do NOT call any more tools. Write a brief closing narration to resolve the current situation and hand control back to the players.' },
      ],
    })
    return { text: wrapUp.choices[0]?.message?.content ?? '', toolCalls }
  } catch {
    return { text: '', toolCalls }
  }
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
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
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

  const toolCalls: ToolCall[] = []
  const responseTools = tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }))

  let input: OpenClawInputItem[] = toOpenClawInputMessages(messages)

  for (let i = 0; i < 15; i++) {
    const data = await postOpenClawResponses({
      openClawBaseUrl,
      openClawApiKey,
      openClawAgentId,
      sessionKey: context.sessionKey,
      body: {
        model: 'openclaw',
        instructions: systemPrompt,
        input,
        tools: responseTools,
        max_output_tokens: 8096,
      },
    })

    const requestedToolCalls = extractOpenClawFunctionCalls(data)

    if (requestedToolCalls.length === 0) {
      // Final response — only use text from here, not from intermediate tool-call iterations
      const text = extractOpenClawText(data)
      if (text) return { text, toolCalls }
      return { text: '', toolCalls }
    }

    const toolResults: OpenClawFunctionCallOutputItem[] = []
    for (const tc of requestedToolCalls) {
      logOpenClaw('[openclaw] function_call', {
        id: tc.id,
        name: tc.name,
        input: tc.input,
      })
      const result = await onToolCall(tc.name, tc.input)
      toolCalls.push({ name: tc.name, input: tc.input, result })
      logOpenClaw('[openclaw] function_result', {
        id: tc.id,
        name: tc.name,
        result,
      })
      toolResults.push({
        type: 'function_call_output',
        call_id: tc.id,
        output: result,
      })
    }

    input = toolResults
  }

  console.warn('[tool loop openclaw] limit reached after 15 iterations — requesting wrap-up')
  try {
    const wrapUp = await postOpenClawResponses({
      openClawBaseUrl,
      openClawApiKey,
      openClawAgentId,
      sessionKey: context.sessionKey,
      body: {
        model: 'openclaw',
        instructions: systemPrompt + '\n\nYou have used the maximum number of tool calls for this turn. Do NOT call any more tools. Write a brief closing narration to resolve the current situation and hand control back to the players.',
        input: [
          ...input,
          { type: 'message', role: 'user', content: 'Wrap up the current situation with a brief narration — no more tool calls.' },
        ],
        max_output_tokens: 400,
      },
    })
    const wrapText = extractOpenClawText(wrapUp)
    return { text: wrapText, toolCalls }
  } catch {
    return { text: '', toolCalls }
  }
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
