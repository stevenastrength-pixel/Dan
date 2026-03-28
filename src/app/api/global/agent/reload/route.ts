export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function POST() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { globalSessionNonce: randomUUID(), globalContextResetAt: new Date() },
    create: { id: 1, globalSessionNonce: randomUUID(), globalContextResetAt: new Date() },
  })

  return NextResponse.json({ ok: true, message: 'Session reset. Daneel will start fresh.' })
}
