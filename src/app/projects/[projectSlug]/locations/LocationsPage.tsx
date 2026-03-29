'use client'

import { useState, useEffect, useCallback } from 'react'

type KeyedArea = { id: number; key: string; title: string; readAloud: string; dmNotes: string; connections: string; order: number }
type Location = { id: number; name: string; locationType: string; description: string; atmosphere: string; parentLocationId: number | null; keyedAreas: KeyedArea[] }

const TYPE_ICONS: Record<string, string> = { dungeon: '⬡', town: '⌂', region: '◈', wilderness: '◉', building: '▣', plane: '◇' }
const TYPE_BADGE: Record<string, string> = {
  dungeon: 'bg-red-500/20 text-red-400 border-red-500/30',
  town: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  region: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  wilderness: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  building: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  plane: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}
const TYPE_ORDER = ['dungeon', 'region', 'wilderness', 'town', 'building', 'plane']
const LOC_TYPES = ['dungeon', 'town', 'region', 'wilderness', 'building', 'plane']

function parseConnections(raw: string): string[] { try { return JSON.parse(raw) } catch { return [] } }

// ─── Location form ────────────────────────────────────────────────────────────

const LOC_BLANK = { name: '', locationType: 'dungeon', description: '', atmosphere: '' }

function LocationForm({ initial, locations, onSave, onClose, onDelete }: {
  initial: typeof LOC_BLANK & { id?: number; parentLocationId?: number | null }
  locations: Location[]
  onSave: (data: typeof LOC_BLANK & { parentLocationId?: number | null }) => Promise<void>
  onClose: () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState({ parentLocationId: null as number | null, ...LOC_BLANK, ...initial })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

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
          <h2 className="font-semibold text-slate-100">{initial.id ? 'Edit Location' : 'New Location'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="The Sunken Forge"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
              <select value={form.locationType} onChange={e => set('locationType', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {LOC_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nested inside</label>
              <select value={form.parentLocationId ?? ''} onChange={e => set('parentLocationId', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                <option value="">— none —</option>
                {locations.filter(l => l.id !== initial.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              placeholder="What is this place? What's its purpose in the adventure?"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Atmosphere <span className="text-slate-600 font-normal">(optional)</span></label>
            <textarea value={form.atmosphere} onChange={e => set('atmosphere', e.target.value)} rows={2}
              placeholder="Sights, sounds, smells — what does it feel like to be here?"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          {onDelete ? (
            confirmDelete ? (
              <div className="flex gap-2">
                <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white">Confirm delete</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 rounded text-slate-400 hover:text-slate-200">Cancel</button>
              </div>
            ) : <button onClick={() => setConfirmDelete(true)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Delete location</button>
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

// ─── Keyed area form ──────────────────────────────────────────────────────────

const AREA_BLANK = { key: '', title: '', readAloud: '', dmNotes: '' }

function AreaForm({ initial, allAreas, onSave, onClose, onDelete }: {
  initial: typeof AREA_BLANK & { id?: number }
  allAreas: KeyedArea[]
  onSave: (data: typeof AREA_BLANK) => Promise<void>
  onClose: () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...AREA_BLANK, ...initial })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k: keyof typeof AREA_BLANK, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.key.trim() || !form.title.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-100">{initial.id ? 'Edit Area' : 'New Keyed Area'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Key *</label>
              <input value={form.key} onChange={e => set('key', e.target.value)} placeholder="1"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Entry Hall"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Read Aloud <span className="text-slate-600 font-normal">(boxed text)</span></label>
            <textarea value={form.readAloud} onChange={e => set('readAloud', e.target.value)} rows={4}
              placeholder="Text read aloud to players when they enter…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">DM Notes <span className="text-slate-600 font-normal">(hidden)</span></label>
            <textarea value={form.dmNotes} onChange={e => set('dmNotes', e.target.value)} rows={4}
              placeholder="Secrets, mechanics, context, what happens when players do X…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          {onDelete ? (
            confirmDelete ? (
              <div className="flex gap-2">
                <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white">Confirm delete</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 rounded text-slate-400 hover:text-slate-200">Cancel</button>
              </div>
            ) : <button onClick={() => setConfirmDelete(true)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Delete area</button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-slate-200">Cancel</button>
            <button onClick={save} disabled={saving || !form.key.trim() || !form.title.trim()}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Area card ────────────────────────────────────────────────────────────────

function AreaCard({ area, allAreas, onSelect, onEdit, isSelected }: {
  area: KeyedArea; allAreas: KeyedArea[]
  onSelect: (a: KeyedArea) => void; onEdit: (a: KeyedArea) => void; isSelected: boolean
}) {
  const connections = parseConnections(area.connections)
  return (
    <div className={`rounded-lg border transition-all group ${isSelected ? 'bg-slate-800/80 border-indigo-500/50 ring-1 ring-indigo-500/30' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'}`}>
      <button onClick={() => onSelect(area)} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold font-mono ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{area.key}</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-slate-200">{area.title}</div>
            {area.readAloud && <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">{area.readAloud}</p>}
            {connections.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {connections.map(c => {
                  const linked = allAreas.find(a => a.key === c)
                  return <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">→ {c}{linked ? `: ${linked.title.slice(0, 18)}` : ''}</span>
                })}
              </div>
            )}
          </div>
        </div>
      </button>
      <button onClick={() => onEdit(area)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-xs text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded hover:bg-slate-700 transition-all">Edit</button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LocationsPage({ project }: { project: { name: string; slug: string } }) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [selectedArea, setSelectedArea] = useState<KeyedArea | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [locForm, setLocForm] = useState<Partial<Location> & { name: string; locationType: string } | 'new' | null>(null)
  const [areaForm, setAreaForm] = useState<(typeof AREA_BLANK & { id?: number }) | 'new' | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/locations?projectSlug=${project.slug}`)
    if (res.ok) setLocations(await res.json())
    setLoading(false)
  }, [project.slug])

  useEffect(() => { load() }, [load])

  const selectLocation = (loc: Location) => { setSelectedLocation(loc); setSelectedArea(null) }

  const saveLocation = async (data: typeof LOC_BLANK & { parentLocationId?: number | null }) => {
    if ((locForm as unknown) === 'new') {
      const res = await fetch('/api/locations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectSlug: project.slug }),
      })
      if (res.ok) {
        const loc = await res.json()
        const full = { ...loc, keyedAreas: [] }
        setLocations(prev => [...prev, full])
        setSelectedLocation(full)
      }
    } else if (locForm && (locForm as unknown) !== 'new') {
      const res = await fetch(`/api/locations/${(locForm as Location).id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        const full = { ...updated, keyedAreas: (locForm as Location).keyedAreas ?? [] }
        setLocations(prev => prev.map(l => l.id === full.id ? full : l))
        if (selectedLocation?.id === full.id) setSelectedLocation(full)
      }
    }
  }

  const deleteLocation = async () => {
    if (!locForm || (locForm as unknown) === 'new') return
    await fetch(`/api/locations/${(locForm as Location).id}`, { method: 'DELETE' })
    setLocations(prev => prev.filter(l => l.id !== (locForm as Location).id))
    if (selectedLocation?.id === (locForm as Location).id) setSelectedLocation(null)
    setLocForm(null)
  }

  const saveArea = async (data: typeof AREA_BLANK) => {
    if (!selectedLocation) return
    if ((areaForm as unknown) === 'new') {
      const res = await fetch(`/api/locations/${selectedLocation.id}/areas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const area = await res.json()
        const updated = { ...selectedLocation, keyedAreas: [...selectedLocation.keyedAreas, area] }
        setLocations(prev => prev.map(l => l.id === updated.id ? updated : l))
        setSelectedLocation(updated)
      }
    } else if (areaForm && (areaForm as unknown) !== 'new') {
      const res = await fetch(`/api/areas/${(areaForm as KeyedArea).id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        const updatedLoc = { ...selectedLocation, keyedAreas: selectedLocation.keyedAreas.map(a => a.id === updated.id ? updated : a) }
        setLocations(prev => prev.map(l => l.id === updatedLoc.id ? updatedLoc : l))
        setSelectedLocation(updatedLoc)
        if (selectedArea?.id === updated.id) setSelectedArea(updated)
      }
    }
  }

  const deleteArea = async () => {
    if (!areaForm || (areaForm as unknown) === 'new' || !selectedLocation) return
    await fetch(`/api/areas/${(areaForm as KeyedArea).id}`, { method: 'DELETE' })
    const updatedLoc = { ...selectedLocation, keyedAreas: selectedLocation.keyedAreas.filter(a => a.id !== (areaForm as KeyedArea).id) }
    setLocations(prev => prev.map(l => l.id === updatedLoc.id ? updatedLoc : l))
    setSelectedLocation(updatedLoc)
    if (selectedArea?.id === (areaForm as KeyedArea).id) setSelectedArea(null)
    setAreaForm(null)
  }

  const topLevel = locations.filter(l => l.parentLocationId === null)
  const children = (parentId: number) => locations.filter(l => l.parentLocationId === parentId)
  const availableTypes = Array.from(new Set(locations.map(l => l.locationType)))
  const filteredTop = (typeFilter === 'all' ? topLevel : topLevel.filter(l => l.locationType === typeFilter))
    .sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a.locationType), bi = TYPE_ORDER.indexOf(b.locationType)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name)
    })

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Location list */}
      <div className="flex flex-col w-72 border-r border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Locations</h1>
            <p className="text-xs text-slate-500 mt-0.5">{project.name}</p>
          </div>
          <button onClick={() => setLocForm('new')}
            className="text-xs px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
            + New
          </button>
        </div>

        {availableTypes.length > 1 && (
          <div className="flex gap-1 p-2 border-b border-slate-800 flex-wrap">
            <button onClick={() => setTypeFilter('all')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${typeFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>All</button>
            {availableTypes.sort().map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-2 py-0.5 rounded text-xs font-medium capitalize transition-colors ${typeFilter === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{t}</button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-4 text-slate-500 text-sm">Loading…</div>
            : filteredTop.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-slate-500 text-sm">No locations yet.</p>
                <button onClick={() => setLocForm('new')} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">Create your first location →</button>
              </div>
            ) : filteredTop.map(loc => (
              <div key={loc.id}>
                <button onClick={() => selectLocation(loc)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${selectedLocation?.id === loc.id ? 'bg-slate-800/50 border-l-2 border-l-indigo-500' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base opacity-60">{TYPE_ICONS[loc.locationType] ?? '◌'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 font-medium truncate">{loc.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 capitalize">{loc.locationType}</span>
                        {loc.keyedAreas.length > 0 && <span className="text-xs text-slate-600">{loc.keyedAreas.length} areas</span>}
                      </div>
                    </div>
                  </div>
                </button>
                {children(loc.id).map(child => (
                  <button key={child.id} onClick={() => selectLocation(child)}
                    className={`w-full text-left pl-8 pr-4 py-2.5 border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors ${selectedLocation?.id === child.id ? 'bg-slate-800/40' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm opacity-50">{TYPE_ICONS[child.locationType] ?? '◌'}</span>
                      <div>
                        <div className="text-sm text-slate-300">{child.name}</div>
                        {child.keyedAreas.length > 0 && <div className="text-xs text-slate-600">{child.keyedAreas.length} areas</div>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedLocation ? (
          <>
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{TYPE_ICONS[selectedLocation.locationType] ?? '◌'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border capitalize ${TYPE_BADGE[selectedLocation.locationType] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                      {selectedLocation.locationType}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-100">{selectedLocation.name}</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedLocation.keyedAreas.length > 0 && (
                    <div className="text-right mr-2">
                      <div className="text-2xl font-bold text-slate-300">{selectedLocation.keyedAreas.length}</div>
                      <div className="text-xs text-slate-500">area{selectedLocation.keyedAreas.length !== 1 ? 's' : ''}</div>
                    </div>
                  )}
                  <button onClick={() => setLocForm(selectedLocation)}
                    className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors">
                    Edit
                  </button>
                  <button onClick={() => setAreaForm('new')}
                    className="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
                    + Area
                  </button>
                </div>
              </div>
              {selectedLocation.description && <p className="text-slate-300 mt-3 leading-relaxed">{selectedLocation.description}</p>}
              {selectedLocation.atmosphere && <p className="text-slate-400 text-sm mt-2 italic">{selectedLocation.atmosphere}</p>}
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedLocation.keyedAreas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                  <p className="text-slate-600 text-sm">No keyed areas yet.</p>
                  <button onClick={() => setAreaForm('new')} className="text-xs text-indigo-400 hover:text-indigo-300">Add the first area →</button>
                </div>
              ) : (
                <div className="p-6">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Areas ({selectedLocation.keyedAreas.length})</div>
                  <div className="grid gap-2">
                    {selectedLocation.keyedAreas.map(area => (
                      <div key={area.id} className="relative group">
                        <AreaCard
                          area={area} allAreas={selectedLocation.keyedAreas}
                          onSelect={a => setSelectedArea(selectedArea?.id === a.id ? null : a)}
                          onEdit={a => setAreaForm(a)}
                          isSelected={selectedArea?.id === area.id}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedArea && (
              <div className="max-h-[45%] overflow-y-auto border-t border-slate-800 bg-slate-900/50 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-sm font-bold font-mono text-white">{selectedArea.key}</div>
                    <h3 className="text-lg font-semibold text-slate-100">{selectedArea.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAreaForm(selectedArea)}
                      className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors">Edit</button>
                    <button onClick={() => setSelectedArea(null)} className="text-slate-600 hover:text-slate-400 text-lg leading-none">✕</button>
                  </div>
                </div>
                {selectedArea.readAloud && (
                  <div className="mb-4 p-4 rounded-lg bg-slate-800/80 border border-slate-700 border-l-4 border-l-indigo-500">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Read Aloud</div>
                    <p className="text-slate-200 italic leading-relaxed text-sm">{selectedArea.readAloud}</p>
                  </div>
                )}
                {selectedArea.dmNotes && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">DM Notes</div>
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{selectedArea.dmNotes}</p>
                  </div>
                )}
                {parseConnections(selectedArea.connections).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Connections</div>
                    <div className="flex gap-2 flex-wrap">
                      {parseConnections(selectedArea.connections).map(c => {
                        const linked = selectedLocation.keyedAreas.find(a => a.key === c)
                        return <span key={c} className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">{c}{linked ? ` · ${linked.title}` : ''}</span>
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select a location to view its areas</div>
        )}
      </div>

      {locForm && (
        <LocationForm
          initial={(locForm as unknown) === 'new' ? { ...LOC_BLANK, parentLocationId: null } : locForm as Location}
          locations={locations}
          onSave={saveLocation}
          onClose={() => setLocForm(null)}
          onDelete={(locForm as unknown) !== 'new' ? deleteLocation : undefined}
        />
      )}

      {areaForm && selectedLocation && (
        <AreaForm
          initial={(areaForm as unknown) === 'new' ? AREA_BLANK : areaForm as KeyedArea}
          allAreas={selectedLocation.keyedAreas}
          onSave={saveArea}
          onClose={() => setAreaForm(null)}
          onDelete={(areaForm as unknown) !== 'new' ? deleteArea : undefined}
        />
      )}
    </div>
  )
}
