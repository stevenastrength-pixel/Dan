export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const body = await request.json()
  const comment = await prisma.comment.create({
    data: {
      chapterId: body.chapterId,
      text: body.text,
      author: body.author ?? 'Unknown',
    },
  })
  return NextResponse.json(comment)
}
