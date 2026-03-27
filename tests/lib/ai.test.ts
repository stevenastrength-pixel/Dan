import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSystemPrompt, callOpenClawWithTools, streamOpenClaw } from '../../src/lib/ai'

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
    const responseBody = {
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'A cold wind moved through the hall.' }],
        },
      ],
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(responseBody),
      json: async () => responseBody,
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const chunks: string[] = []
    for await (const chunk of streamOpenClaw({
      messages: [{ role: 'user', content: 'Continue the scene.' }],
      systemPrompt: 'You are Daneel.',
      openClawBaseUrl: 'http://localhost:18789',
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
      'http://localhost:18789/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-key',
          'x-openclaw-agent-id': 'agent-7',
          'x-openclaw-session-key': 'session-123',
        },
      })
    )

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(requestInit.body))

    expect(body).toMatchObject({
      model: 'openclaw',
      instructions: 'You are Daneel.',
      input: [
        { type: 'message', role: 'user', content: 'Continue the scene.' },
      ],
    })
  })

  it('surfaces provider errors with response detail', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { message: 'gateway unavailable' } }),
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
    const responseBody = { output: [] }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(responseBody),
      json: async () => responseBody,
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

  it('runs the OpenClaw function-call loop through /v1/responses', async () => {
    const toolCallBody = {
      output: [
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'patch_chapter',
          arguments: JSON.stringify({ id: 'ch_1', find: 'old', replace: 'new' }),
        },
      ],
    }
    const finalBody = {
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Chapter updated successfully.' }],
        },
      ],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(toolCallBody),
        json: async () => toolCallBody,
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(finalBody),
        json: async () => finalBody,
      })

    global.fetch = fetchMock as unknown as typeof fetch

    const onToolCall = vi.fn().mockResolvedValue('Patched chapter "Chapter 1".')

    const result = await callOpenClawWithTools({
      messages: [{ role: 'user', content: '@Daneel tighten this scene.' }],
      systemPrompt: 'You are Daneel.',
      openClawBaseUrl: 'http://localhost:18789',
      openClawApiKey: 'gateway-token',
      openClawAgentId: 'main',
      context: {
        project: { id: 1, slug: 'my-novel', name: 'My Novel' },
        documents: [],
        characters: [],
        worldEntries: [],
        styleGuide: '',
        sessionKey: 'session-456',
      },
      tools: [
        {
          name: 'patch_chapter',
          description: 'Patch a chapter.',
          input_schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              find: { type: 'string' },
              replace: { type: 'string' },
            },
            required: ['id', 'find', 'replace'],
          },
        },
      ],
      onToolCall,
    })

    expect(result).toEqual({
      text: 'Chapter updated successfully.',
      toolCalls: [
        {
          name: 'patch_chapter',
          input: { id: 'ch_1', find: 'old', replace: 'new' },
          result: 'Patched chapter "Chapter 1".',
        },
      ],
    })

    expect(onToolCall).toHaveBeenCalledWith('patch_chapter', { id: 'ch_1', find: 'old', replace: 'new' })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstRequest = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))
    expect(firstRequest).toMatchObject({
      model: 'openclaw',
      instructions: 'You are Daneel.',
      input: [{ type: 'message', role: 'user', content: '@Daneel tighten this scene.' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'patch_chapter',
            description: 'Patch a chapter.',
          },
        },
      ],
    })

    const secondRequest = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))
    expect(secondRequest).toMatchObject({
      model: 'openclaw',
      input: [
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: 'Patched chapter "Chapter 1".',
        },
      ],
    })
  })

  it('continues the tool loop when a response contains assistant text and function calls together', async () => {
    const mixedBody = {
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Let me check the Story Bible.' }],
        },
        {
          type: 'function_call',
          call_id: 'call_story_bible',
          name: 'get_document',
          arguments: JSON.stringify({ key: 'story_bible' }),
        },
      ],
    }
    const finalBody = {
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'I can now see the full Story Bible.' }],
        },
      ],
    }

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mixedBody),
        json: async () => mixedBody,
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(finalBody),
        json: async () => finalBody,
      })

    global.fetch = fetchMock as unknown as typeof fetch

    const onToolCall = vi.fn().mockResolvedValue('Full content of "Story Bible":\n\nComplete canonical reference')

    const result = await callOpenClawWithTools({
      messages: [{ role: 'user', content: '@Daneel can you read the story bible?' }],
      systemPrompt: 'You are Daneel.',
      openClawBaseUrl: 'http://localhost:18789',
      openClawApiKey: 'gateway-token',
      openClawAgentId: 'main',
      context: {
        project: { id: 1, slug: 'my-novel', name: 'My Novel' },
        documents: [],
        characters: [],
        worldEntries: [],
        styleGuide: '',
        sessionKey: 'session-789',
      },
      tools: [
        {
          name: 'get_document',
          description: 'Read a project document.',
          input_schema: {
            type: 'object',
            properties: {
              key: { type: 'string' },
            },
            required: ['key'],
          },
        },
      ],
      onToolCall,
    })

    expect(onToolCall).toHaveBeenCalledWith('get_document', { key: 'story_bible' })
    expect(result).toEqual({
      text: 'Let me check the Story Bible.\n\nI can now see the full Story Bible.',
      toolCalls: [
        {
          name: 'get_document',
          input: { key: 'story_bible' },
          result: 'Full content of "Story Bible":\n\nComplete canonical reference',
        },
      ],
    })
  })

  it('expands multi_tool_use.parallel wrappers into individual tool executions', async () => {
    const batchedBody = {
      output: [
        {
          type: 'function_call',
          call_id: 'call_batch',
          name: 'multi_tool_use.parallel',
          arguments: JSON.stringify({
            tool_uses: [
              {
                recipient_name: 'create_character',
                parameters: {
                  name: 'Jonah Vale',
                  role: 'Protagonist',
                  description: 'A weary smuggler.',
                  notes: 'Main viewpoint character.',
                  traits: ['dry', 'observant'],
                },
              },
              {
                recipient_name: 'create_character',
                parameters: {
                  name: 'Iona',
                  role: 'Supporting',
                  description: 'A precise fixer.',
                  notes: 'Transactional and controlled.',
                  traits: ['precise'],
                },
              },
            ],
          }),
        },
      ],
    }
    const finalBody = {
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Added the characters to the database.' }],
        },
      ],
    }

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(batchedBody),
        json: async () => batchedBody,
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(finalBody),
        json: async () => finalBody,
      })

    global.fetch = fetchMock as unknown as typeof fetch

    const onToolCall = vi
      .fn()
      .mockResolvedValueOnce('Created character "Jonah Vale" with id: ch_jonah')
      .mockResolvedValueOnce('Created character "Iona" with id: ch_iona')

    const result = await callOpenClawWithTools({
      messages: [{ role: 'user', content: '@Daneel add all characters from the bible.' }],
      systemPrompt: 'You are Daneel.',
      openClawBaseUrl: 'http://localhost:18789',
      openClawApiKey: 'gateway-token',
      openClawAgentId: 'main',
      context: {
        project: { id: 1, slug: 'my-novel', name: 'My Novel' },
        documents: [],
        characters: [],
        worldEntries: [],
        styleGuide: '',
        sessionKey: 'session-batch',
      },
      tools: [
        {
          name: 'create_character',
          description: 'Create a new character.',
          input_schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role: { type: 'string' },
              description: { type: 'string' },
              notes: { type: 'string' },
              traits: { type: 'array', items: { type: 'string' } },
            },
            required: ['name'],
          },
        },
      ],
      onToolCall,
    })

    expect(onToolCall).toHaveBeenCalledTimes(2)
    expect(onToolCall).toHaveBeenNthCalledWith(1, 'create_character', {
      name: 'Jonah Vale',
      role: 'Protagonist',
      description: 'A weary smuggler.',
      notes: 'Main viewpoint character.',
      traits: ['dry', 'observant'],
    })
    expect(onToolCall).toHaveBeenNthCalledWith(2, 'create_character', {
      name: 'Iona',
      role: 'Supporting',
      description: 'A precise fixer.',
      notes: 'Transactional and controlled.',
      traits: ['precise'],
    })
    expect(result).toEqual({
      text: 'Added the characters to the database.',
      toolCalls: [
        {
          name: 'create_character',
          input: {
            name: 'Jonah Vale',
            role: 'Protagonist',
            description: 'A weary smuggler.',
            notes: 'Main viewpoint character.',
            traits: ['dry', 'observant'],
          },
          result: 'Created character "Jonah Vale" with id: ch_jonah',
        },
        {
          name: 'create_character',
          input: {
            name: 'Iona',
            role: 'Supporting',
            description: 'A precise fixer.',
            notes: 'Transactional and controlled.',
            traits: ['precise'],
          },
          result: 'Created character "Iona" with id: ch_iona',
        },
      ],
    })
  })
})
