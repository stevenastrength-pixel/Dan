export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  const settings = await prisma.settings.findFirst()
  const provider = settings?.aiProvider ?? 'anthropic'
  const aiModel = settings?.aiModel?.trim()
  const apiKey = provider === 'openclaw'
    ? (settings?.openClawApiKey ?? settings?.aiApiKey ?? '')
    : (settings?.aiApiKey ?? '')

  if (!aiModel && provider !== 'openclaw') return NextResponse.json({ error: 'No AI model configured. Go to Settings.' }, { status: 400 })
  if (!apiKey) return NextResponse.json({ error: 'No API key configured. Go to Settings.' }, { status: 400 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

  const fileName = file.name.toLowerCase()
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/.test(fileName)
  const isPdf = fileName.endsWith('.pdf')
  const isText = /\.(txt|md|markdown|rtf|csv)$/.test(fileName)

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Plain text — no AI needed, just decode and return
    if (isText) {
      const text = buffer.toString('utf-8')
      return NextResponse.json({ content: text.trim() })
    }

    // Vision/PDF transcription — requires Anthropic (document blocks not supported on OpenAI/OpenClaw)
    const anthropicKey = settings?.aiApiKey ?? ''
    if (!anthropicKey) return NextResponse.json({ error: 'Image/PDF transcription requires an Anthropic API key.' }, { status: 400 })
    const anthropic = new Anthropic({ apiKey: anthropicKey })

    const systemPrompt = `You are a transcription assistant. Your job is to extract and reproduce the text content from the provided file as faithfully as possible.

Rules:
- Reproduce the text exactly as written — do not paraphrase, summarise, or add commentary
- Preserve paragraph breaks and section headings
- For handwritten or unclear text, transcribe your best reading and mark uncertain words with [?]
- Remove page numbers, headers/footers, and watermarks
- Return ONLY the transcribed text — no preamble, no "Here is the transcription:" intro`

    let content: Anthropic.MessageParam['content']

    if (isImage) {
      const mediaType = fileName.endsWith('.png') ? 'image/png'
        : fileName.endsWith('.gif') ? 'image/gif'
        : fileName.endsWith('.webp') ? 'image/webp'
        : 'image/jpeg'
      content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
        { type: 'text', text: 'Transcribe all text from this image.' },
      ]
    } else if (isPdf) {
      content = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } } as Anthropic.DocumentBlockParam,
        { type: 'text', text: 'Transcribe all text from this PDF document.' },
      ]
    } else {
      // Fallback: treat as plain text
      const text = buffer.toString('utf-8')
      return NextResponse.json({ content: text.trim() })
    }

    const response = await anthropic.messages.create({
      model: aiModel!,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    })

    const transcribed = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ content: transcribed.trim() })

  } catch (err) {
    console.error('[Transcribe error]', err)
    return NextResponse.json({ error: `Transcription failed: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 500 })
  }
}
