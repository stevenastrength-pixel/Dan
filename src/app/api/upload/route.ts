export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { writeFile, readdir, stat, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024       // 10 MB per file
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
  // Oldest first
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
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const filename = `${randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()
  await writeFile(join(UPLOADS_DIR, filename), Buffer.from(bytes))

  // Prune oldest files if over 1 GB
  await pruneUploads()

  return NextResponse.json({ url: `/uploads/${filename}` })
}
