'use client'

import { useState, useEffect } from 'react'

type Provider = 'anthropic' | 'openai' | 'openclaw'

type Settings = {
  styleGuide: string
  aiProvider: Provider
  aiApiKey: string
  aiApiKeySet: boolean
  openClawBaseUrl: string
  openClawApiKey: string
  openClawApiKeySet: boolean
  openClawAgentId: string
}

const PROVIDERS: Array<{
  value: Provider
  label: string
  subtitle: string
}> = [
  {
    value: 'anthropic',
    label: 'Claude (Anthropic)',
    subtitle: 'claude-opus-4-6 · api.anthropic.com',
  },
  {
    value: 'openai',
    label: 'ChatGPT (OpenAI)',
    subtitle: 'gpt-4o · api.openai.com',
  },
  {
    value: 'openclaw',
    label: 'OpenClaw (MG420Bot)',
    subtitle: 'External agent · custom endpoint',
  },
]

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>({
    styleGuide: '',
    aiProvider: 'anthropic',
    aiApiKey: '',
    aiApiKeySet: false,
    openClawBaseUrl: '',
    openClawApiKey: '',
    openClawApiKeySet: false,
    openClawAgentId: '',
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setForm(data)
        setLoading(false)
      })
  }, [])

  const save = async () => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-slate-600 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-200">Settings</h1>
          <p className="text-sm text-slate-600 mt-0.5">Configure your AI assistant and style guide.</p>
        </div>
        <button
          onClick={save}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="space-y-6">
        {/* ── AI Provider ─────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">AI Provider</h2>

          {/* Provider selector */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setForm({ ...form, aiProvider: p.value })}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  form.aiProvider === p.value
                    ? 'border-emerald-500/60 bg-emerald-600/10'
                    : 'border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <p className="font-semibold text-slate-200 text-sm">{p.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{p.subtitle}</p>
              </button>
            ))}
          </div>

          {/* Anthropic / OpenAI API key */}
          {(form.aiProvider === 'anthropic' || form.aiProvider === 'openai') && (
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                API Key
                {form.aiApiKeySet && (
                  <span className="ml-2 text-emerald-400 normal-case font-normal">✓ Key saved</span>
                )}
              </label>
              <input
                type="password"
                value={form.aiApiKey}
                onChange={(e) => setForm({ ...form, aiApiKey: e.target.value })}
                placeholder={
                  form.aiApiKeySet
                    ? 'Enter a new key to replace the saved one'
                    : form.aiProvider === 'anthropic'
                    ? 'sk-ant-...'
                    : 'sk-...'
                }
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
              />
              <p className="text-xs text-slate-600 mt-1">
                {form.aiProvider === 'anthropic'
                  ? 'Get your key at console.anthropic.com'
                  : 'Get your key at platform.openai.com'}
                {' · '}The key is stored on your server and never shared.
              </p>
            </div>
          )}

          {/* OpenClaw config */}
          {form.aiProvider === 'openclaw' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                OpenClaw routes all agent chat through your external MG420Bot endpoint. The app
                sends project context, documents, and message history as JSON — your server handles
                the AI call and returns{' '}
                <code className="bg-amber-500/20 px-1 rounded">{'{ reply: string }'}</code>.
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                  Base URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.openClawBaseUrl}
                  onChange={(e) => setForm({ ...form, openClawBaseUrl: e.target.value })}
                  placeholder="https://my-openclaw-host/api"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                />
                <p className="text-xs text-slate-600 mt-1">
                  The app will POST to <code className="bg-slate-800 px-1 rounded text-slate-400">{'{Base URL}/novel-agent'}</code>
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                  Agent ID
                </label>
                <input
                  type="text"
                  value={form.openClawAgentId}
                  onChange={(e) => setForm({ ...form, openClawAgentId: e.target.value })}
                  placeholder="mg420-main"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                />
                <p className="text-xs text-slate-600 mt-1">
                  Sent as <code className="bg-slate-800 px-1 rounded text-slate-400">agentId</code> in the payload — lets your endpoint route to the right session.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                  API Key (optional)
                  {form.openClawApiKeySet && (
                    <span className="ml-2 text-emerald-400 normal-case font-normal">✓ Key saved</span>
                  )}
                </label>
                <input
                  type="password"
                  value={form.openClawApiKey}
                  onChange={(e) => setForm({ ...form, openClawApiKey: e.target.value })}
                  placeholder={
                    form.openClawApiKeySet ? 'Enter a new key to replace' : 'Bearer token (optional)'
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                />
                <p className="text-xs text-slate-600 mt-1">
                  If set, sent as <code className="bg-slate-800 px-1 rounded text-slate-400">Authorization: Bearer …</code>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Style Guide ─────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">Style Guide</h2>
          <p className="text-sm text-slate-500 mb-4">
            Describe your novel's tone, voice, point of view, tense, and any writing rules. The AI
            reads this before every message — this replaces your{' '}
            <code className="text-xs bg-slate-800 text-slate-400 px-1 py-0.5 rounded">style_guide.md</code>.
          </p>
          <textarea
            value={form.styleGuide}
            onChange={(e) => setForm({ ...form, styleGuide: e.target.value })}
            rows={14}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono resize-y"
            placeholder={`Example:\n- Written in third-person limited POV, following Anya\n- Past tense throughout\n- Dark fantasy tone — gritty but with moments of dry humour\n- Sentences are short and punchy during action, longer and descriptive during introspection\n- Avoid adverbs; show emotion through action and dialogue\n- Chapter openings always start in the middle of a scene, never with description`}
          />
        </div>
      </div>
    </div>
  )
}
