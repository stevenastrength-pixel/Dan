export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { writeFile, readdir, stat, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_BYTES = 50 * 1024 * 1024       // 50 MB per file
const STORAGE_LIMIT = 1024 * 1024 * 1024 // 1 GB total

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads')

async function pruneUploads() {
  const names = await readdir(UPLOADS_DIR)
  const files = await Promise.all(
    names.map(async name => {
      const s = await stat(join(UPLOADS_DIR, name))
      return { name, size: s.size, mtimeMs: s.mtimeMs }
    })
  )
  files.sort((a, b) => a.mtimeMs - b.mtimeMs)
  let total = files.reduce((sum, f) => sum + f.size, 0)
  for (const f of files) {
    if (total <= STORAGE_LIMIT) break
    await unlink(join(UPLOADS_DIR, f.name))
    total -= f.size
  }
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 })

  const originalName = file.name ?? 'file'
  const ext = originalName.includes('.') ? originalName.split('.').pop()! : 'bin'
  const filename = `${randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()
  await writeFile(join(UPLOADS_DIR, filename), Buffer.from(bytes))

  await pruneUploads()

  return NextResponse.json({ url: `/uploads/${filename}`, name: originalName })
}
