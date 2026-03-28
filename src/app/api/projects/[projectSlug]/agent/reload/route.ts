export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function POST(_: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({
    where: { slug: params.projectSlug },
    include: { documents: { orderBy: { key: 'asc' } } },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Regenerate the session nonce so OpenClaw starts a fresh conversation session
  await prisma.project.update({
    where: { slug: params.projectSlug },
    data: { sessionNonce: randomUUID() },
  })

  const loadedDocs = project.documents
    .filter((d) => d.content.trim().length > 0)
    .map((d) => d.title)

  return NextResponse.json({
    ok: true,
    message:
      loadedDocs.length > 0
        ? `Session reset. Context reloaded from: ${loadedDocs.join(', ')}`
        : 'Session reset. (Documents are empty — consider filling in the Story Bible and Project Instructions.)',
    loadedDocs,
  })
}
