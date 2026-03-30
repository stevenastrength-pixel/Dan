export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  streamAIChat, streamOpenClaw,
  callAnthropicWithTools, callOpenAIWithTools, callOpenClawWithTools,
  type OpenClawContext, type ToolDef,
} from '@/lib/ai'
import { getUserFromRequest } from '@/lib/auth'
import { readFile } from 'fs/promises'
import { createProject } from '@/lib/projectCreation'

const DANEEL_PATTERN = /@daneel\b/i

const MAX_CONTEXT_CHARS = 50_000

async function loadContextFiles(contextFilesJson: string): Promise<Array<{ title: string; content: string }>> {
  let paths: string[] = []
  try { paths = JSON.parse(contextFilesJson) } catch { return [] }
  const docs: Array<{ title: string; content: string }> = []
  for (const filePath of paths) {
    if (!filePath.trim()) continue
    try {
      const content = await readFile(filePath.trim(), 'utf8')
      docs.push({ title: filePath.trim().split('/').pop() ?? 'Context', content: content.slice(0, MAX_CONTEXT_CHARS) })
    } catch { /* skip unreadable */ }
  }
  return docs
}

function buildSystemPrompt(contextDocs: Array<{ title: string; content: string }>): string {
  const filteredDocs = contextDocs.filter(d => d.content.trim())
  const contextSection = filteredDocs.length > 0
    ? `\n## Context\n${filteredDocs.map(d => `### ${d.title}\n${d.content}`).join('\n\n---\n\n')}\n`
    : ''

  return `You are Daneel — the resident AI assistant for this collaborative writing team.

You are in the Global Chat, a shared space for the whole team.

Your personality: sharp, witty, slightly dry. Helpful but never sycophantic.
${contextSection}
## Your Role
- General team conversation and coordination
- Brainstorming and creative discussion${filteredDocs.length > 0 ? ', drawing on the context above' : ''}
- Answer general questions about writing craft, process, or tools
- Create new projects when asked — use the create_project tool to spin up a new novel or campaign

## Creating Projects
When someone asks you to create a new novel or campaign, call create_project with the name, type, and any details they provide.
For campaigns, extract premise and setting from the conversation if available.
After creating, confirm with the project name and a direct link: /projects/[slug]/agent

${filteredDocs.length === 0 ? 'Direct users to open the relevant project if they need to discuss project-specific content.\n' : ''}Stay sharp.`
}

// ─── Tools ─────────────────────────────────────────────────────────────────────

const GLOBAL_TOOLS: ToolDef[] = [
  {
    name: 'create_project',
    description: 'Create a new novel or campaign project. Call this when the user asks to start, create, or set up a new project.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The project name.' },
        type: { type: 'string', enum: ['novel', 'campaign'], description: 'Project type.' },
        description: { type: 'string', description: 'A short description of the project (optional).' },
        premise: { type: 'string', description: 'Campaign premise / hook (campaign only, optional).' },
        setting: { type: 'string', description: 'Campaign world or setting name (campaign only, optional).' },
        minLevel: { type: 'number', description: 'Starting character level (campaign only, default 1).' },
        maxLevel: { type: 'number', description: 'Ending character level (campaign only, default 10).' },
        partySize: { type: 'number', description: 'Expected party size (campaign only, default 4).' },
        levelingMode: { type: 'string', enum: ['xp', 'milestone'], description: 'Leveling mode (campaign only, default milestone).' },
      },
      required: ['name', 'type'],
    },
  },
]

// ─── Tool handler ─────────────────────────────────────────────────────────────

