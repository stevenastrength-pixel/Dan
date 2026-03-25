import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const characters = await prisma.character.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(characters)
}

export async function POST(request: Request) {
  const body = await request.json()
  const character = await prisma.character.create({ data: { name: body.name } })
  return NextResponse.json(character)
}
