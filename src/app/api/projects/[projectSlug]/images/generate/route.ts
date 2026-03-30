export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

const GALLERY_DIR = join(process.cwd(), 'data', 'gallery')

// ── Expand the user's brief description into a rich image prompt using the project AI ─────
async function expandPrompt(
  userPrompt: string,
  projectName: string,
  projectDescription: string,
  contextLines: string[],
  settings: { aiProvider: string; aiApiKey: string; aiModel: string } | null
): Promise<string> {
  const provider = settings?.aiProvider ?? 'anthropic'
  const apiKey = settings?.aiApiKey ?? ''
  const aiModel = settings?.aiModel?.trim()
  if (!aiModel) return userPrompt  // no model configured — skip expansion, use raw prompt
  if (!apiKey && provider !== 'openclaw') return userPrompt

  const systemPrompt = `You are an expert image prompt engineer for AI art generators (FLUX/Stable Diffusion). Given a brief description and project context, write a single detailed image generation prompt that will produce high-quality fantasy RPG artwork.

Rules:
- Output ONLY the prompt text — no explanation, no preamble, no quotes, no markdown
- Keep it under 180 words
- Include: subject details, pose/action, setting/environment, lighting, art style (painterly, detailed, fantasy illustration), mood, color palette
- Draw on the project context to add authentic visual details specific to this world
- Do NOT invent things that contradict the project context

Project: ${projectName}${projectDescription ? `\n${projectDescription}` : ''}
${contextLines.length > 0 ? `\nWorld context:\n${contextLines.join('\n')}` : ''}`

  try {
    if (provider === 'openai') {
      const OpenAI = (await import('openai')).default
      const client = new OpenAI({ apiKey })
      const resp = await client.chat.completions.create({
        model: aiModel,
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })
      return resp.choices[0]?.message?.content?.trim() || userPrompt
    } else {
      // anthropic (default) or openclaw — both use Anthropic SDK
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic({ apiKey })
      const resp = await client.messages.create({
        model: aiModel,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
      const block = resp.content[0]
      return block?.type === 'text' ? block.text.trim() : userPrompt
    }
  } catch (err) {
    console.warn('[generate] prompt expansion failed, using raw prompt:', err)
    return userPrompt
  }
}

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
  const title: string = (body.title ?? '').trim() || userPrompt.slice(0, 60) || 'Generated image'

  if (!userPrompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

  // ── 1. Gather project context for AI prompt expansion ──────────────────────
  const [characters, worldEntries, documents] = await Promise.all([
    prisma.character.findMany({ where: { projectId: project.id }, orderBy: { name: 'asc' }, take: 15 }),
    prisma.worldEntry.findMany({ where: { projectId: project.id }, orderBy: { name: 'asc' }, take: 15 }),
    prisma.projectDocument.findMany({ where: { projectId: project.id } }),
  ])

  const contextLines: string[] = []
  if (characters.length > 0) {
    contextLines.push('Characters: ' + characters
      .filter(c => c.description.trim())
      .map(c => `${c.name} — ${c.description.slice(0, 120)}`)
      .join('; '))
  }
  if (worldEntries.length > 0) {
    contextLines.push('World: ' + worldEntries
      .filter(w => w.description.trim())
      .map(w => `${w.name} (${w.type}): ${w.description.slice(0, 100)}`)
      .join('; '))
  }
  const storyBible = documents.find(d => d.key === 'story_bible')
  if (storyBible?.content?.trim()) {
    contextLines.push('Story Bible excerpt: ' + storyBible.content.slice(0, 600))
  }

  // ── 2. Expand prompt via project AI ───────────────────────────────────────
  const expandedPrompt = await expandPrompt(
    userPrompt,
    project.name,
    (project as any).description ?? '',
    contextLines,
    settings ? {
      aiProvider: settings.aiProvider,
      aiApiKey: settings.aiApiKey,
      aiModel: settings.aiModel,
    } : null
  )

  const fullPrompt = `fantasy tabletop RPG illustration, detailed painterly art, ${expandedPrompt}`

  console.log('[generate] expanded prompt:', fullPrompt)

  // ── 3. Create prediction on Replicate ──────────────────────────────────────
  const createRes = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${replicateApiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=30',
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

  // ── 4. Poll until succeeded ────────────────────────────────────────────────
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

  // ── 5. Download the generated image ────────────────────────────────────────
  const outputUrl: string = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
  if (!outputUrl) return NextResponse.json({ error: 'No output URL from Replicate.' }, { status: 502 })

  const imgRes = await fetch(outputUrl)
  if (!imgRes.ok) return NextResponse.json({ error: 'Failed to download generated image.' }, { status: 502 })

  const imgBytes = Buffer.from(await imgRes.arrayBuffer())
  const filename = `${randomUUID()}.webp`

  await mkdir(GALLERY_DIR, { recursive: true })
  await writeFile(join(GALLERY_DIR, filename), imgBytes)

  // ── 6. Save to DB ───────────────────────────────────────────────────────────
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
