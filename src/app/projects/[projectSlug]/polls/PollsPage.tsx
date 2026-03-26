'use client'

import { useState, useEffect, useCallback } from 'react'

type Poll = {
  id: number; question: string; options: string[]; createdBy: string
  status: 'OPEN' | 'CLOSED'; createdAt: string
  votes: Array<{ voterName: string; optionIdx: number }>
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function PollCard({ poll, username, onVote, onClose, onDelete, onlineUsers, isAdmin }: {
  poll: Poll; username: string; onVote: (idx: number) => void; onClose: () => void; onDelete: () => void
  onlineUsers: string[]; isAdmin: boolean
}) {
  const myVote = poll.votes.find(v => v.voterName === username)
  const totalVotes = poll.votes.length
  const tallies = poll.options.map((_, i) => poll.votes.filter(v => v.optionIdx === i).length)
  const maxTally = Math.max(...tallies, 0)
  const isOpen = poll.status === 'OPEN'
  const voterNames = new Set(poll.votes.map(v => v.voterName))
  const waitingOn = onlineUsers.filter(u => !voterNames.has(u))
  const allVoted = waitingOn.length === 0 && onlineUsers.length > 0
  const canClose = allVoted || isAdmin

  return (
    <div className={`rounded-xl border p-4 ${isOpen
      ? 'border-slate-700/60 bg-slate-900/60'
      : 'border-slate-800/40 bg-slate-900/30 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded mb-1.5 ${isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/40 text-slate-500'}`}>
            {isOpen ? 'OPEN' : 'CLOSED'}
          </span>
          <p className="text-sm font-semibold text-slate-200 leading-snug">{poll.question}</p>
          <p className="text-xs text-slate-600 mt-0.5">{poll.createdBy} · {timeAgo(poll.createdAt)} · {totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button onClick={onDelete} title="Delete poll"
            className="text-slate-600 hover:text-red-400 transition-colors shrink-0 mt-0.5 text-sm">✕</button>
        )}
      </div>

      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const count = tallies[i]
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isMine = myVote?.optionIdx === i
          const isWinner = !isOpen && count === maxTally && totalVotes > 0
          return (
            <button key={i} onClick={() => isOpen && onVote(i)} disabled={!isOpen}
              className={`w-full text-left rounded-lg border px-3 py-2 text-sm relative overflow-hidden transition-colors ${
                isMine ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                  : isWinner ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : 'border-slate-700/60 bg-slate-900/60 text-slate-300 hover:border-slate-600'
              } ${isOpen ? 'cursor-pointer' : 'cursor-default'}`}>
              <div className={`absolute inset-y-0 left-0 opacity-20 rounded-l-lg ${isMine || isWinner ? 'bg-emerald-400' : 'bg-slate-500'}`}
                style={{ width: `${pct}%` }} />
              <div className="relative flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  {isMine && <span className="text-emerald-400 text-xs">✓</span>}
                  {isWinner && <span className="text-xs">🏆</span>}
                  {opt}
                </span>
                <span className="text-xs text-slate-600 shrink-0">{count}{pct > 0 ? ` (${pct}%)` : ''}</span>
              </div>
            </button>
          )
        })}
      </div>

      {poll.votes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {poll.votes.map(v => (
            <span key={v.voterName} className="text-xs bg-slate-800/60 text-slate-500 px-1.5 py-0.5 rounded-full">
              {v.voterName} → {poll.options[v.optionIdx] ?? '?'}
            </span>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-slate-800/60">
          {canClose ? (
            <button onClick={onClose}
              className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                allVoted ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40'
              }`}>
              {allVoted ? 'Complete Poll' : '⚠ Force Complete (override)'}
            </button>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Waiting for votes…</span>
              <span className="font-medium">{totalVotes}/{onlineUsers.length} voted</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PollsPage({ project }: { project: { name: string; slug: string } }) {
  const [username, setUsername] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [polls, setPolls] = useState<Poll[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [creating, setCreating] = useState(false)
  const [closedExpanded, setClosedExpanded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('dan-username')
    if (stored) setUsername(stored)
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.role === 'admin') setIsAdmin(true)
    })
  }, [])

  const fetchPolls = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.slug}/polls`)
    if (res.ok) setPolls(await res.json())
  }, [project.slug])

  useEffect(() => {
    fetchPolls()
    const interval = setInterval(fetchPolls, 10000)
    return () => clearInterval(interval)
  }, [fetchPolls])

  useEffect(() => {
    const fetchPresence = () => {
      fetch(`/api/projects/${project.slug}/presence`)
        .then(r => r.json()).then(d => setOnlineUsers(d.online ?? [])).catch(() => {})
    }
    fetchPresence()
    const interval = setInterval(fetchPresence, 5000)
    return () => clearInterval(interval)
  }, [project.slug])

  const broadcastRefresh = () => {
    const channel = new BroadcastChannel('dan-notifications')
    channel.postMessage('refresh')
    channel.close()
  }

  const buildSummary = (poll: Poll, extraVote?: { voterName: string; optionIdx: number }) => {
    const votes = extraVote ? [...poll.votes, extraVote] : poll.votes
    const tallies = poll.options.map((_, i) => votes.filter(v => v.optionIdx === i).length)
    const total = votes.length
    const maxTally = Math.max(...tallies, 0)
    const lines = poll.options.map((opt, i) => {
      const count = tallies[i]
      const pct = total > 0 ? Math.round((count / total) * 100) : 0
      return `• ${opt} — ${count} vote${count !== 1 ? 's' : ''}${pct > 0 ? ` (${pct}%)` : ''}${count === maxTally && total > 0 ? ' 🏆' : ''}`
    }).join('\n')
    return `📊 Poll closed: **"${poll.question}"**\n${lines}\n\n@Daneel the team has voted — acknowledge the result and factor it into the project if relevant.`
  }

  const vote = async (pollId: number, optionIdx: number) => {
    await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterName: username, optionIdx }),
    })
    broadcastRefresh()

    // Auto-close if everyone online has now voted
    const poll = polls.find(p => p.id === pollId)
    if (poll && onlineUsers.length > 0) {
      const votedNames = new Set([...poll.votes.map(v => v.voterName), username ?? ''])
      const allVoted = onlineUsers.every(u => votedNames.has(u))
      if (allVoted) {
        await fetch(`/api/polls/${pollId}/close`, { method: 'POST' })
        const summary = buildSummary(poll, { voterName: username ?? '', optionIdx })
        await fetch(`/api/projects/${project.slug}/messages`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: username ?? 'System', content: summary }),
        })
        broadcastRefresh()
      }
    }

    fetchPolls()
  }

  const closePoll = async (pollId: number) => {
    await fetch(`/api/polls/${pollId}/close`, { method: 'POST' })
    fetchPolls()
    broadcastRefresh()
    const poll = polls.find(p => p.id === pollId)
    if (!poll) return
    const summary = buildSummary(poll)
    await fetch(`/api/projects/${project.slug}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: username ?? 'System', content: summary }),
    })
  }

  const deletePoll = async (pollId: number) => {
    await fetch(`/api/polls/${pollId}`, { method: 'DELETE' })
    fetchPolls()
  }

  const createPoll = async () => {
    const valid = options.filter(o => o.trim())
    if (!question.trim() || valid.length < 2) return
    setCreating(true)
    await fetch(`/api/projects/${project.slug}/polls`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), options: valid, createdBy: username }),
    })
    setQuestion(''); setOptions(['', '']); setShowCreate(false); setCreating(false); fetchPolls()
  }

  const openPolls = polls.filter(p => p.status === 'OPEN')
  const closedPolls = polls.filter(p => p.status === 'CLOSED')

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-slate-200">{project.name}</h1>
          <p className="text-xs text-slate-600">Polls</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500 transition-colors">
          {showCreate ? 'Cancel' : '+ New Poll'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {showCreate && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">New Poll</p>
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Poll question…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 mb-3" />
            <div className="space-y-2 mb-3">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input value={opt} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n) }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                  {options.length > 2 && (
                    <button onClick={() => setOptions(options.filter((_, j) => j !== i))}
                      className="text-slate-600 hover:text-red-400 transition-colors">✕</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => setOptions([...options, ''])} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">+ Add option</button>
              <button onClick={createPoll} disabled={creating || !question.trim() || options.filter(o => o.trim()).length < 2}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors">
                {creating ? 'Creating…' : 'Create Poll'}
              </button>
            </div>
          </div>
        )}

        {openPolls.length === 0 && !showCreate && (
          <p className="text-sm text-slate-600 text-center py-12">No open polls. Create one or ask @Daneel to create one in chat.</p>
        )}

        <div className="space-y-3 mb-6">
          {openPolls.map(p => (
            <PollCard key={p.id} poll={p} username={username ?? ''} onVote={idx => vote(p.id, idx)}
              onClose={() => closePoll(p.id)} onDelete={() => deletePoll(p.id)}
              onlineUsers={onlineUsers} isAdmin={isAdmin} />
          ))}
        </div>

        {closedPolls.length > 0 && (
          <div>
            <button onClick={() => setClosedExpanded(v => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors mb-2">
              <span>{closedExpanded ? '▼' : '▶'}</span> Closed polls ({closedPolls.length})
            </button>
            {closedExpanded && (
              <div className="space-y-3">
                {closedPolls.map(p => (
                  <PollCard key={p.id} poll={p} username={username ?? ''} onVote={() => {}}
                    onClose={() => {}} onDelete={() => deletePoll(p.id)}
                    onlineUsers={[]} isAdmin={isAdmin} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
