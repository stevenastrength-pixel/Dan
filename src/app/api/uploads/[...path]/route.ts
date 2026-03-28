export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, basename } from 'path'

const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads')

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf',
  txt: 'text/plain',
}

export async function GET(_: Request, { params }: { params: { path: string[] } }) {
  const filename = basename(params.path.join('/'))
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME[ext] ?? 'application/octet-stream'

  try {
    const bytes = await readFile(join(UPLOADS_DIR, filename))
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
