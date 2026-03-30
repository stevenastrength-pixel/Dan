export const dynamic = 'force-dynamic'

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
      replicateApiKey: mask((settings as any).replicateApiKey ?? ''),
      replicateApiKeySet: ((settings as any).replicateApiKey ?? '').length > 0,
    })
  }
  return NextResponse.json({
    styleGuide: '',
    aiProvider: 'anthropic',
    aiModel: '',
    aiApiKey: '',
    aiApiKeySet: false,
    openClawBaseUrl: '',
    openClawApiKey: '',
    openClawApiKeySet: false,
    openClawAgentId: '',
    contextFiles: '[]',
    replicateApiKey: '',
    replicateApiKeySet: false,
  })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const existing = await prisma.settings.findFirst()

  // Preserve existing key only if the submitted value is masked (unchanged placeholder).
  // An empty string means the user cleared it; a new non-masked value replaces it.
  const newApiKey = isMasked(body.aiApiKey ?? '')
    ? existing?.aiApiKey ?? ''
    : (body.aiApiKey ?? '')

  const newOpenClawApiKey = isMasked(body.openClawApiKey ?? '')
    ? existing?.openClawApiKey ?? ''
    : (body.openClawApiKey ?? '')

  const newReplicateApiKey = isMasked(body.replicateApiKey ?? '')
    ? (existing as any)?.replicateApiKey ?? ''
    : (body.replicateApiKey ?? '')

  const settings = await (prisma as any).settings.upsert({
    where: { id: 1 },
    update: {
      styleGuide: body.styleGuide ?? '',
      aiProvider: body.aiProvider ?? 'anthropic',
      aiModel: body.aiModel ?? '',
      aiApiKey: newApiKey,
      openClawBaseUrl: body.openClawBaseUrl ?? '',
      openClawApiKey: newOpenClawApiKey,
      openClawAgentId: body.openClawAgentId ?? '',
      contextFiles: body.contextFiles ?? '[]',
      replicateApiKey: newReplicateApiKey,
    },
    create: {
      id: 1,
      styleGuide: body.styleGuide ?? '',
      aiProvider: body.aiProvider ?? 'anthropic',
      aiModel: body.aiModel ?? '',
      aiApiKey: newApiKey,
      openClawBaseUrl: body.openClawBaseUrl ?? '',
      openClawApiKey: newOpenClawApiKey,
      openClawAgentId: body.openClawAgentId ?? '',
      contextFiles: body.contextFiles ?? '[]',
      replicateApiKey: newReplicateApiKey,
    },
  })

  return NextResponse.json({
    ...settings,
    aiApiKey: mask(settings.aiApiKey),
    aiApiKeySet: settings.aiApiKey.length > 0,
    openClawApiKey: mask(settings.openClawApiKey),
    openClawApiKeySet: settings.openClawApiKey.length > 0,
    replicateApiKey: mask(settings.replicateApiKey ?? ''),
    replicateApiKeySet: (settings.replicateApiKey ?? '').length > 0,
  })
}
