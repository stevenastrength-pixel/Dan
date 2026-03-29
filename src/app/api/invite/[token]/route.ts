export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: resolve an invite token to project info (public, no auth required)
export async function GET(request: Request, { params }: { params: { token: string } }) {
  const invite = await prisma.projectInvite.findUnique({
    where: { token: params.token },
    include: {
      project: {
        select: { name: true, slug: true, description: true, type: true },
      },
    },
  })

  if (!invite) {
    return NextResponse.json({ error: 'Invalid or expired invite link.' }, { status: 404 })
  }

  return NextResponse.json({
    projectName: invite.project.name,
    projectSlug: invite.project.slug,
    projectType: invite.project.type,
    description: invite.project.description,
  })
}
