export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export async function POST(request: Request, { params }: { params: { projectSlug: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const settings = await prisma.settings.findFirst()
  const provider = settings?.aiProvider ?? 'anthropic'
  const aiModel = settings?.aiModel?.trim()
  if (!aiModel && provider !== 'openclaw') return NextResponse.json({ error: 'No AI model configured. Go to Settings and set a model.' }, { status: 400 })
  if (provider !== 'openclaw' && !settings?.aiApiKey) {
    return NextResponse.json({ error: 'No API key configured. Go to Settings.' }, { status: 400 })
  }

  const body = await request.json()
  const prompt: string = body.prompt?.trim() ?? ''

  // Gather campaign context
  const documents = await prisma.projectDocument.findMany({ where: { projectId: project.id } })
  const docSummary = documents.filter(d => d.content.trim()).slice(0, 3)
    .map(d => `## ${d.title}\n${d.content.slice(0, 800)}`).join('\n\n')

  const p = project as { minLevel?: number; maxLevel?: number; partySize?: number; description?: string }
  const levelRange = `${p.minLevel ?? 1}–${p.maxLevel ?? 5}`

  const systemPrompt = `You are a D&D 5e character generator. Generate a complete, valid level 1 character appropriate for this campaign.

Campaign: ${project.name}${p.description ? `\n${p.description}` : ''}
Level range: ${levelRange}

${docSummary ? `Campaign documents:\n${docSummary}` : ''}

Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "characterName": string,
  "className": string,
  "subclass": string,
  "race": string,
  "background": string,
  "alignment": string,
  "level": 1,
  "STR": number (8-16),
  "DEX": number (8-16),
  "CON": number (8-16),
  "INT": number (8-16),
  "WIS": number (8-16),
  "CHA": number (8-16),
  "maxHP": number,
  "currentHP": number,
  "AC": number,
  "speed": 30,
  "savingThrowProfs": { "STR": bool, "DEX": bool, "CON": bool, "INT": bool, "WIS": bool, "CHA": bool },
  "skillProfs": { "[skill name]": { "prof": true, "expertise": false }, ... },
  "spellSlots": {},
  "attacks": [{ "name": string, "attackBonus": number, "damage": string, "damageType": string, "range": string, "notes": string }],
  "features": [{ "name": string, "source": string, "description": string }],
  "personalityTraits": string,
  "ideals": string,
  "bonds": string,
  "flaws": string,
  "backstory": string
}

Use the standard array from 5e: assign 15,14,13,12,10,8 to stats based on class. Calculate HP as class hit die + CON modifier. Calculate AC as 10 + DEX mod (or 11 + DEX for leather, 16 for chain, etc based on starting equipment). Add 2 saving throw proficiencies and 2-4 skill proficiencies appropriate for the class. Make the character thematically fitting for the campaign setting.`

  const userMsg = prompt
    ? `Generate a character matching this description: ${prompt}`
    : `Generate a random character appropriate for this campaign.`

  try {
    let content = ''

    if (provider === 'openclaw') {
      // OpenClaw uses the OpenAI Responses API format — call it directly
      const baseUrl = (settings?.openClawBaseUrl ?? '').replace(/\/$/, '')
      const responsesUrl = baseUrl.endsWith('/v1/responses') ? baseUrl
        : baseUrl.endsWith('/v1') ? baseUrl + '/responses'
        : baseUrl + '/v1/responses'
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (settings?.openClawApiKey) headers['Authorization'] = `Bearer ${settings.openClawApiKey}`
      const res = await fetch(responsesUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'openclaw',
          instructions: systemPrompt,
          input: userMsg,
          max_output_tokens: 4000,
        }),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      // Extract text from OpenClaw response (same shape as postOpenClawResponses)
      const output = Array.isArray(data.output) ? data.output : []
      for (const item of output) {
        const c = Array.isArray(item.content) ? item.content : []
        for (const block of c) {
          if (block.type === 'output_text' && block.text) { content = block.text; break }
          if (block.type === 'text' && block.text) { content = block.text; break }
        }
        if (content) break
        if (typeof item.content === 'string' && item.content) { content = item.content; break }
      }
      if (!content && data.output_text) content = data.output_text
    } else if (provider === 'openai') {
      const openai = new OpenAI({ apiKey: settings!.aiApiKey })
      const resp = await openai.chat.completions.create({
        model: aiModel!,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        temperature: 0.9,
      })
      content = resp.choices[0]?.message?.content ?? ''
    } else {
      // anthropic
      const anthropic = new Anthropic({ apiKey: settings!.aiApiKey ?? '' })
      const resp = await anthropic.messages.create({
        model: aiModel!,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      })
      content = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
    }

    // Extract JSON — strip fences and find the first {...} block
    content = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const jsonStart = content.indexOf('{')
    const jsonEnd = content.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) throw new Error(`No JSON object in response: ${content.slice(0, 200)}`)
    content = content.slice(jsonStart, jsonEnd + 1)
    // Sanitize common AI JSON mistakes
    content = content.replace(/,(\s*[}\]])/g, '$1')           // trailing commas
    content = content.replace(/\}(\s*)\{/g, '},$1{')          // missing comma between objects in array
    content = content.replace(/\](\s*)\[/g, '],$1[')          // missing comma between arrays
    // Replace literal (unescaped) control characters inside strings
    content = content.replace(/"((?:[^"\\]|\\.)*)"/g, (_m, inner) =>
      '"' + inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"'
    )
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(content)
    } catch (parseErr) {
      console.error('[Character gen raw content]', content.slice(0, 500))
      throw parseErr
    }

    // Ensure required fields have sane defaults
    const result = {
      characterName: String(parsed.characterName ?? 'Unnamed Hero'),
      className: String(parsed.className ?? ''),
      subclass: String(parsed.subclass ?? ''),
      race: String(parsed.race ?? ''),
      background: String(parsed.background ?? ''),
      alignment: String(parsed.alignment ?? ''),
      level: 1,
      xp: 0,
      STR: Number(parsed.STR ?? 10), DEX: Number(parsed.DEX ?? 10),
      CON: Number(parsed.CON ?? 10), INT: Number(parsed.INT ?? 10),
      WIS: Number(parsed.WIS ?? 10), CHA: Number(parsed.CHA ?? 10),
      maxHP: Number(parsed.maxHP ?? 10),
      currentHP: Number(parsed.currentHP ?? parsed.maxHP ?? 10),
      tempHP: 0, AC: Number(parsed.AC ?? 10), speed: Number(parsed.speed ?? 30),
      proficiencyBonus: 2, initiative: 0, inspiration: false,
      savingThrowProfs: parsed.savingThrowProfs ?? {},
      skillProfs: parsed.skillProfs ?? {},
      deathSaveSuccesses: 0, deathSaveFailures: 0,
      attacks: parsed.attacks ?? [],
      spellSlots: parsed.spellSlots ?? {},
      spellsPrepared: [],
      inventory: [],
      currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      features: parsed.features ?? [],
      personalityTraits: String(parsed.personalityTraits ?? ''),
      ideals: String(parsed.ideals ?? ''),
      bonds: String(parsed.bonds ?? ''),
      flaws: String(parsed.flaws ?? ''),
      backstory: String(parsed.backstory ?? ''),
      conditions: [],
    }

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Character generate error]', msg)
    return NextResponse.json({ error: `Failed to generate character: ${msg}` }, { status: 500 })
  }
}
