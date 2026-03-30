export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const GALLERY_DIR = join(process.cwd(), 'data', 'gallery')

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

export async function GET(_request: Request, { params }: { params: { filename: string } }) {
  const { filename } = params
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME[ext] ?? 'application/octet-stream'

  try {
    const data = await readFile(join(GALLERY_DIR, filename))
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
