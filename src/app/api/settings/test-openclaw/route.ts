export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

function normalizeOpenClawResponsesUrl(baseUrl: string): string {
  const url = new URL(baseUrl)
  if (url.pathname.endsWith('/v1/responses')) return url.toString()
  url.pathname = url.pathname.replace(/\/$/, '') + '/v1/responses'
  return url.toString()
}

function extractErrorMessage(body: unknown): string {
  if (!body) return ''
  if (typeof body === 'string') return body
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.error === 'string') return record.error
    if (typeof record.error === 'object' && record.error !== null) {
      const nested = record.error as Record<string, unknown>
      if (typeof nested.message === 'string') return nested.message
    }
  }
  return ''
}

function extractOutputText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const output = (data as { output?: Array<{ type?: string; text?: string; content?: Array<{ type?: string; text?: string }> | string }> }).output
  if (!Array.isArray(output)) return ''

  const parts: string[] = []
  for (const item of output) {
    if (item.type === 'output_text' && typeof item.text === 'string') {
      parts.push(item.text)
      continue
    }
    if (item.type === 'message') {
      if (typeof item.content === 'string') {
        parts.push(item.content)
        continue
      }
      for (const part of item.content ?? []) {
        if (part.type === 'output_text' && typeof part.text === 'string') {
          parts.push(part.text)
        }
      }
    }
  }

  return parts.join('')
}

export async function POST(request: Request) {
  const { baseUrl, apiKey, agentId } = await request.json()

  if (!baseUrl?.trim()) {
    return NextResponse.json({ ok: false, error: 'Base URL is required.' }, { status: 400 })
  }

  let url: string
  try {
    url = normalizeOpenClawResponsesUrl(baseUrl)
  } catch {
    return NextResponse.json({ ok: false, error: 'Base URL is not a valid URL.' }, { status: 400 })
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey?.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`
  if (agentId?.trim()) headers['x-openclaw-agent-id'] = agentId.trim()

  const payload = {
    model: 'openclaw',
    instructions: 'You are a connectivity test. Reply with a short greeting.',
    input: 'ping',
    max_output_tokens: 64,
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: `Could not reach server: ${msg}` })
  }

  if (!res.ok) {
    let detail = ''
    try {
      detail = extractErrorMessage(await res.json())
    } catch {
      detail = await res.text().catch(() => '')
    }
    return NextResponse.json({
      ok: false,
      error: `Server returned ${res.status}${detail ? ': ' + detail : ''}`,
    })
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Server responded but returned invalid JSON.' })
  }

  if (!extractOutputText(data)) {
    return NextResponse.json({
      ok: false,
      error: 'Server responded but did not return assistant text in the OpenClaw responses format.',
    })
  }

  return NextResponse.json({ ok: true })
}
