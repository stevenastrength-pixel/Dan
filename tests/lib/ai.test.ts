import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSystemPrompt, streamOpenClaw } from '../../src/lib/ai'

describe('buildSystemPrompt', () => {
  it('renders style guide, parsed traits, grouped world entries, and chapter context', async () => {
    const prompt = buildSystemPrompt({
      characters: [
        {
          name: 'Elara',
          role: 'Protagonist',
          description: 'A tactician with a dangerous memory.',
          traits: JSON.stringify(['observant', 'guarded']),
        },
      ],
      worldEntries: [
        { name: 'The Citadel', type: 'Location', description: 'Seat of the old empire.' },
        { name: 'The Weave', type: 'Magic', description: 'A living network of memory.' },
      ],
      styleGuide: 'Write in close third person with restrained prose.',
      chapter: {
        title: 'Chapter 3',
        synopsis: 'Elara enters the citadel under false pretenses.',
        content: '<p>The gates opened at dawn.</p>',
      },
    })

    expect(prompt).toContain('## Style Guide')
    expect(prompt).toContain('Write in close third person with restrained prose.')
    expect(prompt).toContain('**Elara** (Protagonist): A tactician with a dangerous memory. | Traits: observant, guarded')
    expect(prompt).toContain('### Locations')
    expect(prompt).toContain('### Magics')
    expect(prompt).toContain('## Current Chapter: "Chapter 3"')
    expect(prompt).toContain('Synopsis: Elara enters the citadel under false pretenses.')
    expect(prompt).toContain('Content (HTML):')
  })

  it('falls back cleanly when no context exists', async () => {
    const prompt = buildSystemPrompt({
      characters: [],
      worldEntries: [],
      styleGuide: '',
      chapter: null,
    })

    expect(prompt).toContain('No characters defined yet.')
    expect(prompt).toContain('No world entries defined yet.')
    expect(prompt).not.toContain('## Style Guide')
    expect(prompt).not.toContain('## Current Chapter')
  })
})

describe('streamOpenClaw', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sends the expected payload and yields the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'A cold wind moved through the hall.' }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const chunks: string[] = []
    for await (const chunk of streamOpenClaw({
      messages: [{ role: 'user', content: 'Continue the scene.' }],
      systemPrompt: 'You are Daneel.',
      openClawBaseUrl: 'http://localhost:3000/api/openclaw-bridge',
      openClawApiKey: 'secret-key',
      openClawAgentId: 'agent-7',
      context: {
        project: { id: 1, slug: 'my-novel', name: 'My Novel' },
        documents: [{ key: 'story_bible', title: 'Story Bible', content: 'Canon facts' }],
        characters: [{ name: 'Elara', role: 'Lead', description: 'Hero', notes: 'Afraid of heights' }],
        worldEntries: [{ name: 'Citadel', type: 'Location', description: 'A fortress city' }],
        styleGuide: 'Terse prose only.',
        sessionKey: 'session-123',
      },
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(['A cold wind moved through the hall.'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/openclaw-bridge',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-key',
        },
      })
    )

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(requestInit.body))

    expect(body).toMatchObject({
      agentId: 'agent-7',
      sessionKey: 'session-123',
      mode: 'agent',
      project: { id: 1, slug: 'my-novel', name: 'My Novel' },
      context: {
        documents: [{ key: 'story_bible', title: 'Story Bible', content: 'Canon facts' }],
        characters: [{ name: 'Elara', role: 'Lead', description: 'Hero', notes: 'Afraid of heights' }],
        worldEntries: [{ name: 'Citadel', type: 'Location', description: 'A fortress city' }],
        styleGuide: 'Terse prose only.',
      },
      messages: [
        { role: 'system', content: 'You are Daneel.' },
        { role: 'user', content: 'Continue the scene.' },
      ],
    })
  })

  it('surfaces provider errors with response detail', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'gateway unavailable' }),
      text: async () => '',
    }) as unknown as typeof fetch

    await expect(async () => {
      for await (const _chunk of streamOpenClaw({
        messages: [],
        systemPrompt: 'You are Daneel.',
        openClawBaseUrl: 'http://localhost:9999/agent',
        context: {
          project: { id: 1, slug: 'my-novel', name: 'My Novel' },
          documents: [],
          characters: [],
          worldEntries: [],
          styleGuide: '',
        },
      })) {
        // no-op
      }
    }).rejects.toThrow('OpenClaw provider error: 502 — gateway unavailable')
  })

  it('throws when the server returns an unexpected response shape', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ toolCalls: [] }),
    }) as unknown as typeof fetch

    await expect(async () => {
      for await (const _chunk of streamOpenClaw({
        messages: [],
        systemPrompt: 'You are Daneel.',
        openClawBaseUrl: 'http://localhost:9999/agent',
        context: {
          project: { id: 1, slug: 'my-novel', name: 'My Novel' },
          documents: [],
          characters: [],
          worldEntries: [],
          styleGuide: '',
        },
      })) {
        // no-op
      }
    }).rejects.toThrow('OpenClaw provider returned an unexpected response shape')
  })
})
