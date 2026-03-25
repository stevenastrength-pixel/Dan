'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Character = {
  id: string
  name: string
  role: string
  description: string
  notes: string
  traits: string
}

const ROLES = ['Protagonist', 'Antagonist', 'Supporting', 'Mentor', 'Love Interest', 'Minor']

export default function CharacterPage() {
  const params = useParams()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', role: 'Supporting', description: '', notes: '' })
  const [traits, setTraits] = useState<string[]>([])
  const [newTrait, setNewTrait] = useState('')
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/characters/${params.id}`)
      .then((r) => r.json())
      .then((data: Character) => {
        setForm({
          name: data.name,
          role: data.role,
          description: data.description,
          notes: data.notes,
        })
        try {
          setTraits(JSON.parse(data.traits))
        } catch {
          setTraits([])
        }
        setLoading(false)
      })
  }, [params.id])

  const save = async () => {
    await fetch(`/api/characters/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, traits: JSON.stringify(traits) }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const deleteCharacter = async () => {
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return
    await fetch(`/api/characters/${params.id}`, { method: 'DELETE' })
    router.back()
  }

  const addTrait = () => {
    if (!newTrait.trim()) return
    setTraits((prev) => [...prev, newTrait.trim()])
    setNewTrait('')
  }

  if (loading) return <div className="p-8 text-slate-600 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          ← Characters
        </button>
        <div className="flex gap-2">
          <button
            onClick={deleteCharacter}
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
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
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
            placeholder="Physical appearance, personality, background…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Traits
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {traits.map((trait, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/15 text-emerald-300 text-xs rounded-full font-medium border border-emerald-500/30"
              >
                {trait}
                <button
                  onClick={() => setTraits((prev) => prev.filter((_, j) => j !== i))}
                  className="hover:text-red-400 leading-none ml-0.5 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
            <div className="flex gap-1">
              <input
                value={newTrait}
                onChange={(e) => setNewTrait(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTrait()
                  }
                }}
                placeholder="Add trait…"
                className="bg-slate-900 border border-slate-700 rounded-full px-3 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                onClick={addTrait}
                className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-full text-xs font-medium hover:bg-emerald-600/30 border border-emerald-500/30 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={10}
            placeholder="Relationships, story arc, motivations, secrets, timeline…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
          />
        </div>
      </div>
    </div>
  )
}
