import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const entries = await prisma.worldEntry.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] })
  return NextResponse.json(entries)
}

export async function POST(request: Request) {
  const body = await request.json()
  const entry = await prisma.worldEntry.create({
    data: { name: body.name, type: body.type ?? 'Location' },
  })
  return NextResponse.json(entry)
}
