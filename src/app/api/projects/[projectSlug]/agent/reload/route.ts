import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// The agent chat route already reads fresh data from the DB on every request,
// so "reloading context" is a client-side concern — fetch latest docs and
// rebuild the system prompt before the next message. This endpoint validates
// that the project exists and returns the current document summary so the
// client can show a toast confirming what was loaded.

export async function POST(_: Request, { params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({
    where: { slug: params.projectSlug },
    include: { documents: { orderBy: { key: 'asc' } } },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const loadedDocs = project.documents
    .filter((d) => d.content.trim().length > 0)
    .map((d) => d.title)

  return NextResponse.json({
    ok: true,
    message:
      loadedDocs.length > 0
        ? `Context reloaded from: ${loadedDocs.join(', ')}`
        : 'Context reloaded. (Documents are empty — consider filling in the Story Bible and Project Instructions.)',
    loadedDocs,
  })
}
