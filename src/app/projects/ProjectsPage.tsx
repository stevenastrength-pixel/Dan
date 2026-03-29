'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Project = {
  id: number
  name: string
  slug: string
  description: string
  type: string
  minLevel?: number | null
  maxLevel?: number | null
  partySize?: number | null
  levelingMode?: string | null
  createdAt: string
  _count: { chapters: number; sessions: number; polls: number; tasks: number }
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

type MenuState =
  | { type: 'none' }
  | { type: 'menu'; projectId: number }
  | { type: 'rename'; projectId: number; name: string }
  | { type: 'delete'; projectId: number; confirmText: string }

export default function ProjectsPage({ projectType }: { projectType: 'novel' | 'campaign' }) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [menu, setMenu] = useState<MenuState>({ type: 'none' })
  const [actionBusy, setActionBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Novel form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Campaign form fields
  const [premise, setPremise] = useState('')
  const [setting, setSetting] = useState('')
  const [minLevel, setMinLevel] = useState(1)
  const [maxLevel, setMaxLevel] = useState(10)
  const [partySize, setPartySize] = useState(4)
  const [levelingMode, setLevelingMode] = useState<'milestone' | 'xp'>('milestone')
  const [tones, setTones] = useState<string[]>([])

  const isCampaign = projectType === 'campaign'

  useEffect(() => {
    fetch(`/api/projects?type=${projectType}`)
      .then((r) => r.json())
      .then((data) => { setProjects(data); setLoading(false) })
  }, [projectType])

  useEffect(() => {
    if (menu.type === 'none') return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu({ type: 'none' })
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu.type])

  const TONE_OPTIONS = ['Dark', 'Heroic', 'Comedic', 'Mystery', 'Horror', 'Sandbox', 'Political', 'Intrigue']
  const LEVEL_PRESETS = [
    { label: '1–5 (Tier 1)', min: 1, max: 5 },
    { label: '1–10 (Tier 1–2)', min: 1, max: 10 },
    { label: '1–16 (Tier 1–3)', min: 1, max: 16 },
    { label: '1–20 (Full)', min: 1, max: 20 },
  ]

  const toggleTone = (t: string) =>
    setTones(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    setError('')
    const body: Record<string, unknown> = {
      name: name.trim(),
      description: isCampaign
        ? (tones.length ? `Tone: ${tones.join(', ')}` : '')
        : description.trim(),
      type: projectType,
    }
    if (isCampaign) {
      body.premise = premise.trim()
      body.setting = setting.trim()
      body.minLevel = minLevel
      body.maxLevel = maxLevel
      body.partySize = partySize
      body.levelingMode = levelingMode
    }
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setCreating(false)
      return
    }
    const project: Project = await res.json()
    router.push(`/projects/${project.slug}/agent`)
  }

  const renameProject = async (slug: string, newName: string) => {
    if (!newName.trim()) return
    setActionBusy(true)
    await fetch(`/api/projects/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await fetch(`/api/projects?type=${projectType}`).then((r) => r.json())
    setProjects(data)
    setMenu({ type: 'none' })
    setActionBusy(false)
  }

  const deleteProject = async (slug: string) => {
    setActionBusy(true)
    await fetch(`/api/projects/${slug}`, { method: 'DELETE' })
    setProjects((prev) => prev.filter((p) => p.slug !== slug))
    setMenu({ type: 'none' })
    setActionBusy(false)
  }

  if (loading) return <div className="p-8 text-slate-600 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-200">
            {isCampaign ? 'Campaigns' : 'Novels'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {isCampaign
              ? 'Your collaborative campaign books.'
              : 'Your collaborative novel projects.'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
        >
          {showCreate ? 'Cancel' : isCampaign ? '+ New Campaign' : '+ New Novel'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            {isCampaign ? 'New Campaign' : 'New Novel'}
          </h2>
          <div className="space-y-4">
            {/* Name — both types */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {isCampaign ? 'Campaign Name' : 'Project Name'} <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isCampaign && create()}
                placeholder={isCampaign ? 'Curse of the Iron Crown' : 'My Novel'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {isCampaign ? (
              <>
                {/* Premise */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Premise</label>
                  <textarea
                    value={premise}
                    onChange={(e) => setPremise(e.target.value)}
                    rows={2}
                    placeholder="A one or two sentence hook — what draws the party in, what's at stake."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                  />
                </div>

                {/* Setting */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Setting Name</label>
                  <input
                    value={setting}
                    onChange={(e) => setSetting(e.target.value)}
                    placeholder="The Sunken Reaches, Barovia, The Shattered Isles…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                {/* Level range presets */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Level Range</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {LEVEL_PRESETS.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => { setMinLevel(p.min); setMaxLevel(p.max) }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                          minLevel === p.min && maxLevel === p.max
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Custom:</span>
                    <input type="number" min={1} max={20} value={minLevel} onChange={e => setMinLevel(+e.target.value)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
                    <span className="text-slate-600 text-xs">–</span>
                    <input type="number" min={1} max={20} value={maxLevel} onChange={e => setMaxLevel(+e.target.value)}
                      className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
                  </div>
                </div>

                {/* Party size + leveling */}
                <div className="flex gap-6">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Party Size</label>
                    <div className="flex gap-1">
                      {[3,4,5,6].map(n => (
                        <button key={n} type="button" onClick={() => setPartySize(n)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium border transition-colors ${
                            partySize === n
                              ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Leveling</label>
                    <div className="flex gap-1">
                      {(['milestone', 'xp'] as const).map(m => (
                        <button key={m} type="button" onClick={() => setLevelingMode(m)}
                          className={`px-3 h-9 rounded-lg text-xs font-medium border transition-colors capitalize ${
                            levelingMode === m
                              ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}>{m}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tone */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Tone (optional, multi-select)</label>
                  <div className="flex flex-wrap gap-2">
                    {TONE_OPTIONS.map(t => (
                      <button key={t} type="button" onClick={() => toggleTone(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          tones.includes(t)
                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short blurb about the project (optional)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end">
              <button
                onClick={create}
                disabled={creating || !name.trim()}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              >
                {creating ? 'Creating…' : isCampaign ? 'Create Campaign' : 'Create Novel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project list */}
      {projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3 text-slate-700">{isCampaign ? '⚔' : '◈'}</p>
          <p className="text-base font-medium text-slate-500">No {isCampaign ? 'campaigns' : 'novels'} yet</p>
          <p className="text-sm text-slate-600 mt-1">
            {isCampaign ? 'Create your first campaign to begin building.' : 'Create your first novel to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const isMenuOpen = menu.type !== 'none' && menu.projectId === project.id
            const isRenaming = menu.type === 'rename' && menu.projectId === project.id
            const isDeleting = menu.type === 'delete' && menu.projectId === project.id

            return (
              <div key={project.id} className="relative">
                <div className="flex items-stretch rounded-xl border border-slate-800/60 bg-slate-900/60 hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all group overflow-hidden">
                  <Link href={`/projects/${project.slug}/agent`} className="flex-1 min-w-0 p-5">
                    <h2 className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                      {project.name}
                    </h2>
                    {project.description && (
                      <p className="text-sm text-slate-500 mt-0.5">{project.description}</p>
                    )}
                    {isCampaign && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        Levels {project.minLevel}–{project.maxLevel} · {project.partySize} players · {project.levelingMode}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      {isCampaign ? (
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-slate-600 uppercase tracking-wide">Sessions</span>
                          <span className="text-sm font-semibold text-slate-500 tabular-nums">{project._count.sessions}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-slate-600 uppercase tracking-wide">Chapters</span>
                          <span className="text-sm font-semibold text-slate-500 tabular-nums">{project._count.chapters}</span>
                        </div>
                      )}
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-600 uppercase tracking-wide">Polls</span>
                        <span className={`text-sm font-semibold tabular-nums ${project._count.polls === 0 ? 'text-slate-600' : 'text-amber-400'}`}>
                          {project._count.polls}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-600 uppercase tracking-wide">Tasks</span>
                        <span className={`text-sm font-semibold tabular-nums ${project._count.tasks === 0 ? 'text-slate-600' : 'text-amber-400'}`}>
                          {project._count.tasks}
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1 pr-2 pl-3 shrink-0">
                    <button
                      onClick={(e) => {
                        e.preventDefault(); e.stopPropagation()
                        setMenu(isMenuOpen ? { type: 'none' } : { type: 'menu', projectId: project.id })
                      }}
                      className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
                      title="Project options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14M12 2v2M12 20v2M2 12h2M20 12h2"/>
                      </svg>
                    </button>
                    <Link
                      href={`/projects/${project.slug}/agent`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center w-8 h-8 rounded-md text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="Open project"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                    </Link>
                  </div>
                </div>

                {isMenuOpen && (
                  <div ref={menuRef} className="absolute top-10 right-3 z-20 w-52 rounded-xl border border-slate-700/60 bg-slate-900 shadow-xl p-2">
                    {!isRenaming && !isDeleting && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setMenu({ type: 'rename', projectId: project.id, name: project.name }) }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                          Rename
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setMenu({ type: 'delete', projectId: project.id, confirmText: '' }) }}
                          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
                          Delete…
                        </button>
                      </>
                    )}
                    {isRenaming && menu.type === 'rename' && (
                      <div className="p-1 space-y-2">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-1">Rename</p>
                        <input autoFocus value={menu.name}
                          onChange={(e) => setMenu({ ...menu, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') renameProject(project.slug, menu.name); if (e.key === 'Escape') setMenu({ type: 'none' }) }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                        <div className="flex gap-2">
                          <button onClick={() => renameProject(project.slug, menu.name)} disabled={actionBusy || !menu.name.trim()}
                            className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors">
                            {actionBusy ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setMenu({ type: 'none' })}
                            className="flex-1 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-600 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {isDeleting && menu.type === 'delete' && (
                      <div className="p-1 space-y-2">
                        <p className="text-xs text-slate-300 px-1 leading-snug">
                          Delete <span className="font-semibold text-white">{project.name}</span>? This cannot be undone.
                        </p>
                        <p className="text-[11px] text-slate-500 px-1">Type <span className="font-mono font-bold text-slate-300">DELETE</span> to confirm.</p>
                        <input autoFocus value={menu.confirmText}
                          onChange={(e) => setMenu({ ...menu, confirmText: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter' && menu.confirmText === 'DELETE') deleteProject(project.slug); if (e.key === 'Escape') setMenu({ type: 'none' }) }}
                          placeholder="DELETE"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/40" />
                        <div className="flex gap-2">
                          <button onClick={() => deleteProject(project.slug)} disabled={actionBusy || menu.confirmText !== 'DELETE'}
                            className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-500 disabled:opacity-40 transition-colors">
                            {actionBusy ? 'Deleting…' : 'Delete'}
                          </button>
                          <button onClick={() => setMenu({ type: 'none' })}
                            className="flex-1 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-600 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
