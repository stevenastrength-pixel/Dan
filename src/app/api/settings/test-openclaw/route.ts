import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { baseUrl, apiKey } = await request.json()

  if (!baseUrl?.trim()) {
    return NextResponse.json({ ok: false, error: 'Base URL is required.' }, { status: 400 })
  }

  let url: string
  try {
    url = new URL('/dan-agent', baseUrl).toString()
  } catch {
    return NextResponse.json({ ok: false, error: 'Base URL is not a valid URL.' }, { status: 400 })
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey?.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`

  const payload = {
    mode: 'ping',
    project: { id: 0, slug: 'test', name: 'Connection Test' },
    context: { documents: [], characters: [], worldEntries: [], styleGuide: '' },
    messages: [{ role: 'user', content: 'ping' }],
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
      const body = await res.json()
      detail = body.error ?? body.message ?? ''
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

  if (typeof (data as { reply?: unknown }).reply !== 'string') {
    return NextResponse.json({
      ok: false,
      error: 'Server responded but did not return expected { reply: string } shape.',
    })
  }

  return NextResponse.json({ ok: true })
}