async function handleToolCall(
  name: string,
  input: Record<string, unknown>,
  creatorUsername?: string,
): Promise<string> {
  if (name === 'create_project') {
    try {
      const project = await createProject({
        name: String(input.name ?? ''),
        type: input.type === 'campaign' ? 'campaign' : 'novel',
        description: input.description ? String(input.description) : undefined,
        premise: input.premise ? String(input.premise) : undefined,
        setting: input.setting ? String(input.setting) : undefined,
        minLevel: input.minLevel ? Number(input.minLevel) : undefined,
        maxLevel: input.maxLevel ? Number(input.maxLevel) : undefined,
        partySize: input.partySize ? Number(input.partySize) : undefined,
        levelingMode: input.levelingMode ? String(input.levelingMode) : undefined,
        creatorUsername,
      })
      return JSON.stringify({ ok: true, id: project.id, slug: project.slug, name: project.name, type: project.type })
    } catch (e) {
      return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` })
}

// ─── GET: fetch messages ───────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const afterId = searchParams.get('afterId')
  const beforeId = searchParams.get('beforeId')
  const pinned = searchParams.get('pinned')

  if (pinned === 'true') {
    const messages = await prisma.globalMessage.findMany({
      where: { isPinned: true },
      orderBy: { id: 'desc' },
    })
    return NextResponse.json(messages)
  }

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

  const settings = await prisma.settings.findFirst()
  const recentMessages = await prisma.globalMessage.findMany({
    where: settings?.globalContextResetAt ? { createdAt: { gte: settings.globalContextResetAt } } : {},
    orderBy: { createdAt: 'desc' },
    take: 20,
  }).then(msgs => msgs.reverse())

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
  const aiModel = settings?.aiModel?.trim()
  if (!aiModel && provider !== 'openclaw') {
    const errMsg = await prisma.globalMessage.create({
      data: { role: 'assistant', author: 'Daneel', content: 'No AI model configured. Go to Settings and set a model.' },
    })
    return NextResponse.json({ message, aiMessage: errMsg })
  }

  const contextDocs = await loadContextFiles(settings?.contextFiles ?? '[]')
  const systemPrompt = buildSystemPrompt(contextDocs)
  const openClawContext: OpenClawContext = {
    project: { id: 0, slug: 'global-chat', name: 'Global Chat' },
    documents: [],
    characters: [],
    worldEntries: [],
    styleGuide: '',
    sessionKey: `${requestingUser?.openClawSessionKey ?? 'dan'}-global${settings?.globalSessionNonce ? `-${settings.globalSessionNonce}` : ''}`,
  }

  // Build conversation history excluding the just-saved message
  const history = recentMessages
    .filter(m => m.id !== message.id)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  history.push({ role: 'user', content })

  let aiText = ''
  try {
    if (provider === 'openclaw') {
      const result = await callOpenClawWithTools({
        messages: history,
        systemPrompt,
        openClawBaseUrl: settings!.openClawBaseUrl,
        openClawApiKey: settings!.openClawApiKey || undefined,
        openClawAgentId: settings!.openClawAgentId || undefined,
        context: openClawContext,
        tools: GLOBAL_TOOLS,
        onToolCall: (n, i) => handleToolCall(n, i, requestingUser?.username),
      })
      aiText = result.text
    } else if (provider === 'anthropic') {
      const result = await callAnthropicWithTools({
        messages: history,
        systemPrompt,
        apiKey: settings!.aiApiKey,
        model: aiModel!,
        tools: GLOBAL_TOOLS,
        onToolCall: (n, i) => handleToolCall(n, i, requestingUser?.username),
      })
      aiText = result.text
    } else {
      const result = await callOpenAIWithTools({
        messages: history,
        systemPrompt,
        apiKey: settings!.aiApiKey,
        model: aiModel!,
        tools: GLOBAL_TOOLS,
        onToolCall: (n, i) => handleToolCall(n, i, requestingUser?.username),
      })
      aiText = result.text
    }
  } catch (err) {
    aiText = `Error: ${err instanceof Error ? err.message : String(err)}`
  }

  const aiMessage = await prisma.globalMessage.create({
    data: { role: 'assistant', author: 'Daneel', content: aiText },
  })

  return NextResponse.json({ message, aiMessage })
}
