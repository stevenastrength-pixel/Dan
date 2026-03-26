import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { randomBytes } from 'crypto'

function generateCode() {
  // e.g. "a3f8-c291-7b4e"
  return randomBytes(6).toString('hex').match(/.{4}/g)!.join('-')
}

async function getOrCreateCode() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } })
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: 1, inviteCode: generateCode() } })
  } else if (!settings.inviteCode) {
    settings = await prisma.settings.update({ where: { id: 1 }, data: { inviteCode: generateCode() } })
  }
  return settings.inviteCode
}

export async function GET(request: Request) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const code = await getOrCreateCode()
  return NextResponse.json({ inviteCode: code })
}

export async function POST(request: Request) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const newCode = generateCode()
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { inviteCode: newCode },
    create: { id: 1, inviteCode: newCode },
  })
  return NextResponse.json({ inviteCode: newCode })
}
