'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Poll = {
  id: number
  question: string
  options: string[]
  createdBy: string
  status: 'OPEN' | 'CLOSED'
  createdAt: string
  votes: Array<{ voterName: string; optionIdx: number }>
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
      <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-slate-900 text-sm">Poll Control</h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
        >
          {showCreate ? 'Cancel' : '+ New Poll'}
        </button>
      </div>

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
            <button onClick={() => setOptions([...options, ''])} className="text-indigo-600 text-xs hover:underline">
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
          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${isOpen ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
            {isOpen ? 'OPEN' : 'CLOSED'}
          </span>
          <p className="text-sm font-semibold text-slate-900">{poll.question}</p>
          <p className="text-xs text-slate-400 mt-0.5">by {poll.createdBy} · {totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
        </div>
        {isOpen && (
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-red-500 whitespace-nowrap shrink-0">
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
                isMyVote ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                : isWinning ? 'border-green-300 bg-green-50 text-green-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              } ${!isOpen ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div
                className={`absolute inset-y-0 left-0 transition-all rounded-lg ${isMyVote ? 'bg-indigo-100' : isWinning ? 'bg-green-100' : 'bg-slate-100'}`}
                style={{ width: `${pct}%`, opacity: 0.6 }}
              />
              <div className="relative flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {isMyVote && <span className="text-indigo-600">✓</span>}
                  {opt}
                </span>
                <span className="text-xs text-slate-500 shrink-0">{count} {pct > 0 ? `(${pct}%)` : ''}</span>
              </div>
            </button>
          )
        })}
      </div>
      {poll.votes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {poll.votes.map((v) => (
            <span key={v.voterName} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
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
    const stored = localStorage.getItem('dan-username')
    if (stored) setUsername(stored)
  }, [])

  if (!mounted) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <h1 className="text-xl font-bold text-slate-900">Daneel Control Room</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          AI project coordinator · Poll management · Team coordination
          {username && <span className="ml-2 text-indigo-600 font-medium">— {username}</span>}
        </p>
      </div>

      {/* Polls panel fills the right column */}
      <div className="flex-1 overflow-hidden">
        {username ? (
          <PollControlPanel username={username} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-300 text-sm p-8">
            Enter your name in the chat panel to get started.
          </div>
        )}
      </div>
    </div>
  )
}
