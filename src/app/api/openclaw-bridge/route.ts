export const dynamic = 'force-dynamic'

/**
 * Legacy OpenClaw bridge.
 *
 * This route preserves DAN's older custom adapter contract:
 * it accepts DAN's legacy OpenClaw-shaped payload and then calls the configured LLM
 * directly, returning a synchronous { reply: string } response.
 *
 * DAN now integrates with the official OpenClaw Gateway /v1/responses API directly.
 * Keep this route only for backwards compatibility with older setups.
 *
 * If you point openClawBaseUrl here, you are NOT talking to a real OpenClaw agent.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-6'
const DEFAULT_OPENAI_MODEL = 'gpt-5.4'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const settings = await prisma.settings.findFirst()
    if (!settings?.aiApiKey) {
      return NextResponse.json(
        { error: 'No API key configured in DAN settings. Go to Settings to add one.' },
        { status: 400 }
      )
    }

    // DAN sends messages as [{ role: 'system'|'user'|'assistant', content: string }]
    const messages: Array<{ role: string; content: string }> = body.messages ?? []
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')
    const systemPrompt = systemMsg?.content ?? ''

    const provider = settings.aiProvider as 'anthropic' | 'openai' | 'openclaw'
    const apiKey = settings.aiApiKey
    const model = settings.aiModel?.trim() || undefined

    // openclaw provider pointing at itself would be a loop — fall back to anthropic
    const effectiveProvider = provider === 'openclaw' ? 'anthropic' : provider

    let reply = ''

    if (effectiveProvider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic({ apiKey })
      const response = await client.messages.create({
        model: model || DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: chatMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      })
      reply = response.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === 'text')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text as string)
        .join('')
    } else {
      const OpenAI = (await import('openai')).default
      const client = new OpenAI({ apiKey })
      const response = await client.chat.completions.create({
        model: model || DEFAULT_OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
      })
      reply = response.choices[0]?.message?.content ?? ''
    }

    return NextResponse.json({ reply })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
