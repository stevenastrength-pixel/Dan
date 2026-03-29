'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

type WorldEntry = {
  id: string
  name: string
  type: string
  description: string
  notes: string
}

const TYPES = ['Location', 'Faction', 'Concept', 'Item', 'Event']

const TYPE_COLORS: Record<string, string> = {
  Location: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Faction: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Concept: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  Item: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Event: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function WorldEntryPage() {
  const params = useParams()
  const router = useRouter()
  const projectSlug = params.projectSlug as string | undefined
  const backHref = projectSlug ? `/projects/${projectSlug}/world` : '/world'

  const [form, setForm] = useState({ name: '', type: 'Location', description: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setDirty(true) }

  useEffect(() => {
    fetch(`/api/world/${params.id}`)
      .then((r) => r.json())
      .then((data: WorldEntry) => {
        setForm({ name: data.name, type: data.type, description: data.description, notes: data.notes })
        setLoading(false)
      })
  }, [params.id])

  const save = async () => {
    await fetch(`/api/world/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const deleteEntry = async () => {
    await fetch(`/api/world/${params.id}`, { method: 'DELETE' })
    router.push(backHref)
  }

  if (loading) return <div className="p-8 text-slate-600 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <a href={backHref} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          ← World Building
        </a>
        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-slate-500">Delete {form.name}?</span>
              <button onClick={deleteEntry} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors">Confirm</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="px-3 py-1.5 text-sm border border-red-800/60 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
              Delete
            </button>
          )}
          <button
            onClick={save}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${dirty ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            {saved ? '✓ Saved' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-lg font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button
                key={t}
                onClick={() => set('type', t)}
                className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                  form.type === t
                    ? TYPE_COLORS[t] ?? 'bg-slate-700/40 text-slate-300 border-slate-600'
                    : 'bg-transparent text-slate-600 border-slate-800 hover:border-slate-600 hover:text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="Brief description — this is what Daneel sees at a glance…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={14}
            placeholder="History, connections, significance, lore, atmosphere…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  )
}
