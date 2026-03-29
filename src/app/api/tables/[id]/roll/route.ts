export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DIE_SIZES: Record<string, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const table = await prisma.randomTable.findUnique({ where: { id: parseInt(params.id) } })
  if (!table) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let entries: Array<{ roll: number; text: string }> = []
  try { entries = JSON.parse(table.entries) } catch {
    return NextResponse.json({ error: 'Table entries are malformed' }, { status: 500 })
  }
  if (entries.length === 0) return NextResponse.json({ error: 'Table has no entries' }, { status: 400 })

  const max = DIE_SIZES[table.dieSize] ?? 20
  const roll = Math.floor(Math.random() * max) + 1
  const sorted = [...entries].sort((a, b) => a.roll - b.roll)
  const result = sorted.find(e => e.roll >= roll) ?? sorted[sorted.length - 1]

  return NextResponse.json({ roll, text: result.text, dieName: table.dieSize })
}
