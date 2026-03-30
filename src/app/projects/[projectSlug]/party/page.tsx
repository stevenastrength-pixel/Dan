'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface CharacterSheet {
  id: string; characterName: string; className: string; race: string
  level: number; maxHP: number; currentHP: number; AC: number
}

interface PartyMember {
  id: number; username: string; role: 'dm' | 'player'
  characterSheetId?: string; characterSheet?: CharacterSheet | null
  joinedAt: string
}

function mod(score: number) { return Math.floor((score - 10) / 2) }
function fmtMod(n: number) { return n >= 0 ? `+${n}` : `${n}` }

export default function PartyPage() {
  const params = useParams()
  const slug = params.projectSlug as string

  const [members, setMembers] = useState<PartyMember[]>([])
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myMember, setMyMember] = useState<PartyMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  const load = useCallback(async () => {
    const [membersRes, meRes] = await Promise.all([
      fetch(`/api/projects/${slug}/party`),
      fetch('/api/auth/me'),
    ])
    if (membersRes.ok) {
      const data: PartyMember[] = await membersRes.json()
      setMembers(data)
      if (meRes.ok) {
        const me = await meRes.json()
        setCurrentUser(me.username)
        setIsAdmin(me.role === 'admin')
        setMyMember(data.find(m => m.username.toLowerCase() === me.username.toLowerCase()) ?? null)
      }
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { load() }, [load])

  const joinParty = async (role: 'dm' | 'player') => {
    setJoining(true)
    const res = await fetch(`/api/projects/${slug}/party`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) await load()
    setJoining(false)
  }

  const leaveParty = async () => {
    await fetch(`/api/projects/${slug}/party`, { method: 'DELETE' })
    await load()
  }

  const setRole = async (username: string, role: 'dm' | 'player') => {
    await fetch(`/api/projects/${slug}/party`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, role }),
    })
    await load()
  }

  const removeMember = async (username: string) => {
    await fetch(`/api/projects/${slug}/party`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })
    await load()
  }

  const dm = members.find(m => m.role === 'dm')
  const players = members.filter(m => m.role === 'player')
  const isDm = myMember?.role === 'dm'
  const canManage = isDm || isAdmin

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-slate-950"><p className="text-slate-500 text-sm">Loading…</p></div>
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="px-6 h-16 border-b border-slate-800/60 shrink-0 flex items-center gap-4">
        <h1 className="text-sm font-semibold text-slate-200">Party</h1>
        <span className="text-xs text-slate-600">{members.length} member{members.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto flex items-center gap-2">
          {!myMember && currentUser && (
            <>
              <button onClick={() => joinParty('player')} disabled={joining}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
                Join as Player
              </button>
              {!dm && (
                <button onClick={() => joinParty('dm')} disabled={joining}
                  className="px-3 py-1.5 border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
                  Join as DM
                </button>
              )}
            </>
          )}
          {myMember && (
            <button onClick={leaveParty}
              className="px-3 py-1.5 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40 text-xs font-medium rounded-lg transition-colors">
              Leave Party
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-2xl">

        {/* DM slot */}
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Dungeon Master</h2>
          {dm ? (
            <MemberCard member={dm} isMe={dm.username === currentUser} isDm={isDm} canManage={canManage} slug={slug}
              currentUser={currentUser} onRoleChange={setRole} onRemove={removeMember} />
          ) : (
            <div className="bg-slate-800/30 border border-dashed border-slate-700/60 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-600">No DM yet</p>
              {!myMember && currentUser && (
                <button onClick={() => joinParty('dm')} disabled={joining}
                  className="mt-3 px-4 py-1.5 border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
                  Claim DM seat
                </button>
              )}
            </div>
          )}
        </div>

        {/* Players */}
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Players — {players.length}
          </h2>
          <div className="space-y-3">
            {players.map(m => (
              <MemberCard key={m.username} member={m} isMe={m.username === currentUser}
                isDm={isDm} canManage={canManage} slug={slug} currentUser={currentUser} onRoleChange={setRole} onRemove={removeMember} />
            ))}
            {players.length === 0 && (
              <p className="text-sm text-slate-600 italic">No players yet. Share an invite link to get people in.</p>
            )}
          </div>
        </div>

        {/* My sheet shortcut */}
        {myMember && (
          <div className="border-t border-slate-800/60 pt-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Your Character</h2>
            {myMember.characterSheet ? (
              <div className="flex items-center justify-between bg-slate-800/40 rounded-xl p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-200">{myMember.characterSheet.characterName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {myMember.characterSheet.race} {myMember.characterSheet.className} · Level {myMember.characterSheet.level}
                  </p>
                </div>
                <Link href={`/projects/${slug}/sheet`}
                  className="px-3 py-1.5 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-xs font-medium rounded-lg transition-colors">
                  Edit Sheet
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-slate-800/30 border border-dashed border-slate-700/60 rounded-xl p-4">
                <p className="text-sm text-slate-600">You haven&apos;t filled out your character sheet yet.</p>
                <Link href={`/projects/${slug}/sheet`}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors">
                  Create Sheet
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({ member, isMe, isDm, canManage, slug, currentUser, onRoleChange, onRemove }: {
  member: PartyMember
  isMe: boolean
  currentUser: string | null
  isDm: boolean
  canManage: boolean
  slug: string
  onRoleChange: (username: string, role: 'dm' | 'player') => void
  onRemove: (username: string) => void
}) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const actuallyMe = isMe || (!!currentUser && member.username.toLowerCase() === currentUser.toLowerCase())
  const sheet = member.characterSheet
  const hp = sheet ? `${sheet.currentHP}/${sheet.maxHP} HP` : null

  return (
    <div className={`flex items-center gap-4 bg-slate-800/40 rounded-xl p-4 border transition-colors ${actuallyMe ? 'border-emerald-500/20' : 'border-transparent'}`}>
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
        member.role === 'dm' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' : 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400'
      }`}>
        {member.username[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">@{member.username}</span>
          {actuallyMe && <span className="text-[10px] text-emerald-500 font-semibold">(you)</span>}
          {member.role === 'dm' && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">DM</span>}
        </div>
        {sheet ? (
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {sheet.characterName} · {sheet.race} {sheet.className} Lv.{sheet.level} · AC {sheet.AC} · {hp}
          </p>
        ) : (
          <p className="text-xs text-slate-600 mt-0.5 italic">No character sheet</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {actuallyMe && !sheet && (
          <Link href={`/projects/${slug}/sheet`}
            className="px-2.5 py-1 text-xs text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors">
            Add Sheet
          </Link>
        )}
        {actuallyMe && sheet && (
          <Link href={`/projects/${slug}/sheet`}
            className="px-2.5 py-1 text-xs text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-700/40 transition-colors">
            Edit Sheet
          </Link>
        )}
        {isDm && !actuallyMe && member.role !== 'dm' && (
          <button onClick={() => onRoleChange(member.username, 'dm')}
            className="px-2.5 py-1 text-xs text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors">
            Make DM
          </button>
        )}
        {isDm && !actuallyMe && member.role === 'dm' && (
          <button onClick={() => onRoleChange(member.username, 'player')}
            className="px-2.5 py-1 text-xs text-slate-400 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors">
            → Player
          </button>
        )}
        {canManage && !actuallyMe && (
          confirmRemove ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onRemove(member.username)}
                className="px-2.5 py-1 text-xs text-red-400 border border-red-500/40 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors">
                Confirm
              </button>
              <button onClick={() => setConfirmRemove(false)}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmRemove(true)}
              className="px-2.5 py-1 text-xs text-slate-500 border border-slate-700/60 rounded-lg hover:text-red-400 hover:border-red-500/30 transition-colors">
              Remove
            </button>
          )
        )}
      </div>
    </div>
  )
}
