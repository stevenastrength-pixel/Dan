export const dynamic = 'force-dynamic'

// TEMPORARY DEBUG ENDPOINT — remove after testing
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFile, access } from 'fs/promises'

const MAX_CONTEXT_CHARS = 50_000

export async function GET() {
  const settings = await prisma.settings.findFirst()
  const contextFilesJson = settings?.contextFiles ?? '[]'

  let paths: string[] = []
  try { paths = JSON.parse(contextFilesJson) } catch {}

  const results = await Promise.all(paths.filter(p => p.trim()).map(async (filePath) => {
    const p = filePath.trim()
    try {
      await access(p)
      const content = await readFile(p, 'utf8')
      return { path: p, accessible: true, readOk: true, contentLength: content.length, preview: content.slice(0, 200) }
    } catch (e) {
      return { path: p, accessible: false, readOk: false, error: String(e) }
    }
  }))

  return NextResponse.json({ contextFilesJson, paths, results })
}
