export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

const GALLERY_DIR = join(process.cwd(), 'data', 'gallery')

// Style prefix prepended to every prompt for consistent fantasy RPG art
const STYLE_PREFIX = 'fantasy tabletop RPG illustration, dramatic lighting, detailed painterly art, dark atmospheric,'

export async function POST(
  request: Request,
  { params }: { params: { projectSlug: string } }
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const settings = await prisma.settings.findFirst()
  const replicateApiKey = (settings as any)?.replicateApiKey ?? ''
  if (!replicateApiKey) {
    return NextResponse.json({ error: 'No Replicate API key configured. Go to Settings → Image Generation.' }, { status: 400 })
  }

  const body = await request.json()
  const userPrompt: string = (body.prompt ?? '').trim()
  const imageType: string = body.imageType ?? 'concept_art'
  const title: string = (body.title ?? '').trim() || 'Generated image'

  if (!userPrompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

  const fullPrompt = `${STYLE_PREFIX} ${userPrompt}`

  // ── 1. Create prediction on Replicate ──────────────────────────────────────
  const createRes = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=30',  // wait up to 30s for completion before falling back to polling
      },
      body: JSON.stringify({
        input: {
          prompt: fullPrompt,
          width: 1024,
          height: 576,
          num_inference_steps: 4,
          output_format: 'webp',
          output_quality: 90,
        },
      }),
    }
  )

  if (!createRes.ok) {
    const err = await createRes.text()
    console.error('[Replicate] create error:', err)
    return NextResponse.json({ error: `Replicate error: ${createRes.status}` }, { status: 502 })
  }

  let prediction = await createRes.json()

  // ── 2. Poll until succeeded (fallback if Prefer:wait didn't resolve it) ────
  const pollUrl = prediction.urls?.get
  let attempts = 0
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < 20) {
    await new Promise(r => setTimeout(r, 1500))
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${replicateApiKey}` },
    })
    prediction = await pollRes.json()
    attempts++
  }

  if (prediction.status !== 'succeeded') {
    return NextResponse.json({ error: 'Image generation failed or timed out.' }, { status: 502 })
  }

  // ── 3. Download the generated image ────────────────────────────────────────
  const outputUrl: string = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
  if (!outputUrl) return NextResponse.json({ error: 'No output URL from Replicate.' }, { status: 502 })

  const imgRes = await fetch(outputUrl)
  if (!imgRes.ok) return NextResponse.json({ error: 'Failed to download generated image.' }, { status: 502 })

  const imgBytes = Buffer.from(await imgRes.arrayBuffer())
  const filename = `${randomUUID()}.webp`

  await mkdir(GALLERY_DIR, { recursive: true })
  await writeFile(join(GALLERY_DIR, filename), imgBytes)

  // ── 4. Save to DB ───────────────────────────────────────────────────────────
  const image = await (prisma as any).projectImage.create({
    data: {
      projectId: project.id,
      imageType,
      title,
      filename,
      url: `/api/gallery/${filename}`,
    },
  })

  return NextResponse.json(image)
}
