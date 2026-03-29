'use client'

import { useState, useEffect, useCallback } from 'react'

type Quest = {
  id: number
  name: string
  description: string
  status: string
  questType: string
  rewardText: string
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = { main: 'Main', side: 'Side', faction: 'Faction', personal: 'Personal' }
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  resolved: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  abandoned: 'bg-red-500/20 text-red-400 border-red-500/30',
  'unknown-to-party': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}
const STATUS_NEXT: Record<string, string> = { active: 'resolved', resolved: 'abandoned', abandoned: 'active', 'unknown-to-party': 'active' }
const STATUS_LABEL: Record<string, string> = { active: 'Active', resolved: 'Resolved', abandoned: 'Abandoned', 'unknown-to-party': 'Hidden' }
const TYPE_ORDER = ['main', 'side', 'faction', 'personal']

const BLANK = { name: '', questType: 'main', status: 'unknown-to-party', description: '', rewardText: '' }

// ─── Slide-over form ──────────────────────────────────────────────────────────

function QuestForm({ initial, onSave, onClose, onDelete }: {
  initial: Partial<Quest> & { name: string; questType: string; status: string }
  onSave: (data: typeof BLANK) => Promise<void>
  onClose: () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...BLANK, ...initial })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (k: keyof typeof BLANK, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-100">{initial.id ? 'Edit Quest' : 'New Quest'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Find the Missing Merchant"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
              <select value={form.questType} onChange={e => set('questType', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4}
              placeholder="What do the players need to do? Why does it matter?"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Reward</label>
            <input value={form.rewardText} onChange={e => set('rewardText', e.target.value)} placeholder="200 gp, a deed to a small farmstead…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          {onDelete ? (
            confirmDelete ? (
              <div className="flex gap-2">
                <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white">Confirm delete</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 rounded text-slate-400 hover:text-slate-200">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Delete quest</button>
            )
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-slate-200">Cancel</button>
            <button onClick={save} disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QuestsPage({ project }: { project: { name: string; slug: string } }) {
  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Quest | null>(null)
  const [filter, setFilter] = useState('all')
  const [forming, setForming] = useState<Quest | 'new' | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/quests?projectSlug=${project.slug}`)
    if (res.ok) setQuests(await res.json())
    setLoading(false)
  }, [project.slug])

  useEffect(() => { load() }, [load])

  const advanceStatus = async (quest: Quest) => {
    const next = STATUS_NEXT[quest.status] ?? 'active'
    const res = await fetch(`/api/quests/${quest.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      const updated = await res.json()
      setQuests(q => q.map(x => x.id === quest.id ? updated : x))
      if (selected?.id === quest.id) setSelected(updated)
    }
  }

  const saveQuest = async (data: typeof BLANK) => {
    if ((forming as unknown) === 'new') {
      const res = await fetch('/api/quests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectSlug: project.slug }),
      })
      if (res.ok) { const q = await res.json(); setQuests(prev => [...prev, q]) }
    } else if (forming && (forming as unknown) !== 'new') {
      const res = await fetch(`/api/quests/${(forming as Quest).id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setQuests(prev => prev.map(q => q.id === updated.id ? updated : q))
        if (selected?.id === updated.id) setSelected(updated)
      }
    }
  }

  const deleteQuest = async () => {
    if (!forming || (forming as unknown) === 'new') return
    await fetch(`/api/quests/${(forming as Quest).id}`, { method: 'DELETE' })
    setQuests(prev => prev.filter(q => q.id !== (forming as Quest).id))
    if (selected?.id === (forming as Quest).id) setSelected(null)
    setForming(null)
  }

  const filtered = filter === 'all' ? quests : quests.filter(q => q.status === filter || q.questType === filter)
  const grouped = TYPE_ORDER.reduce<Record<string, Quest[]>>((acc, type) => {
    const items = filtered.filter(q => q.questType === type)
    if (items.length > 0) acc[type] = items
    return acc
  }, {})

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <div className="flex flex-col w-80 border-r border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Quests</h1>
            <p className="text-xs text-slate-500 mt-0.5">{project.name}</p>
          </div>
          <button onClick={() => setForming('new')}
            className="text-xs px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
            + New
          </button>
        </div>

        <div className="flex gap-1 p-2 border-b border-slate-800 flex-wrap">
          {['all', 'active', 'unknown-to-party', 'resolved', 'abandoned'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {f === 'all' ? 'All' : STATUS_LABEL[f] ?? f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-4 text-slate-500 text-sm">Loading…</div>
            : Object.keys(grouped).length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-slate-500 text-sm">No quests yet.</p>
                <button onClick={() => setForming('new')} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">Create your first quest →</button>
              </div>
            ) : Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-950">
                  {TYPE_LABELS[type] ?? type}
                </div>
                {items.map(quest => (
                  <button key={quest.id} onClick={() => setSelected(quest)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${selected?.id === quest.id ? 'bg-slate-800/50 border-l-2 border-l-indigo-500' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-slate-200 font-medium leading-snug">{quest.name}</span>
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded border ${STATUS_COLORS[quest.status] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                        {STATUS_LABEL[quest.status] ?? quest.status}
                      </span>
                    </div>
                    {quest.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{quest.description}</p>}
                  </button>
                ))}
              </div>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="max-w-2xl mx-auto p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{TYPE_LABELS[selected.questType] ?? selected.questType} Quest</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-100">{selected.name}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm px-2 py-1 rounded border ${STATUS_COLORS[selected.status] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>
                <button onClick={() => advanceStatus(selected)}
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors">
                  → {STATUS_LABEL[STATUS_NEXT[selected.status] ?? 'active']}
                </button>
                <button onClick={() => setForming(selected)}
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors">
                  Edit
                </button>
              </div>
            </div>

            {selected.description && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>
            )}

            {selected.rewardText && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Reward</h3>
                <p className="text-slate-300 text-sm">{selected.rewardText}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select a quest to view details</div>
        )}
      </div>

      {forming && (
        <QuestForm
          initial={(forming as unknown) === 'new' ? BLANK : forming as Quest}
          onSave={saveQuest}
          onClose={() => setForming(null)}
          onDelete={(forming as unknown) !== 'new' ? deleteQuest : undefined}
        />
      )}
    </div>
  )
}
