'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number
  type: 'narration' | 'combat' | 'loot' | 'skill' | 'death' | 'dialogue' | 'system' | 'levelup'
  content: string
  speakerName: string
  createdAt: string
}

interface RunPlayer {
  id: number
  username: string
  characterName: string
  currentHP: number
  maxHP: number
  tempHP: number
  level: number
  xp: number
  conditions: string
  spellSlots: string
  deathState: string
  initiative: number
}

interface RunCombatant {
  id: number
  name: string
  type: string
  initiative: number
  sortOrder: number
  currentHP: number
  maxHP: number
  AC: number
  conditions: string
  isDefeated: boolean
}

interface PlayRun {
  id: number
  name: string
  state: string
  currentLocationId: number | null
  currentKeyedAreaId: number | null
  inCombat: boolean
  roundNumber: number
  players: RunPlayer[]
  combatants: RunCombatant[]
  log: LogEntry[]
}

// ─── Log Entry component ──────────────────────────────────────────────────────

function LogLine({ entry }: { entry: LogEntry }) {
  const base = 'text-sm leading-relaxed'
  if (entry.type === 'narration' && entry.speakerName === 'Daneel') {
    return <p className={`${base} text-slate-200 italic`}>{entry.content}</p>
  }
  if (entry.type === 'narration') {
    return <p className={`${base} text-slate-200`}>{entry.content}</p>
  }
  if (entry.type === 'dialogue') {
    return (
      <p className={`${base} text-amber-300`}>
        <span className="font-semibold not-italic">{entry.speakerName}: </span>
        <span className="italic">"{entry.content}"</span>
      </p>
    )
  }
  if (entry.type === 'combat') {
    return <p className={`${base} text-red-300`}><span className="mr-1">⚔</span>{entry.content}</p>
  }
  if (entry.type === 'loot') {
    return <p className={`${base} text-emerald-300`}><span className="mr-1">💰</span>{entry.content}</p>
  }
  if (entry.type === 'skill') {
    return <p className={`${base} text-sky-300`}><span className="mr-1">🎲</span>{entry.content}</p>
  }
  if (entry.type === 'death') {
    return <p className={`${base} text-red-400 font-semibold`}><span className="mr-1">💀</span>{entry.speakerName}: {entry.content}</p>
  }
  if (entry.type === 'system') {
    if (entry.speakerName && entry.speakerName !== 'Daneel') {
      return (
        <p className={`${base} text-slate-300`}>
          <span className="font-semibold text-violet-300">{entry.speakerName}: </span>
          {entry.content}
        </p>
      )
    }
    return <p className={`${base} text-slate-500 text-xs italic`}>{entry.content}</p>
  }
  return <p className={`${base} text-slate-400`}>{entry.content}</p>
}

// ─── Player Card ──────────────────────────────────────────────────────────────

function PlayerCard({ player, isCurrentUser }: { player: RunPlayer; isCurrentUser: boolean }) {
  const hpPct = player.maxHP > 0 ? Math.max(0, Math.min(100, (player.currentHP / player.maxHP) * 100)) : 0
  const hpColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500'
  let conditions: string[] = []
  try { conditions = JSON.parse(player.conditions) } catch {}

  return (
    <div className={`rounded-xl border p-3 ${isCurrentUser ? 'border-violet-500/50 bg-violet-900/10' : 'border-slate-700/40 bg-slate-800/40'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-slate-200">{player.characterName}</span>
        <span className="text-[10px] text-slate-500">{player.username}</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${hpColor} rounded-full transition-all`} style={{ width: `${hpPct}%` }} />
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{player.currentHP}/{player.maxHP}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span>Lv {player.level}</span>
        <span>{player.xp} XP</span>
        {player.deathState !== 'alive' && <span className="text-red-400 font-bold uppercase">{player.deathState}</span>}
      </div>
      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {conditions.map(c => <span key={c} className="text-[9px] bg-amber-900/40 text-amber-300 border border-amber-700/30 rounded px-1">{c}</span>)}
        </div>
      )}
    </div>
  )
}

// ─── Combatant Row ────────────────────────────────────────────────────────────

