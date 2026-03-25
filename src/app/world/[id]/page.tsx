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

export default function WorldEntryPage() {
  const params = useParams()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', type: 'Location', description: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

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
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const deleteEntry = async () => {
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return
    await fetch(`/api/world/${params.id}`, { method: 'DELETE' })
    router.back()
  }

  if (loading) return <div className="p-8 text-slate-600 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          ← World Building
        </button>
        <div className="flex gap-2">
          <button
            onClick={deleteEntry}
            className="px-3 py-1.5 text-sm border border-red-800/60 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={save}
            className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-medium"
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Type
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Brief description…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={12}
            placeholder="History, connections, significance, lore…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
          />
        </div>
      </div>
    </div>
  )
}
