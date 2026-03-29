'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type TimelineEvent = {
  id: number
  name: string
  inWorldDay: number
  description: string
  triggerCondition: string
  consequence: string
}

const BLANK = { name: '', inWorldDay: 0, description: '', triggerCondition: '', consequence: '' }

function EventForm({ initial, onSave, onClose, onDelete }: {
  initial: Partial<TimelineEvent> & { name: string; inWorldDay: number }
  onSave: (data: typeof BLANK) => Promise<void>
  onClose: () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...BLANK, ...initial })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k: keyof typeof BLANK, v: string | number) => setForm(f => ({ ...f, [k]: v }))

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
          <h2 className="font-semibold text-slate-100">{initial.id ? 'Edit Event' : 'New Timeline Event'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Event name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="The Red Hand Reinforces the Mine"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">In-world day</label>
            <input type="number" value={form.inWorldDay} min={0}
              onChange={e => set('inWorldDay', parseInt(e.target.value) || 0)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
            <p className="text-xs text-slate-600 mt-1">Day 0 = campaign start (the inciting incident)</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">What happens</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              placeholder="Describe the event…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Only if <span className="text-slate-600 font-normal">(optional condition)</span></label>
            <input value={form.triggerCondition} onChange={e => set('triggerCondition', e.target.value)}
              placeholder="…players haven't cleared the mine yet"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Consequence <span className="text-slate-600 font-normal">(optional)</span></label>
            <textarea value={form.consequence} onChange={e => set('consequence', e.target.value)} rows={2}
              placeholder="What changes in the world after this event…"
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
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Delete event</button>
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

export default function TimelinePage({ project }: { project: { name: string; slug: string } }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TimelineEvent | null>(null)
  const [forming, setForming] = useState<TimelineEvent | 'new' | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/timeline?projectSlug=${project.slug}`)
    if (res.ok) setEvents(await res.json())
    setLoading(false)
  }, [project.slug])

  useEffect(() => { load() }, [load])

  const saveEvent = async (data: typeof BLANK) => {
    if ((forming as unknown) === 'new') {
      const res = await fetch('/api/timeline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectSlug: project.slug }),
      })
      if (res.ok) {
        const ev = await res.json()
        setEvents(prev => [...prev, ev].sort((a, b) => a.inWorldDay - b.inWorldDay))
      }
    } else if (forming && (forming as unknown) !== 'new') {
      const res = await fetch(`/api/timeline/${(forming as TimelineEvent).id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setEvents(prev => prev.map(e => e.id === updated.id ? updated : e).sort((a, b) => a.inWorldDay - b.inWorldDay))
        if (selected?.id === updated.id) setSelected(updated)
      }
    }
  }

  const deleteEvent = async () => {
    if (!forming || (forming as unknown) === 'new') return
    await fetch(`/api/timeline/${(forming as TimelineEvent).id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== (forming as TimelineEvent).id))
    if (selected?.id === (forming as TimelineEvent).id) setSelected(null)
    setForming(null)
  }

  const maxDay = events.length > 0 ? Math.max(...events.map(e => e.inWorldDay)) : 0

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Timeline</h1>
            <p className="text-xs text-slate-500 mt-0.5">{project.name} · villain&apos;s advancing plan</p>
          </div>
          <div className="flex items-center gap-3">
            {events.length > 0 && <span className="text-xs text-slate-500">{events.length} event{events.length !== 1 ? 's' : ''} · Day 0–{maxDay}</span>}
            <button onClick={() => setForming('new')}
              className="text-xs px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
              + New event
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-slate-500 text-sm">Loading…</div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="text-4xl opacity-20">◷</div>
              <p className="text-slate-500 text-sm max-w-sm">No timeline events yet.</p>
              <button onClick={() => setForming('new')} className="text-xs text-indigo-400 hover:text-indigo-300">Add the first event →</button>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-6 py-8">
              <div className="relative">
                <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-slate-800" />
                <div className="space-y-0">
                  {events.map((event, i) => {
                    const isSelected = selected?.id === event.id
                    const dayGap = i > 0 ? event.inWorldDay - events[i - 1].inWorldDay : 0
                    return (
                      <div key={event.id}>
                        {dayGap > 3 && (
                          <div className="flex items-center gap-3 py-2 pl-[3.75rem]">
                            <span className="text-xs text-slate-700 italic">+{dayGap} days</span>
                          </div>
                        )}
                        <div className={`flex gap-4 py-4 group ${isSelected ? 'text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}>
                          <div className="shrink-0 w-10 text-right">
                            <span className={`text-xs font-mono font-semibold ${isSelected ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-500'}`}>
                              {event.inWorldDay === 0 ? 'Day 0' : `D${event.inWorldDay}`}
                            </span>
                          </div>
                          <div className="shrink-0 flex items-start pt-1">
                            <div className={`w-2 h-2 rounded-full mt-0.5 ring-2 ring-slate-950 transition-colors ${isSelected ? 'bg-indigo-400' : 'bg-slate-700 group-hover:bg-slate-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <button onClick={() => setSelected(isSelected ? null : event)}
                                className={`font-medium text-sm leading-snug text-left ${isSelected ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-200'}`}>
                                {event.name}
                              </button>
                              <div className="flex items-center gap-1 shrink-0">
                                {event.triggerCondition && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">conditional</span>
                                )}
                                <button onClick={() => setForming(event)}
                                  className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all">
                                  Edit
                                </button>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="mt-3 space-y-3 text-sm">
                                <p className="text-slate-300 leading-relaxed">{event.description}</p>
                                {event.triggerCondition && (
                                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Only if</div>
                                    <p className="text-slate-300">{event.triggerCondition}</p>
                                  </div>
                                )}
                                {event.consequence && (
                                  <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Consequence</div>
                                    <p className="text-slate-300">{event.consequence}</p>
                                  </div>
                                )}
                              </div>
                            )}
                            {!isSelected && event.description && (
                              <p className="text-xs text-slate-600 mt-0.5 line-clamp-1 group-hover:text-slate-500">{event.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {forming && (
        <EventForm
          initial={(forming as unknown) === 'new' ? BLANK : forming as TimelineEvent}
          onSave={saveEvent}
          onClose={() => setForming(null)}
          onDelete={(forming as unknown) !== 'new' ? deleteEvent : undefined}
        />
      )}
    </div>
  )
}
