'use client'

import { useState, useEffect, useCallback } from 'react'

type TableEntry = { roll: number; text: string }
type RandomTable = {
  id: number; name: string; tableCategory: string; dieSize: string; description: string; entries: string
}
type TableFormData = Omit<RandomTable, 'entries'> & { entries: TableEntry[] }

const CATEGORY_LABELS: Record<string, string> = {
  encounter: 'Encounters', 'npc-names': 'NPC Names', rumors: 'Rumors',
  weather: 'Weather', trinkets: 'Trinkets', custom: 'Custom',
}
const CATEGORY_ORDER = ['encounter', 'npc-names', 'rumors', 'weather', 'trinkets', 'custom']
const DIE_SIZES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const DIE_MAX: Record<string, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 }

const BLANK = { name: '', tableCategory: 'custom', dieSize: 'd20', description: '', entries: [] as TableEntry[] }

// ─── Table form ───────────────────────────────────────────────────────────────

function TableForm({ initial, onSave, onClose, onDelete }: {
  initial: Partial<TableFormData> & { name: string; tableCategory: string; dieSize: string; description: string; entries: TableEntry[] }
  onSave: (data: typeof BLANK) => Promise<void>
  onClose: () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...BLANK, ...initial })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) => setForm(f => ({ ...f, [k]: v }))

  const addEntry = () => {
    const max = DIE_MAX[form.dieSize] ?? 20
    const nextRoll = form.entries.length > 0 ? Math.min(form.entries[form.entries.length - 1].roll + 1, max) : 1
    set('entries', [...form.entries, { roll: nextRoll, text: '' }])
  }

  const updateEntry = (i: number, field: 'roll' | 'text', val: string | number) => {
    const next = form.entries.map((e, idx) => idx === i ? { ...e, [field]: field === 'roll' ? Number(val) : val } : e)
    set('entries', next)
  }

  const removeEntry = (i: number) => set('entries', form.entries.filter((_, idx) => idx !== i))

  const fillEntries = () => {
    const max = DIE_MAX[form.dieSize] ?? 20
    const filled = Array.from({ length: max }, (_, i) => ({
      roll: i + 1,
      text: form.entries[i]?.text ?? '',
    }))
    set('entries', filled)
  }

  const save = async () => {
    if (!form.name.trim() || form.entries.length === 0) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-100">{initial.id ? 'Edit Table' : 'New Random Table'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Forest Encounter Table"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
              <select value={form.tableCategory} onChange={e => set('tableCategory', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Die</label>
              <select value={form.dieSize} onChange={e => { set('dieSize', e.target.value) }}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {DIE_SIZES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description <span className="text-slate-600 font-normal">(optional)</span></label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="When and how to use this table…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">Entries *</label>
              <div className="flex gap-2">
                <button onClick={fillEntries} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  Fill {DIE_MAX[form.dieSize] ?? 20} rows
                </button>
                <button onClick={addEntry} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add row</button>
              </div>
            </div>
            {form.entries.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-700 rounded-lg">
                <p className="text-slate-600 text-xs mb-2">No entries yet</p>
                <button onClick={fillEntries} className="text-xs text-indigo-400 hover:text-indigo-300">Fill {DIE_MAX[form.dieSize] ?? 20} rows</button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {form.entries.map((entry, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="number" value={entry.roll} min={1} max={DIE_MAX[form.dieSize] ?? 100}
                      onChange={e => updateEntry(i, 'roll', e.target.value)}
                      className="w-14 shrink-0 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 font-mono text-center focus:outline-none focus:border-indigo-500" />
                    <input value={entry.text} onChange={e => updateEntry(i, 'text', e.target.value)}
                      placeholder={`Result ${i + 1}…`}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                    <button onClick={() => removeEntry(i)} className="text-slate-700 hover:text-red-400 text-sm leading-none shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
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
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Delete table</button>
            )
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-slate-200">Cancel</button>
            <button onClick={save} disabled={saving || !form.name.trim() || form.entries.length === 0}
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

export default function TablesPage({ project }: { project: { name: string; slug: string } }) {
  const [tables, setTables] = useState<RandomTable[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RandomTable | null>(null)
  const [rollResult, setRollResult] = useState<{ roll: number; text: string } | null>(null)
  const [rolling, setRolling] = useState(false)
  const [forming, setForming] = useState<TableFormData | 'new' | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/tables?projectSlug=${project.slug}`)
    if (res.ok) setTables(await res.json())
    setLoading(false)
  }, [project.slug])

  useEffect(() => { load() }, [load])

  const rollTable = async (table: RandomTable) => {
    setRolling(true); setRollResult(null)
    const res = await fetch(`/api/tables/${table.id}/roll`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    if (res.ok) setRollResult(await res.json())
    setRolling(false)
  }

  const getEntries = (table: RandomTable): TableEntry[] => {
    try { return JSON.parse(table.entries) } catch { return [] }
  }

  const getFormInitial = (t: RandomTable): TableFormData => ({
    id: t.id, name: t.name, tableCategory: t.tableCategory,
    dieSize: t.dieSize, description: t.description, entries: getEntries(t),
  })

  const saveTable = async (data: typeof BLANK) => {
    if ((forming as unknown) === 'new') {
      const res = await fetch('/api/tables', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, entries: JSON.stringify(data.entries), projectSlug: project.slug }),
      })
      if (res.ok) { const t = await res.json(); setTables(prev => [...prev, t]) }
    } else if (forming && (forming as unknown) !== 'new') {
      const res = await fetch(`/api/tables/${(forming as TableFormData).id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, entries: JSON.stringify(data.entries) }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTables(prev => prev.map(t => t.id === updated.id ? updated : t))
        if (selected?.id === updated.id) { setSelected(updated); setRollResult(null) }
      }
    }
  }

  const deleteTable = async () => {
    if (!forming || (forming as unknown) === 'new') return
    await fetch(`/api/tables/${(forming as TableFormData).id}`, { method: 'DELETE' })
    setTables(prev => prev.filter(t => t.id !== (forming as TableFormData).id))
    if (selected?.id === (forming as TableFormData).id) setSelected(null)
    setForming(null)
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, RandomTable[]>>((acc, cat) => {
    const items = tables.filter(t => t.tableCategory === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})
  tables.forEach(t => {
    if (!CATEGORY_ORDER.includes(t.tableCategory) && !grouped[t.tableCategory])
      grouped[t.tableCategory] = tables.filter(x => x.tableCategory === t.tableCategory)
  })

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <div className="flex flex-col w-72 border-r border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Random Tables</h1>
            <p className="text-xs text-slate-500 mt-0.5">{project.name}</p>
          </div>
          <button onClick={() => setForming('new')}
            className="text-xs px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-4 text-slate-500 text-sm">Loading…</div>
            : Object.keys(grouped).length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-slate-500 text-sm">No tables yet.</p>
                <button onClick={() => setForming('new')} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">Create your first table →</button>
              </div>
            ) : Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-950">
                  {CATEGORY_LABELS[cat] ?? cat}
                </div>
                {items.map(table => (
                  <button key={table.id} onClick={() => { setSelected(table); setRollResult(null) }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${selected?.id === table.id ? 'bg-slate-800/50 border-l-2 border-l-indigo-500' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-200 font-medium">{table.name}</span>
                      <span className="text-xs text-slate-500 shrink-0">{table.dieSize}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{getEntries(table).length} entries</div>
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
                <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">
                  {CATEGORY_LABELS[selected.tableCategory] ?? selected.tableCategory}
                </div>
                <h2 className="text-2xl font-bold text-slate-100">{selected.name}</h2>
                {selected.description && <p className="text-slate-400 text-sm mt-1">{selected.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setForming(getFormInitial(selected))}
                  className="px-3 py-2 rounded text-sm bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors">
                  Edit
                </button>
                <button onClick={() => rollTable(selected)} disabled={rolling}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  {rolling ? '…' : '🎲'} Roll {selected.dieSize}
                </button>
              </div>
            </div>

            {rollResult && (
              <div className="mb-6 p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-indigo-400">{rollResult.roll}</span>
                  <span className="text-slate-200">{rollResult.text}</span>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">{selected.dieSize}</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {getEntries(selected).map((entry, i) => (
                    <tr key={i} className={`border-b border-slate-800/50 ${rollResult?.roll === entry.roll ? 'bg-indigo-500/10' : 'hover:bg-slate-800/20'}`}>
                      <td className="px-4 py-2 text-slate-500 font-mono">{entry.roll}</td>
                      <td className="px-4 py-2 text-slate-300">{entry.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select a table to view and roll</div>
        )}
      </div>

      {forming && (
        <TableForm
          initial={(forming as unknown) === 'new' ? BLANK : (forming as ReturnType<typeof getFormInitial>)}
          onSave={saveTable}
          onClose={() => setForming(null)}
          onDelete={(forming as unknown) !== 'new' ? deleteTable : undefined}
        />
      )}
    </div>
  )
}
