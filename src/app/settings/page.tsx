'use client'

import { useState, useEffect, useCallback } from 'react'

type Provider = 'anthropic' | 'openai' | 'openclaw'

type AppSettings = {
  aiProvider: Provider
  aiModel: string
  aiApiKey: string
  aiApiKeySet: boolean
  openClawBaseUrl: string
  openClawApiKey: string
  openClawApiKeySet: boolean
  openClawAgentId: string
  contextFiles: string // JSON array of file paths
}

type User = {
  id: number
  username: string
  role: 'admin' | 'contributor'
  createdAt: string
}

const PROVIDERS: Array<{ value: Provider; label: string; subtitle: string }> = [
  { value: 'anthropic', label: 'Claude (Anthropic)',  subtitle: 'claude-opus-4-6 · api.anthropic.com' },
  { value: 'openai',    label: 'ChatGPT (OpenAI)',    subtitle: 'gpt-5.4 · api.openai.com' },
  { value: 'openclaw',  label: 'OpenClaw', subtitle: 'External agent · custom endpoint' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function AdminPanel({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers]           = useState<User[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied]         = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [roleLoading, setRoleLoading]   = useState<number | null>(null)
  const [deletingId, setDeletingId]     = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    const [usersRes, inviteRes] = await Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/invite').then(r => r.json()),
    ])
    setUsers(usersRes)
    setInviteCode(inviteRes.inviteCode ?? '')
    setLoadingUsers(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const regenerate = async () => {
    setRegenerating(true)
    const res = await fetch('/api/admin/invite', { method: 'POST' })
    const data = await res.json()
    setInviteCode(data.inviteCode)
    setRegenerating(false)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const setRole = async (id: number, role: 'admin' | 'contributor') => {
    setRoleLoading(id)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    })
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
    setRoleLoading(null)
  }

  const deleteUser = async (id: number) => {
    setDeletingId(id)
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setUsers(prev => prev.filter(u => u.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6 space-y-6">
      <h2 className="text-sm font-semibold text-slate-300">Admin</h2>

      {/* ── Invite code ── */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Invite Code</p>
        <p className="text-xs text-slate-600 mb-3">
          Anyone with this code can create an account. Regenerate it to invalidate the old one.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <code className="flex-1 bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-sm font-mono text-emerald-300 tracking-widest select-all break-all">
            {inviteCode || '—'}
          </code>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={copyCode}
              className="flex-1 sm:flex-none px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700/60 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="flex-1 sm:flex-none px-3 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-40"
              title="Generate a new code — the old one stops working immediately"
            >
              {regenerating ? 'Generating…' : '↺ Regenerate'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Users ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Users</p>
          <span className="text-xs text-slate-600">{users.length} account{users.length !== 1 ? 's' : ''}</span>
        </div>

        {loadingUsers ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <div
                key={user.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 px-3 rounded-lg bg-slate-800/40 border border-slate-700/30 gap-2"
              >
                {/* Name + date */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-slate-200 font-medium truncate">@{user.username}</span>
                  <span className="text-xs text-slate-600 shrink-0">{formatDate(user.createdAt)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {user.id === currentUserId ? (
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded capitalize">
                      {user.role} (you)
                    </span>
                  ) : (
                    <>
                      <div className="flex rounded-lg border border-slate-700/60 overflow-hidden text-xs">
                        {(['admin', 'contributor'] as const).map(r => (
                          <button
                            key={r}
                            onClick={() => setRole(user.id, r)}
                            disabled={user.role === r || roleLoading === user.id}
                            className={`px-2.5 py-1 capitalize transition-colors disabled:cursor-default ${
                              user.role === r
                                ? r === 'admin'
                                  ? 'bg-emerald-600/20 text-emerald-400 font-semibold'
                                  : 'bg-slate-700/60 text-slate-300 font-semibold'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => deleteUser(user.id)}
                        disabled={deletingId === user.id}
                        className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40 transition-colors shrink-0"
                      >
                        {deletingId === user.id ? '…' : 'Remove'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Settings page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [form, setForm] = useState<AppSettings>({
    aiProvider: 'anthropic',
    aiModel: '',
    aiApiKey: '',
    aiApiKeySet: false,
    openClawBaseUrl: '',
    openClawApiKey: '',
    openClawApiKeySet: false,
    openClawAgentId: '',
    contextFiles: '[]',
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: number; isAdmin: boolean } | null>(null)
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
    ]).then(([settings, me]) => {
      setForm(settings)
      if (me) setCurrentUser({ id: me.id, isAdmin: me.role === 'admin' })
      setLoading(false)
    })
  }, [])

  const testConnection = async () => {
    setTestState('testing')
    setTestError('')
    try {
      const res = await fetch('/api/settings/test-openclaw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: form.openClawBaseUrl,
          apiKey: form.openClawApiKey,
          agentId: form.openClawAgentId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestState('ok')
        setTimeout(() => setTestState('idle'), 3000)
      } else {
        setTestState('fail')
        setTestError(data.error ?? 'Unknown error')
      }
    } catch {
      setTestState('fail')
      setTestError('Request failed — check the console.')
    }
  }

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
          <p className="text-sm text-slate-600 mt-0.5">Configure your AI assistant and access control.</p>
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

          {form.aiProvider !== 'openclaw' && (
            <div className="mb-5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Model
              </label>
              <input
                type="text"
                value={form.aiModel}
                onChange={(e) => setForm({ ...form, aiModel: e.target.value })}
                placeholder={
                  form.aiProvider === 'anthropic'
                    ? 'claude-opus-4-6 (default)'
                    : 'gpt-5.4 (default)'
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
              />
              <p className="text-xs text-slate-600 mt-1">
                {form.aiProvider === 'anthropic'
                  ? 'e.g. claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001'
                  : 'e.g. gpt-5.4, gpt-5.4-mini, gpt-5.4-nano'}
                {' — '}Leave blank to use the default.
              </p>
            </div>
          )}

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
                    : form.aiProvider === 'anthropic' ? 'sk-ant-...' : 'sk-...'
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

          {form.aiProvider === 'openclaw' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-lg text-xs text-slate-400 leading-relaxed space-y-1">
                <p>
                  <span className="text-slate-300 font-medium">OpenClaw Gateway</span> — point this at your Gateway HTTP endpoint. DAN will call the official <code className="bg-slate-700 px-1 rounded text-slate-300">/v1/responses</code> API.
                </p>
                <p>
                  <span className="text-slate-300 font-medium">Base URL</span> — you can enter either the Gateway root, like <code className="bg-slate-700 px-1 rounded text-slate-300">http://localhost:18789</code>, or the full responses URL ending in <code className="bg-slate-700 px-1 rounded text-slate-300">/v1/responses</code>.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                  Server URL <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.openClawBaseUrl}
                    onChange={(e) => { setForm({ ...form, openClawBaseUrl: e.target.value }); setTestState('idle') }}
                    placeholder="http://localhost:18789 or http://localhost:18789/v1/responses"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                  />
                  <button
                    onClick={testConnection}
                    disabled={!form.openClawBaseUrl.trim() || testState === 'testing'}
                    className={`px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-colors disabled:opacity-40 ${
                      testState === 'ok'
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                        : testState === 'fail'
                        ? 'bg-red-600/20 text-red-400 border border-red-500/40'
                        : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {testState === 'testing' ? 'Testing…' : testState === 'ok' ? '✓ Connected' : testState === 'fail' ? '✕ Failed' : 'Test'}
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  DAN sends prompts to your OpenClaw Gateway from the server side. Use the Gateway token as the bearer token if auth is enabled.
                </p>
                {testState === 'fail' && testError && (
                  <p className="text-xs text-red-400 mt-1">{testError}</p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                  Agent ID
                </label>
                <input
                  type="text"
                  value={form.openClawAgentId}
                  onChange={(e) => setForm({ ...form, openClawAgentId: e.target.value })}
                  placeholder="my-agent"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                />
                <p className="text-xs text-slate-600 mt-1">
                  Optional. Sent as <code className="bg-slate-800 px-1 rounded text-slate-400">agentId</code> in the payload — useful if your server hosts multiple agents.
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
                  placeholder={form.openClawApiKeySet ? 'Enter a new key to replace' : 'Bearer token'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                />
                <p className="text-xs text-slate-600 mt-1">
                  If set, sent as <code className="bg-slate-800 px-1 rounded text-slate-400">Authorization: Bearer …</code> — leave blank for an open server.
                </p>
              </div>


            </div>
          )}
        </div>

        {/* ── Workspace Context Files ──────────────────────── */}
        {(() => {
          let paths: string[] = []
          try { paths = JSON.parse(form.contextFiles) } catch {}
          const setPaths = (next: string[]) => setForm({ ...form, contextFiles: JSON.stringify(next) })
          return (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6">
              <h2 className="text-sm font-semibold text-slate-300 mb-1">Workspace Context Files</h2>
              <p className="text-xs text-slate-600 mb-4">
                File paths loaded into the agent&apos;s system prompt at the start of every session. Use absolute paths (e.g. <code className="bg-slate-800 px-1 rounded text-slate-400">/app/data/CONTEXT.md</code>). Files that can&apos;t be read are silently skipped.
              </p>
              <div className="space-y-2">
                {paths.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={p}
                      onChange={e => {
                        const next = [...paths]
                        next[i] = e.target.value
                        setPaths(next)
                      }}
                      placeholder="/absolute/path/to/CONTEXT.md"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                    />
                    <button
                      onClick={() => setPaths(paths.filter((_, j) => j !== i))}
                      className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none px-1"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setPaths([...paths, ''])}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  + Add file path
                </button>
              </div>
            </div>
          )
        })()}

        {/* ── Admin panel (admins only) ────────────────────── */}
        {currentUser?.isAdmin && <AdminPanel currentUserId={currentUser.id} />}
      </div>
    </div>
  )
}
