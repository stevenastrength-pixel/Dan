import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function mask(key: string) {
  return key ? '••••••••' + key.slice(-4) : ''
}

function isMasked(val: string) {
  return val.startsWith('••••')
}

export async function GET() {
  const settings = await prisma.settings.findFirst()
  if (settings) {
    return NextResponse.json({
      ...settings,
      aiApiKey: mask(settings.aiApiKey),
      aiApiKeySet: settings.aiApiKey.length > 0,
      openClawApiKey: mask(settings.openClawApiKey),
      openClawApiKeySet: settings.openClawApiKey.length > 0,
    })
  }
  return NextResponse.json({
    styleGuide: '',
    aiProvider: 'anthropic',
    aiApiKey: '',
    aiApiKeySet: false,
    openClawBaseUrl: '',
    openClawApiKey: '',
    openClawApiKeySet: false,
    openClawAgentId: '',
  })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const existing = await prisma.settings.findFirst()

  // Only update API keys if a real (non-masked) value was submitted
  const newApiKey =
    body.aiApiKey && !isMasked(body.aiApiKey)
      ? body.aiApiKey
      : existing?.aiApiKey ?? ''

  const newOpenClawApiKey =
    body.openClawApiKey && !isMasked(body.openClawApiKey)
      ? body.openClawApiKey
      : existing?.openClawApiKey ?? ''

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      styleGuide: body.styleGuide ?? '',
      aiProvider: body.aiProvider ?? 'anthropic',
      aiApiKey: newApiKey,
      openClawBaseUrl: body.openClawBaseUrl ?? '',
      openClawApiKey: newOpenClawApiKey,
      openClawAgentId: body.openClawAgentId ?? '',
    },
    create: {
      id: 1,
      styleGuide: body.styleGuide ?? '',
      aiProvider: body.aiProvider ?? 'anthropic',
      aiApiKey: newApiKey,
      openClawBaseUrl: body.openClawBaseUrl ?? '',
      openClawApiKey: newOpenClawApiKey,
      openClawAgentId: body.openClawAgentId ?? '',
    },
  })

  return NextResponse.json({
    ...settings,
    aiApiKey: mask(settings.aiApiKey),
    aiApiKeySet: settings.aiApiKey.length > 0,
    openClawApiKey: mask(settings.openClawApiKey),
    openClawApiKeySet: settings.openClawApiKey.length > 0,
  })
}