function CombatantRow({ c }: { c: RunCombatant }) {
  const pct = c.maxHP > 0 ? Math.max(0, Math.min(100, (c.currentHP / c.maxHP) * 100)) : 0
  const color = c.type === 'monster' ? 'bg-red-500' : 'bg-emerald-500'
  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${c.isDefeated ? 'opacity-40' : ''} bg-slate-800/40`}>
      <span className="text-xs w-5 text-center text-slate-500">{c.initiative}</span>
      <span className="flex-1 text-xs text-slate-200 truncate">{c.name}</span>
      <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 tabular-nums w-12 text-right">{c.currentHP}/{c.maxHP}</span>
    </div>
  )
}

// ─── Death Modal ──────────────────────────────────────────────────────────────

function DeathModal({ playerName, onChoice }: { playerName: string; onChoice: (choice: 'carry_on' | 'respawn' | 'true_death') => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-red-800/60 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="text-4xl mb-3">💀</div>
        <h2 className="text-lg font-bold text-red-300 mb-1">{playerName} has fallen.</h2>
        <p className="text-sm text-slate-400 mb-6">What would you like to do?</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => onChoice('carry_on')}
            className="w-full py-3 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors text-sm">
            <div className="font-semibold">Carry On</div>
            <div className="text-xs text-slate-500 mt-0.5">Continue as a ghost — your allies can revive you</div>
          </button>
          <button onClick={() => onChoice('respawn')}
            className="w-full py-3 rounded-xl border border-amber-600/40 text-amber-300 hover:bg-amber-900/20 transition-colors text-sm">
            <div className="font-semibold">Respawn</div>
            <div className="text-xs text-amber-500/70 mt-0.5">Restart at last rest point — lose XP since last rest, keep gear</div>
          </button>
          <button onClick={() => onChoice('true_death')}
            className="w-full py-3 rounded-xl border border-red-700/40 text-red-300 hover:bg-red-900/20 transition-colors text-sm">
            <div className="font-semibold">True Death</div>
            <div className="text-xs text-red-500/70 mt-0.5">Character is gone — roll a new one and rejoin</div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Join screen ──────────────────────────────────────────────────────────────

function JoinScreen({ slug, onJoined }: { slug: string; onJoined: (run: PlayRun) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const join = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${slug}/play-run`, { method: 'POST' })
      const text = await res.text()
      if (!res.ok) {
        let msg = 'Failed to join.'
        try { msg = JSON.parse(text).error ?? msg } catch {}
        setError(msg)
        setLoading(false)
        return
      }
      onJoined(JSON.parse(text))
    } catch (e) {
      setError(`Server error: ${e instanceof Error ? e.message : String(e)}`)
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 gap-6 px-8 text-center">
      <div className="text-5xl">▶</div>
      <div>
        <h1 className="text-xl font-bold text-slate-200 mb-2">AI Dungeon Crawler</h1>
        <p className="text-sm text-slate-500 max-w-md">
          Daneel will DM the campaign for you and your party. Your character sheet stats carry over automatically.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-col gap-3 items-center">
        <button onClick={join} disabled={loading}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm">
          {loading ? 'Joining…' : 'Enter the Adventure'}
        </button>
        <div className="flex gap-3">
          <Link href={`/projects/${slug}/party`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Set up party first →</Link>
          <Link href={`/projects/${slug}/sheet`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Character sheet →</Link>
        </div>
      </div>
    </div>
  )
}

// ─── Main crawler ─────────────────────────────────────────────────────────────

export default function PlayPage() {
  const params = useParams()
  const slug = params.projectSlug as string

  const [run, setRun] = useState<PlayRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [joined, setJoined] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUser, setCurrentUser] = useState<string>('')
  const [deathModal, setDeathModal] = useState<{ playerId: number; playerName: string } | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(u => { if (u) setCurrentUser(u.username) })
  }, [])

  const fetchRun = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}/play-run`)
    if (res.ok) {
      const data = await res.json()
      if (data) { setRun(data); setJoined(true) }
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { fetchRun() }, [fetchRun])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [run?.log.length])

  // Watch for player death
  useEffect(() => {
    if (!run || !currentUser) return
    const me = run.players.find(p => p.username === currentUser)
    if (me && me.deathState === 'unconscious' && !deathModal) {
      setDeathModal({ playerId: me.id, playerName: me.characterName })
    }
  }, [run, currentUser, deathModal])

  const handleJoined = (newRun: PlayRun) => {
    setRun(newRun)
    setJoined(true)
  }

  const sendAction = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    // Optimistic: add player message to log immediately
    const tempEntry: LogEntry = {
      id: Date.now(),
      type: 'system',
      content: text,
      speakerName: run?.players.find(p => p.username === currentUser)?.characterName ?? currentUser,
      createdAt: new Date().toISOString(),
    }
    setRun(prev => prev ? { ...prev, log: [...prev.log, tempEntry] } : prev)

    try {
      const res = await fetch(`/api/projects/${slug}/play-run/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const resText = await res.text()
      if (res.ok && resText) {
        try { setRun(JSON.parse(resText)) } catch {}
      }
    } catch {}
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendAction()
    }
  }

  const handleDeathChoice = async (choice: 'carry_on' | 'respawn' | 'true_death') => {
    if (!deathModal) return
    setDeathModal(null)
    // Update player death state
    await fetch(`/api/projects/${slug}/play-run/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[Death choice: ${choice.replace('_', ' ')}]` }),
    }).then(r => r.ok ? r.json() : null).then(updated => { if (updated) setRun(updated) })
  }

  const wipeRun = async () => {
    if (!confirm('Are you sure you want to wipe this run? All progress will be lost.')) return
    await fetch(`/api/projects/${slug}/play-run`, { method: 'DELETE' })
    setRun(null)
    setJoined(false)
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500 text-sm">Loading…</div>
  }

  if (!joined || !run) {
    return <JoinScreen slug={slug} onJoined={handleJoined} />
  }

  const me = run.players.find(p => p.username === currentUser)
  const sortedCombatants = [...run.combatants].sort((a, b) => b.initiative - a.initiative)

  return (
    <div className="flex-1 flex min-h-0 bg-slate-950 overflow-hidden">
      {deathModal && <DeathModal playerName={deathModal.playerName} onChoice={handleDeathChoice} />}

      {/* ── Right panel: Party + Combat ───────────────────────────────── */}
      <div className="w-56 shrink-0 border-l border-slate-800/60 flex flex-col min-h-0 hidden lg:flex">
        <div className="px-3 py-3 border-b border-slate-800/60">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Party</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {run.players.map(p => (
            <PlayerCard key={p.id} player={p} isCurrentUser={p.username === currentUser} />
          ))}
        </div>

        {run.inCombat && sortedCombatants.length > 0 && (
          <>
            <div className="px-3 py-2 border-t border-slate-800/60">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Combat — Round {run.roundNumber}</h3>
            </div>
            <div className="p-2 space-y-1 border-t border-slate-800/40 max-h-48 overflow-y-auto">
              {sortedCombatants.map(c => <CombatantRow key={c.id} c={c} />)}
            </div>
          </>
        )}

        <div className="p-3 border-t border-slate-800/60">
          <button onClick={wipeRun} className="w-full text-[10px] text-slate-600 hover:text-red-400 transition-colors">Wipe Run</button>
        </div>
      </div>

      {/* ── Center: Narrative log + input ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="px-4 h-12 border-b border-slate-800/60 shrink-0 flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-200 truncate">{run.name}</span>
          {run.inCombat && (
            <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">
              Combat · Round {run.roundNumber}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {me && (
              <span className="text-[10px] text-slate-500">{me.characterName} · {me.currentHP}/{me.maxHP} HP</span>
            )}
          </div>
        </div>

        {/* Log */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {run.log.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
              <p className="text-sm text-slate-600">The adventure begins…</p>
              <p className="text-xs text-slate-700">Type an action below to start. Try "I look around the room" or "We head north."</p>
            </div>
          ) : (
            run.log.map(entry => <LogLine key={entry.id} entry={entry} />)
          )}
          {sending && (
            <p className="text-xs text-slate-600 italic animate-pulse">Daneel is thinking…</p>
          )}
          <div ref={logEndRef} />
        </div>

        {/* Quick actions when in combat */}
        {run.inCombat && (
          <div className="px-4 py-2 border-t border-slate-800/40 flex flex-wrap gap-1.5">
            {['I attack!', 'I cast a spell', 'I dash', 'I hide', 'I help an ally', 'I disengage'].map(action => (
              <button key={action} onClick={() => { setInput(action); inputRef.current?.focus() }}
                className="text-[10px] px-2 py-1 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors">
                {action}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800/60 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={run.inCombat ? 'Declare your action…' : 'What do you do?'}
              rows={2}
              className="flex-1 resize-none bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 transition-colors"
              disabled={sending}
            />
            <button onClick={sendAction} disabled={sending || !input.trim()}
              className="h-10 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors">
              →
            </button>
          </div>
          <p className="text-[10px] text-slate-700 mt-1">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}
