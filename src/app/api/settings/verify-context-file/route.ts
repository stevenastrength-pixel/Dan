export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { access } from 'fs/promises'

export async function POST(request: Request) {
  const { path } = await request.json()
  if (!path?.trim()) return NextResponse.json({ ok: false, error: 'No path provided' })

  try {
    await access(path.trim())
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'File not found or not readable' })
  }
}
