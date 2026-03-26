export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function POST() {
  return NextResponse.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } })
}
