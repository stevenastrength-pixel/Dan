'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AIChatMessage = {
  role: 'user' | 'assistant'
  content: string
  author?: string
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

// ─── Username Modal ───────────────────────────────────────────────────────────

function UsernameModal({ onSave }: { onSave: (name: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Who are you?</h2>
        <p className="text-sm text-slate-500 mb-4">Enter your name to get started. This is saved in your browser.</p>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && val.trim() && onSave(val.trim())}
          placeholder="Your name"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
        />
        <button
          disabled={!val.trim()}
          onClick={() => onSave(val.trim())}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ─── AI Chat Panel ─────────────────────────────────────────────────────────────

function AIChatPanel({ username }: { username: string }) {
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: AIChatMessage = { role: 'user', content: text, author: username }
    const next = [...messages, userMsg]
    setMessages(next)
    setStreaming(true)

    const assistantMsg: AIChatMessage = { role: 'assistant', content: '' }
    setMessages([...next, assistantMsg])

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${data.error}` }
          return updated
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
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: updated[updated.length - 1].content + parsed.text,
                }
                return updated
              })
            }
            if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: `Error: ${parsed.error}`,
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Connection error.' }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-12">
            <p className="text-2xl mb-2">⬡</p>
            <p className="text-sm">Daneel is standing by.</p>
            <p className="text-xs mt-1 text-slate-300">Ask anything about the project.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {msg.role === 'user' && msg.author && (
                <p className="text-indigo-200 text-xs mb-1 font-medium">{msg.author}</p>
              )}
              {msg.role === 'assistant' && (
                <p className="text-slate-400 text-xs mb-1 font-medium">Daneel</p>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && msg.content === '' && (
                <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse rounded" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-slate-200">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Message Daneel…"
            disabled={streaming}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
          >
            {streaming ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Poll Control Panel ────────────────────────────────────────────────────────

function PollControlPanel({ username }: { username: string }) {
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [creating, setCreating] = useState(false)
  const [closedOpen, setClosedOpen] = useState(false)

  const fetchPolls = useCallback(async () => {
    const res = await fetch('/api/polls')
    const data = await res.json()
    setPolls(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPolls()
    const interval = setInterval(fetchPolls, 10000)
    return () => clearInterval(interval)
  }, [fetchPolls])

  const createPoll = async () => {
    const validOptions = options.filter((o) => o.trim())
    if (!question.trim() || validOptions.length < 2) return
    setCreating(true)
    await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), options: validOptions, createdBy: username }),
    })
    setQuestion('')
    setOptions(['', ''])
    setShowCreate(false)
    setCreating(false)
    fetchPolls()
  }

  const vote = async (pollId: number, optionIdx: number) => {
    await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterName: username, optionIdx }),
    })
    fetchPolls()
  }

  const closePoll = async (pollId: number) => {
    await fetch(`/api/polls/${pollId}/close`, { method: 'POST' })
    fetchPolls()
  }

  const openPolls = polls.filter((p) => p.status === 'OPEN')
  const closedPolls = polls.filter((p) => p.status === 'CLOSED')

  if (loading) return <div className="p-6 text-slate-400 text-sm">Loading polls…</div>

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-slate-900 text-sm">Poll Control</h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
        >
          {showCreate ? 'Cancel' : '+ New Poll'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Question</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What should happen next?"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
          />
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Options</label>
          <div className="space-y-2 mb-3">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...options]
                    next[i] = e.target.value
                    setOptions(next)
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-red-500 text-sm px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setOptions([...options, ''])}
              className="text-indigo-600 text-xs hover:underline"
            >
              + Add option
            </button>
            <div className="flex-1" />
            <button
              onClick={createPoll}
              disabled={creating || !question.trim() || options.filter((o) => o.trim()).length < 2}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
            >
              {creating ? 'Creating…' : 'Create Poll'}
            </button>
          </div>
        </div>
      )}

      {/* Open polls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {openPolls.length === 0 && !showCreate && (
          <p className="text-sm text-slate-400 text-center mt-8">No open polls. Create one to get started.</p>
        )}

        {openPolls.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            username={username}
            onVote={(idx) => vote(poll.id, idx)}
            onClose={() => closePoll(poll.id)}
          />
        ))}

        {/* Closed polls */}
        {closedPolls.length > 0 && (
          <div>
            <button
              onClick={() => setClosedOpen((v) => !v)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 mb-2 w-full"
            >
              <span>{closedOpen ? '▼' : '▶'}</span>
              <span className="font-medium uppercase tracking-wide">Closed Polls ({closedPolls.length})</span>
            </button>
            {closedOpen && (
              <div className="space-y-4">
                {closedPolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} username={username} onVote={() => {}} onClose={() => {}} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

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
  const isOpen = poll.status === 'OPEN'

  const tallies = poll.options.map((_, i) => poll.votes.filter((v) => v.optionIdx === i).length)

  return (
    <div className={`rounded-xl border p-4 ${isOpen ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-75'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${
              isOpen ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {isOpen ? 'OPEN' : 'CLOSED'}
          </span>
          <p className="text-sm font-semibold text-slate-900">{poll.question}</p>
          <p className="text-xs text-slate-400 mt-0.5">by {poll.createdBy} · {totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
        </div>
        {isOpen && (
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-red-500 whitespace-nowrap shrink-0"
          >
            Close
          </button>
        )}
      </div>

      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const count = tallies[i]
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isMyVote = myVote?.optionIdx === i
          const isWinning = !isOpen && tallies[i] === Math.max(...tallies) && totalVotes > 0

          return (
            <button
              key={i}
              onClick={() => isOpen && onVote(i)}
              disabled={!isOpen}
              className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors relative overflow-hidden ${
                isMyVote
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                  : isWinning
                  ? 'border-green-300 bg-green-50 text-green-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              } ${!isOpen ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {/* Progress bar */}
              <div
                className={`absolute inset-y-0 left-0 transition-all rounded-lg ${
                  isMyVote ? 'bg-indigo-100' : isWinning ? 'bg-green-100' : 'bg-slate-100'
                }`}
                style={{ width: `${pct}%`, opacity: 0.6 }}
              />
              <div className="relative flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {isMyVote && <span className="text-indigo-600">✓</span>}
                  {opt}
                </span>
                <span className="text-xs text-slate-500 shrink-0">
                  {count} {pct > 0 ? `(${pct}%)` : ''}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Voter list */}
      {poll.votes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {poll.votes.map((v) => (
            <span
              key={v.voterName}
              className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full"
            >
              {v.voterName} → {poll.options[v.optionIdx] ?? '?'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const [username, setUsername] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('novel-username')
    if (stored) setUsername(stored)
  }, [])

  const saveUsername = (name: string) => {
    localStorage.setItem('novel-username', name)
    setUsername(name)
  }

  if (!mounted) return null

  return (
    <div className="flex flex-col h-full">
      {!username && <UsernameModal onSave={saveUsername} />}

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <h1 className="text-xl font-bold text-slate-900">Daneel Control Room</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          AI project coordinator · Poll management · Team coordination
          {username && <span className="ml-2 text-indigo-600 font-medium">— {username}</span>}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: AI Chat */}
        <div className="flex flex-col w-1/2 border-r border-slate-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 shrink-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chat with Daneel</p>
          </div>
          {username ? (
            <div className="flex-1 overflow-hidden">
              <AIChatPanel username={username} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">
              Enter your name to start chatting
            </div>
          )}
        </div>

        {/* Right: Poll Control */}
        <div className="flex flex-col w-1/2 overflow-hidden">
          {username ? (
            <PollControlPanel username={username} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">
              Enter your name to vote
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
