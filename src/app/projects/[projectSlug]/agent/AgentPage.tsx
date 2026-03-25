'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectInfo = { id: number; name: string; slug: string; description: string }

type ProjectDocument = {
  id: number
  key: string
  title: string
  content: string
  updatedAt: string
}

type Poll = {
  id: number
  question: string
  options: string[]
  createdBy: string
  status: 'OPEN' | 'CLOSED'
  createdAt: string
  votes: Array<{ voterName: string; optionIdx: number }>
}

type ChatMessage = { role: 'user' | 'assistant'; content: string; author?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Username Modal ───────────────────────────────────────────────────────────

function UsernameModal({ onSave }: { onSave: (name: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-80">
        <h2 className="text-base font-semibold text-slate-100 mb-1">Who are you?</h2>
        <p className="text-sm text-slate-500 mb-4">
          Enter your name to get started. Saved in your browser.
        </p>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && val.trim() && onSave(val.trim())}
          placeholder="Your name"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-3"
        />
        <button
          disabled={!val.trim()}
          onClick={() => onSave(val.trim())}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 max-w-md text-center">
      {message}
    </div>
  )
}

// ─── Document Sidebar ─────────────────────────────────────────────────────────

function DocSidebar({
  documents,
  selectedKey,
  onSelect,
  projectSlug,
}: {
  documents: ProjectDocument[]
  selectedKey: string | null
  onSelect: (key: string) => void
  projectSlug: string
}) {
  return (
    <div className="w-52 border-r border-slate-800/60 flex flex-col shrink-0 bg-slate-900/40">
      <div className="px-3 py-3 border-b border-slate-800/60">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Documents</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {documents.map((doc) => (
          <button
            key={doc.key}
            onClick={() => onSelect(doc.key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedKey === doc.key
                ? 'bg-emerald-600/15 text-emerald-300'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <span className="block truncate">{doc.title}</span>
            {doc.content.trim() && (
              <span className="text-xs text-slate-600 font-normal">
                {timeAgo(doc.updatedAt)}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─── Document Editor ──────────────────────────────────────────────────────────

function DocEditor({
  doc,
  projectSlug,
  onSaved,
  onBack,
}: {
  doc: ProjectDocument
  projectSlug: string
  onSaved: (updated: ProjectDocument) => void
  onBack: () => void
}) {
  const [content, setContent] = useState(doc.content)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const dirty = content !== doc.content

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/projects/${projectSlug}/documents/${doc.key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title: doc.title }),
    })
    const updated = await res.json()
    setSaving(false)
    setSavedAt(new Date().toISOString())
    onSaved(updated)
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 shrink-0">
        <button
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Console
        </button>
        <span className="text-slate-800">|</span>
        <h2 className="text-sm font-semibold text-slate-300">{doc.title}</h2>
        <div className="ml-auto flex items-center gap-3">
          {savedAt && (
            <span className="text-xs text-slate-600">Saved {timeAgo(savedAt)}</span>
          )}
          {!savedAt && doc.updatedAt && (
            <span className="text-xs text-slate-600">Last saved {timeAgo(doc.updatedAt)}</span>
          )}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full resize-none px-5 py-4 text-sm font-mono text-slate-300 bg-slate-950 focus:outline-none leading-relaxed placeholder:text-slate-700"
        placeholder={
          doc.key === 'story_bible'
            ? 'Write a summary of the story, major themes, tone, and structure…'
            : doc.key === 'project_instructions'
            ? 'Write instructions for Daneel: how to help the team, what to watch out for, creative constraints…'
            : doc.key === 'wake_prompt'
            ? 'Write what Daneel should read on startup: current status, open threads, what the team is working on…'
            : 'Document content…'
        }
      />
    </div>
  )
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'GPT-4o (OpenAI)',
  openclaw: 'OpenClaw (MG420Bot)',
}

function ChatPanel({
  projectSlug,
  username,
  messages,
  setMessages,
}: {
  projectSlug: string
  username: string
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
}) {
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setProvider(d.aiProvider ?? 'anthropic'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text, author: username }
    const next = [...messages, userMsg]
    setMessages(next)
    setStreaming(true)

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    setMessages([...next, assistantMsg])

    try {
      const res = await fetch(`/api/projects/${projectSlug}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessages((prev) => {
          const u = [...prev]
          u[u.length - 1] = { role: 'assistant', content: `Error: ${data.error}` }
          return u
        })
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') break
          try {
            const parsed = JSON.parse(payload)
            if (parsed.text) {
              setMessages((prev) => {
                const u = [...prev]
                u[u.length - 1] = {
                  role: 'assistant',
                  content: u[u.length - 1].content + parsed.text,
                }
                return u
              })
            }
            if (parsed.error) {
              setMessages((prev) => {
                const u = [...prev]
                u[u.length - 1] = { role: 'assistant', content: `Error: ${parsed.error}` }
                return u
              })
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: 'Connection error.' }
        return u
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-950">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center mt-10">
            <p className="text-3xl mb-2 text-emerald-500">⬡</p>
            <p className="text-sm text-slate-600">Daneel is standing by.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm border ${
                msg.role === 'user'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-50'
                  : 'bg-slate-900/90 border-slate-700/60 text-slate-200'
              }`}
            >
              {msg.role === 'user' && msg.author && (
                <p className="text-emerald-400/70 text-xs mb-1 font-medium">{msg.author}</p>
              )}
              {msg.role === 'assistant' && (
                <p className="text-slate-500 text-xs mb-1 font-medium">Daneel</p>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.role === 'assistant' &&
                streaming &&
                i === messages.length - 1 &&
                msg.content === '' && (
                  <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse rounded" />
                )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2.5 border-t border-slate-800/60 bg-slate-950 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Message Daneel…"
            disabled={streaming}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
          >
            {streaming ? '…' : '↑'}
          </button>
        </div>
        {provider && (
          <p className="text-xs text-slate-700 mt-1.5">
            {PROVIDER_LABELS[provider] ?? provider}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Poll Card ────────────────────────────────────────────────────────────────

function PollCard({
  poll,
  username,
  onVote,
  onClose,
}: {
  poll: Poll
  username: string
  onVote: (idx: number) => void
  onClose: () => void
}) {
  const myVote = poll.votes.find((v) => v.voterName === username)
  const totalVotes = poll.votes.length
  const tallies = poll.options.map((_, i) => poll.votes.filter((v) => v.optionIdx === i).length)
  const maxTally = Math.max(...tallies, 0)
  const isOpen = poll.status === 'OPEN'

  return (
    <div
      className={`rounded-lg border p-3 ${
        isOpen ? 'border-slate-700/60 bg-slate-950/80' : 'border-slate-800/40 bg-slate-900/40 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <span
            className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded mb-1 ${
              isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/40 text-slate-500'
            }`}
          >
            {isOpen ? 'OPEN' : 'CLOSED'}
          </span>
          <p className="text-sm font-medium text-slate-200 leading-snug">{poll.question}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {poll.createdBy} · {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
          </p>
        </div>
        {isOpen && (
          <button
            onClick={onClose}
            className="text-xs text-slate-600 hover:text-red-400 shrink-0 transition-colors"
          >
            Close
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const count = tallies[i]
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isMine = myVote?.optionIdx === i
          const isWinner = !isOpen && count === maxTally && totalVotes > 0

          return (
            <button
              key={i}
              onClick={() => isOpen && onVote(i)}
              disabled={!isOpen}
              className={`w-full text-left rounded-lg border px-3 py-1.5 text-sm relative overflow-hidden transition-colors ${
                isMine
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                  : isWinner
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : 'border-slate-700/60 bg-slate-900/60 text-slate-300 hover:border-slate-600'
              } ${isOpen ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`absolute inset-y-0 left-0 opacity-20 rounded-l-lg ${
                  isMine ? 'bg-emerald-400' : isWinner ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  {isMine && <span className="text-emerald-400 text-xs">✓</span>}
                  {opt}
                </span>
                <span className="text-xs text-slate-600 shrink-0">
                  {count}{pct > 0 ? ` (${pct}%)` : ''}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {poll.votes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {poll.votes.map((v) => (
            <span key={v.voterName} className="text-xs bg-slate-800/60 text-slate-500 px-1.5 py-0.5 rounded-full">
              {v.voterName} → {poll.options[v.optionIdx] ?? '?'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Polls Panel ──────────────────────────────────────────────────────────────

function PollsPanel({
  projectSlug,
  username,
  polls,
  onRefresh,
}: {
  projectSlug: string
  username: string
  polls: Poll[]
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [creating, setCreating] = useState(false)

  const createPoll = async () => {
    const valid = options.filter((o) => o.trim())
    if (!question.trim() || valid.length < 2) return
    setCreating(true)
    await fetch(`/api/projects/${projectSlug}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), options: valid, createdBy: username }),
    })
    setQuestion('')
    setOptions(['', ''])
    setShowCreate(false)
    setCreating(false)
    onRefresh()
  }

  const vote = async (pollId: number, optionIdx: number) => {
    await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterName: username, optionIdx }),
    })
    onRefresh()
  }

  const closePoll = async (pollId: number) => {
    await fetch(`/api/polls/${pollId}/close`, { method: 'POST' })
    onRefresh()
  }

  const openPolls = polls.filter((p) => p.status === 'OPEN')
  const closedPolls = polls.filter((p) => p.status === 'CLOSED')
  const [closedExpanded, setClosedExpanded] = useState(false)

  return (
    <div className="border-t border-slate-800/60 bg-slate-900/30 shrink-0" style={{ maxHeight: '45%' }}>
      {/* Polls header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors"
        >
          <span>{open ? '▼' : '▶'}</span>
          Poll Control
          {openPolls.length > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full text-xs font-medium">
              {openPolls.length}
            </span>
          )}
        </button>
        {open && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            {showCreate ? 'Cancel' : '+ New Poll'}
          </button>
        )}
      </div>

      {open && (
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(45vh - 2rem)' }}>
          {/* Create form */}
          {showCreate && (
            <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/50">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Poll question…"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 mb-2"
              />
              <div className="space-y-1.5 mb-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={opt}
                      onChange={(e) => {
                        const n = [...options]
                        n[i] = e.target.value
                        setOptions(n)
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => setOptions(options.filter((_, j) => j !== i))}
                        className="text-slate-600 hover:text-red-400 text-sm transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setOptions([...options, ''])}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  + Add option
                </button>
                <button
                  onClick={createPoll}
                  disabled={creating || !question.trim() || options.filter((o) => o.trim()).length < 2}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Open polls */}
          <div className="p-3 space-y-2">
            {openPolls.length === 0 && !showCreate && (
              <p className="text-xs text-slate-600 text-center py-2">No open polls.</p>
            )}
            {openPolls.map((p) => (
              <PollCard
                key={p.id}
                poll={p}
                username={username}
                onVote={(idx) => vote(p.id, idx)}
                onClose={() => closePoll(p.id)}
              />
            ))}

            {/* Closed polls */}
            {closedPolls.length > 0 && (
              <div>
                <button
                  onClick={() => setClosedExpanded((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 w-full py-1 transition-colors"
                >
                  <span>{closedExpanded ? '▼' : '▶'}</span>
                  Closed ({closedPolls.length})
                </button>
                {closedExpanded &&
                  closedPolls.map((p) => (
                    <PollCard
                      key={p.id}
                      poll={p}
                      username={username}
                      onVote={() => {}}
                      onClose={() => {}}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentPage({ project }: { project: ProjectInfo }) {
  const [mounted, setMounted] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [selectedDocKey, setSelectedDocKey] = useState<string | null>(null)
  const [mainView, setMainView] = useState<'console' | 'document'>('console')
  const [polls, setPolls] = useState<Poll[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)

  const selectedDoc = documents.find((d) => d.key === selectedDocKey) ?? null

  // Mount + username
  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('novel-username')
    if (stored) setUsername(stored)
  }, [])

  const saveUsername = (name: string) => {
    localStorage.setItem('novel-username', name)
    setUsername(name)
  }

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.slug}/documents`)
    if (res.ok) setDocuments(await res.json())
  }, [project.slug])

  // Fetch polls
  const fetchPolls = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.slug}/polls`)
    if (res.ok) setPolls(await res.json())
  }, [project.slug])

  useEffect(() => {
    fetchDocuments()
    fetchPolls()
    const interval = setInterval(fetchPolls, 10000)
    return () => clearInterval(interval)
  }, [fetchDocuments, fetchPolls])

  const handleSelectDoc = (key: string) => {
    setSelectedDocKey(key)
    setMainView('document')
  }

  const handleDocSaved = (updated: ProjectDocument) => {
    setDocuments((prev) => prev.map((d) => (d.key === updated.key ? updated : d)))
    showToast(`"${updated.title}" saved.`)
  }

  const showToast = (msg: string) => {
    setToast(msg)
  }

  const reloadContext = async () => {
    setReloading(true)
    await fetchDocuments()
    const res = await fetch(`/api/projects/${project.slug}/agent/reload`, { method: 'POST' })
    const data = await res.json()
    showToast(data.message ?? 'Context reloaded.')
    setReloading(false)
  }

  const saveWakePrompt = async () => {
    const wakeDoc = documents.find((d) => d.key === 'wake_prompt')
    if (!wakeDoc) {
      showToast('Wake prompt document not found.')
      return
    }
    handleSelectDoc('wake_prompt')
    showToast('Edit the Wake Prompt and save — Daneel reads it on every startup.')
  }

  if (!mounted) return null

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {!username && <UsernameModal onSave={saveUsername} />}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Page header */}
      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-200 truncate">{project.name}</h1>
          <p className="text-xs text-slate-600">
            Control Room
            {username && (
              <span className="ml-2 text-emerald-500 font-medium">— {username}</span>
            )}
          </p>
        </div>

        {/* Context control buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={reloadContext}
            disabled={reloading}
            className="px-3 py-1.5 border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {reloading ? 'Reloading…' : '↺ Reload Context'}
          </button>
          <button
            onClick={saveWakePrompt}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500 transition-colors whitespace-nowrap"
          >
            ⚑ Wake Prompt
          </button>
        </div>
      </div>

      {/* Body: doc sidebar + main pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document sidebar */}
        <DocSidebar
          documents={documents}
          selectedKey={selectedDocKey}
          onSelect={handleSelectDoc}
          projectSlug={project.slug}
        />

        {/* Main pane */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {mainView === 'document' && selectedDoc ? (
            <DocEditor
              doc={selectedDoc}
              projectSlug={project.slug}
              onSaved={handleDocSaved}
              onBack={() => setMainView('console')}
            />
          ) : (
            /* Console view: chat + polls */
            <>
              <ChatPanel
                projectSlug={project.slug}
                username={username ?? 'Anonymous'}
                messages={chatMessages}
                setMessages={setChatMessages}
              />
              <PollsPanel
                projectSlug={project.slug}
                username={username ?? 'Anonymous'}
                polls={polls}
                onRefresh={fetchPolls}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
