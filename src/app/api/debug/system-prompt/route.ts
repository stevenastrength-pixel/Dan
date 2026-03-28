export const dynamic = 'force-dynamic'

// TEMPORARY DEBUG ENDPOINT — remove after testing
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'

const MAX_CONTEXT_CHARS = 50_000

async function loadContextFiles(contextFilesJson: string): Promise<string> {
  let paths: string[] = []
  try { paths = JSON.parse(contextFilesJson) } catch { return '' }

  const parts: string[] = []
  let total = 0
  for (const filePath of paths) {
    if (!filePath.trim()) continue
    try {
      const content = await readFile(filePath.trim(), 'utf8')
      const chunk = content.slice(0, MAX_CONTEXT_CHARS - total)
      parts.push(`### ${filePath.trim()}\n${chunk}`)
      total += chunk.length
      if (total >= MAX_CONTEXT_CHARS) break
    } catch (e) {
      parts.push(`### ${filePath.trim()}\n[ERROR: ${e}]`)
    }
  }
  return parts.length > 0 ? `## Workspace Context\n\n${parts.join('\n\n---\n\n')}` : '[no context files loaded]'
}

export async function GET() {
  const settings = await prisma.settings.findFirst()
  const contextSection = await loadContextFiles(settings?.contextFiles ?? '[]')
  return NextResponse.json({
    contextFiles: settings?.contextFiles,
    contextSection,
  })
}
