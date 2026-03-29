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

const ROLE_COLORS: Record<string, string> = {
  Protagonist: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Antagonist: 'bg-red-500/20 text-red-400 border-red-500/30',
  Supporting: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
  Mentor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Love Interest': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  Minor: 'bg-slate-700/30 text-slate-500 border-slate-700/30',
}

export default function CharacterPage() {
  const params = useParams()
  const router = useRouter()
  const projectSlug = params.projectSlug as string | undefined
  const backHref = projectSlug ? `/projects/${projectSlug}/characters` : '/characters'

  const [form, setForm] = useState({ name: '', role: 'Supporting', description: '', notes: '' })
  const [traits, setTraits] = useState<string[]>([])
  const [newTrait, setNewTrait] = useState('')
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setDirty(true) }

  useEffect(() => {
    fetch(`/api/characters/${params.id}`)
      .then((r) => r.json())
      .then((data: Character) => {
        setForm({ name: data.name, role: data.role, description: data.description, notes: data.notes })
        try { setTraits(JSON.parse(data.traits)) } catch { setTraits([]) }
        setLoading(false)
      })
  }, [params.id])

  const save = async () => {
    await fetch(`/api/characters/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, traits: JSON.stringify(traits) }),
    })
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const deleteCharacter = async () => {
    await fetch(`/api/characters/${params.id}`, { method: 'DELETE' })
    router.push(backHref)
  }

  const addTrait = () => {
    if (!newTrait.trim()) return
    setTraits((prev) => { setDirty(true); return [...prev, newTrait.trim()] })
    setNewTrait('')
  }

  if (loading) return <div className="p-8 text-slate-600 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <a href={backHref} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
          ← Characters
        </a>
        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-slate-500">Delete {form.name}?</span>
              <button onClick={deleteCharacter} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors">Confirm</button>
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
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Role</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => set('role', r)}
                className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                  form.role === r
                    ? ROLE_COLORS[r] ?? 'bg-slate-700/40 text-slate-300 border-slate-600'
                    : 'bg-transparent text-slate-600 border-slate-800 hover:border-slate-600 hover:text-slate-400'
                }`}
              >
                {r}
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
            placeholder="Physical appearance, personality, background…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Traits</label>
          <div className="flex flex-wrap gap-2 items-center">
            {traits.map((trait, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/15 text-emerald-300 text-xs rounded-full font-medium border border-emerald-500/30">
                {trait}
                <button onClick={() => { setTraits(prev => prev.filter((_, j) => j !== i)); setDirty(true) }} className="hover:text-red-400 leading-none ml-0.5 transition-colors">×</button>
              </span>
            ))}
            <div className="flex gap-1">
              <input
                value={newTrait}
                onChange={(e) => setNewTrait(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTrait() } }}
                placeholder="Add trait…"
                className="bg-slate-900 border border-slate-700 rounded-full px-3 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button onClick={addTrait} className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-full text-xs font-medium hover:bg-emerald-600/30 border border-emerald-500/30 transition-colors">+</button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={12}
            placeholder="Relationships, story arc, motivations, secrets, timeline…"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  )
}
