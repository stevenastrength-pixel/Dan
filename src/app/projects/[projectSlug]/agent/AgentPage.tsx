'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectMessage = { id: number; role: 'user' | 'assistant'; author: string; content: string; createdAt: string }
type ChatMessage = { role: 'user' | 'assistant'; content: string; author?: string }
type ProjectInfo = { id: number; name: string; slug: string; description: string }
type ProjectDocument = { id: number; key: string; title: string; content: string; updatedAt: string }
type Poll = {
  id: number; question: string; options: string[]; createdBy: string
  status: 'OPEN' | 'CLOSED'; createdAt: string
  votes: Array<{ voterName: string; optionIdx: number }>
}
type Chapter = { id: string; title: string; content: string; order: number; updatedAt: string }
type Character = { id: string; name: string; role: string; description: string; notes: string; traits: string[] }
type WorldEntry = { id: string; name: string; type: string; description: string; notes: string; updatedAt: string }

type MainView =
  | { type: 'console' }
  | { type: 'document'; key: string }
  | { type: 'chapter'; id: string }
  | { type: 'character'; id: string }
  | { type: 'world'; id: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Username Modal ───────────────────────────────────────────────────────────

function UsernameModal({ onSave }: { onSave: (name: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-80">
        <h2 className="text-base font-semibold text-slate-100 mb-1">Who are you?</h2>
        <p className="text-sm text-slate-500 mb-4">Enter your name to get started. Saved in your browser.</p>
        <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && val.trim() && onSave(val.trim())}
          placeholder="Your name"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-3" />
        <button disabled={!val.trim()} onClick={() => onSave(val.trim())}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors">
          Continue
        </button>
      </div>
    </div>
  )
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t) }, [onDismiss])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
      {message}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function SidebarSection({
  label, items, selectedId, onSelect, onCreate, createPlaceholder, loading
}: {
  label: string
  items: Array<{ id: string; label: string; sub?: string }>
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  createPlaceholder: string
  loading?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const submit = () => {
    if (!newName.trim()) return
    onCreate(newName.trim())
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="border-t border-slate-800/60 first:border-t-0">
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors">
          <span>{open ? '▼' : '▶'}</span>{label}
        </button>
        {open && (
          <button onClick={() => setCreating(v => !v)}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
            {creating ? '✕' : '+'}
          </button>
        )}
      </div>

      {open && (
        <>
          {creating && (
            <div className="px-3 pb-2 flex gap-1">
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
                placeholder={createPlaceholder}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
              <button onClick={submit} className="text-xs text-emerald-400 hover:text-emerald-300 px-1">↵</button>
            </div>
          )}
          {loading && <p className="text-xs text-slate-600 px-3 pb-2">Loading…</p>}
          <nav className="space-y-0.5 px-2 pb-2">
            {items.map(item => (
              <button key={item.id} onClick={() => onSelect(item.id)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedId === item.id
                    ? 'bg-emerald-600/15 text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}>
                <span className="block truncate">{item.label}</span>
                {item.sub && <span className="text-[10px] text-slate-600">{item.sub}</span>}
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  )
}

function Sidebar({
  documents, selectedView, onSelectDoc, onSelectChapter, onSelectCharacter, onSelectWorld,
  chapters, characters, worldEntries,
  onCreateChapter, onCreateCharacter, onCreateWorldEntry,
  chaptersLoading, charactersLoading, worldLoading,
}: {
  documents: ProjectDocument[]
  selectedView: MainView
  onSelectDoc: (key: string) => void
  onSelectChapter: (id: string) => void
  onSelectCharacter: (id: string) => void
  onSelectWorld: (id: string) => void
  chapters: Chapter[]
  characters: Character[]
  worldEntries: WorldEntry[]
  onCreateChapter: (title: string) => void
  onCreateCharacter: (name: string) => void
  onCreateWorldEntry: (name: string) => void
  chaptersLoading: boolean
  charactersLoading: boolean
  worldLoading: boolean
}) {
  const selectedDocKey = selectedView.type === 'document' ? selectedView.key : null
  const selectedChapterId = selectedView.type === 'chapter' ? selectedView.id : null
  const selectedCharacterId = selectedView.type === 'character' ? selectedView.id : null
  const selectedWorldId = selectedView.type === 'world' ? selectedView.id : null

  const [docsOpen, setDocsOpen] = useState(true)

  return (
    <div className="w-52 border-r border-slate-800/60 flex flex-col shrink-0 bg-slate-900/40 overflow-y-auto">
      {/* Documents */}
      <div className="border-b border-slate-800/60">
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={() => setDocsOpen(v => !v)}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors">
            <span>{docsOpen ? '▼' : '▶'}</span> Documents
          </button>
        </div>
        {docsOpen && (
          <nav className="px-2 pb-2 space-y-0.5">
            {documents.map(doc => (
              <button key={doc.key} onClick={() => onSelectDoc(doc.key)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedDocKey === doc.key
                    ? 'bg-emerald-600/15 text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}>
                <span className="block truncate">{doc.title}</span>
                {doc.content.trim() && (
                  <span className="text-[10px] text-slate-600">{timeAgo(doc.updatedAt)}</span>
                )}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Chapters */}
      <SidebarSection
        label="Chapters"
        items={chapters.map((c, i) => ({ id: c.id, label: c.title, sub: `Ch. ${i + 1} · ${timeAgo(c.updatedAt)}` }))}
        selectedId={selectedChapterId}
        onSelect={onSelectChapter}
        onCreate={onCreateChapter}
        createPlaceholder="Chapter title…"
        loading={chaptersLoading}
      />

      {/* Characters */}
      <SidebarSection
        label="Characters"
        items={characters.map(c => ({ id: c.id, label: c.name, sub: c.role || undefined }))}
        selectedId={selectedCharacterId}
        onSelect={onSelectCharacter}
        onCreate={onCreateCharacter}
        createPlaceholder="Character name…"
        loading={charactersLoading}
      />

      {/* World */}
      <SidebarSection
        label="World"
        items={worldEntries.map(w => ({ id: w.id, label: w.name, sub: w.type || undefined }))}
        selectedId={selectedWorldId}
        onSelect={onSelectWorld}
        onCreate={onCreateWorldEntry}
        createPlaceholder="Entry name…"
        loading={worldLoading}
      />
    </div>
  )
}

// ─── Editors ──────────────────────────────────────────────────────────────────

function DocEditor({ doc, projectSlug, onSaved, onBack }: {
  doc: ProjectDocument; projectSlug: string
  onSaved: (updated: ProjectDocument) => void; onBack: () => void
}) {
  const [content, setContent] = useState(doc.content)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const dirty = content !== doc.content

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/projects/${projectSlug}/documents/${doc.key}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title: doc.title }),
    })
    onSaved(await res.json())
    setSaving(false)
    setSavedAt(new Date().toISOString())
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 shrink-0">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">← Console</button>
        <span className="text-slate-800">|</span>
        <h2 className="text-sm font-semibold text-slate-300">{doc.title}</h2>
        <div className="ml-auto flex items-center gap-3">
          {savedAt && <span className="text-xs text-slate-600">Saved {timeAgo(savedAt)}</span>}
          <button onClick={save} disabled={saving || !dirty}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
      <textarea value={content} onChange={e => setContent(e.target.value)}
        className="flex-1 w-full resize-none px-5 py-4 text-sm font-mono text-slate-300 bg-slate-950 focus:outline-none leading-relaxed placeholder:text-slate-700"
        placeholder="Document content…" />
    </div>
  )
}

function ChapterEditor({ chapter, username, onSaved, onBack }: {
  chapter: Chapter; username: string
  onSaved: (updated: Chapter) => void; onBack: () => void
}) {
  const [title, setTitle] = useState(chapter.title)
  const [content, setContent] = useState(chapter.content ?? '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const dirty = title !== chapter.title || content !== (chapter.content ?? '')

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/chapters/${chapter.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, savedBy: username }),
    })
    onSaved(await res.json())
    setSaving(false)
    setSavedAt(new Date().toISOString())
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 shrink-0">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">← Console</button>
        <span className="text-slate-800">|</span>
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="flex-1 bg-transparent text-sm font-semibold text-slate-300 focus:outline-none placeholder:text-slate-600"
          placeholder="Chapter title…" />
        <div className="flex items-center gap-3 shrink-0">
          {savedAt && <span className="text-xs text-slate-600">Saved {timeAgo(savedAt)}</span>}
          <button onClick={save} disabled={saving || !dirty}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
      <textarea value={content} onChange={e => setContent(e.target.value)}
        className="flex-1 w-full resize-none px-5 py-4 text-sm font-mono text-slate-300 bg-slate-950 focus:outline-none leading-relaxed placeholder:text-slate-700"
        placeholder="Write the chapter here…" />
    </div>
  )
}

function CharacterEditor({ character, onSaved, onBack }: {
  character: Character
  onSaved: (updated: Character) => void; onBack: () => void
}) {
  const [name, setName] = useState(character.name)
  const [role, setRole] = useState(character.role ?? '')
  const [description, setDescription] = useState(character.description ?? '')
  const [notes, setNotes] = useState(character.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const dirty = name !== character.name || role !== (character.role ?? '') ||
    description !== (character.description ?? '') || notes !== (character.notes ?? '')

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/characters/${character.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, description, notes, traits: character.traits }),
    })
    onSaved(await res.json())
    setSaving(false)
    setSavedAt(new Date().toISOString())
  }

  const field = (label: string, val: string, set: (v: string) => void, multiline = false) => (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {multiline
        ? <textarea value={val} onChange={e => set(e.target.value)} rows={6}
            className="w-full resize-none bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 leading-relaxed placeholder:text-slate-700" />
        : <input value={val} onChange={e => set(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 placeholder:text-slate-700" />
      }
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 shrink-0">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">← Console</button>
        <span className="text-slate-800">|</span>
        <input value={name} onChange={e => setName(e.target.value)}
          className="flex-1 bg-transparent text-sm font-semibold text-slate-300 focus:outline-none" placeholder="Name…" />
        <div className="flex items-center gap-3 shrink-0">
          {savedAt && <span className="text-xs text-slate-600">Saved {timeAgo(savedAt)}</span>}
          <button onClick={save} disabled={saving || !dirty}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {field('Role', role, setRole)}
        {field('Description', description, setDescription, true)}
        {field('Notes', notes, setNotes, true)}
      </div>
    </div>
  )
}

function WorldEntryEditor({ entry, onSaved, onBack }: {
  entry: WorldEntry
  onSaved: (updated: WorldEntry) => void; onBack: () => void
}) {
  const [name, setName] = useState(entry.name)
  const [type, setType] = useState(entry.type ?? '')
  const [description, setDescription] = useState(entry.description ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const dirty = name !== entry.name || type !== (entry.type ?? '') ||
    description !== (entry.description ?? '') || notes !== (entry.notes ?? '')

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/world/${entry.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, description, notes }),
    })
    onSaved(await res.json())
    setSaving(false)
    setSavedAt(new Date().toISOString())
  }

  const field = (label: string, val: string, set: (v: string) => void, multiline = false) => (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {multiline
        ? <textarea value={val} onChange={e => set(e.target.value)} rows={6}
            className="w-full resize-none bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 leading-relaxed placeholder:text-slate-700" />
        : <input value={val} onChange={e => set(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 placeholder:text-slate-700" />
      }
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 shrink-0">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">← Console</button>
        <span className="text-slate-800">|</span>
        <input value={name} onChange={e => setName(e.target.value)}
          className="flex-1 bg-transparent text-sm font-semibold text-slate-300 focus:outline-none" placeholder="Entry name…" />
        <div className="flex items-center gap-3 shrink-0">
          {savedAt && <span className="text-xs text-slate-600">Saved {timeAgo(savedAt)}</span>}
          <button onClick={save} disabled={saving || !dirty}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {field('Type', type, setType)}
        {field('Description', description, setDescription, true)}
        {field('Notes', notes, setNotes, true)}
      </div>
    </div>
  )
}

// ─── @mention rendering ───────────────────────────────────────────────────────

function renderContent(text: string) {
  const parts = text.split(/(@\w+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^@\w+$/.test(part) ? (
          <span key={i} className={/^@daneel$/i.test(part) ? 'text-emerald-400 font-semibold' : 'text-sky-400 font-semibold'}>
            {part}
          </span>
        ) : part
      )}
    </>
  )
}

// ─── User avatar ──────────────────────────────────────────────────────────────

function Avatar({ name, online }: { name: string; online: boolean }) {
  const initials = name.slice(0, 2).toUpperCase()
  const isDaneel = /^daneel$/i.test(name)
  return (
    <div className="relative shrink-0" title={`${name}${online ? ' (online)' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
        isDaneel ? 'bg-emerald-800/60 text-emerald-300' : 'bg-slate-700 text-slate-300'
      }`}>
        {isDaneel ? '⬡' : initials}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
    </div>
  )
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({ projectSlug, username, onDocumentUpdated, onChapterUpdated, onPollCreated, onTaskAssigned }: { projectSlug: string; username: string; onDocumentUpdated?: () => void; onChapterUpdated?: () => void; onPollCreated?: (poll?: Poll) => void; onTaskAssigned?: () => void }) {
  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<string[]>([])

  // @ mention dropdown
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)

  const lastIdRef = useRef<number>(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const DANEEL = 'Daneel'
  const mentionCandidates = mentionQuery !== null
    ? [DANEEL, ...allUsers.filter(u => u !== username && u !== DANEEL)]
        .filter(u => u.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : []

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  // Initial message load
  useEffect(() => {
    fetch(`/api/projects/${projectSlug}/messages`)
      .then(r => r.json())
      .then((msgs: ProjectMessage[]) => {
        setMessages(msgs)
        if (msgs.length > 0) lastIdRef.current = msgs[msgs.length - 1].id
      })
      .catch(() => {})
  }, [projectSlug])

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectSlug}/messages?afterId=${lastIdRef.current}`)
        const fresh: ProjectMessage[] = await res.json()
        if (fresh.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id))
            const newOnes = fresh.filter(m => !existingIds.has(m.id))
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev
          })
          lastIdRef.current = fresh[fresh.length - 1].id
          if (fresh.some(m => m.author === DANEEL)) setThinking(false)
        }
      } catch {}
    }, 2500)
    return () => clearInterval(interval)
  }, [projectSlug])

  // Heartbeat — mark this user as online
  useEffect(() => {
    const ping = () => {
      fetch(`/api/projects/${projectSlug}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      }).catch(() => {})
    }
    ping()
    const interval = setInterval(ping, 30000)
    return () => clearInterval(interval)
  }, [projectSlug, username])

  // Poll presence
  useEffect(() => {
    const fetchPresence = () => {
      fetch(`/api/projects/${projectSlug}/presence`)
        .then(r => r.json())
        .then(data => {
          setOnlineUsers(data.online ?? [])
          setAllUsers(data.all ?? [])
        })
        .catch(() => {})
    }
    fetchPresence()
    const interval = setInterval(fetchPresence, 5000)
    return () => clearInterval(interval)
  }, [projectSlug])

  // Detect @mention query from cursor position
  const updateMentionQuery = (val: string, cursorPos: number) => {
    const before = val.slice(0, cursorPos)
    const match = before.match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInput(val)
    updateMentionQuery(val, e.target.selectionStart ?? val.length)
  }

  const selectMention = (name: string) => {
    const cursor = inputRef.current?.selectionStart ?? input.length
    const before = input.slice(0, cursor)
    const after = input.slice(cursor)
    const newBefore = before.replace(/@\w*$/, `@${name} `)
    setInput(newBefore + after)
    setMentionQuery(null)
    setTimeout(() => {
      inputRef.current?.focus()
      const pos = newBefore.length
      inputRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionCandidates.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || (e.key === 'Enter' && mentionCandidates.length > 0)) {
        e.preventDefault()
        selectMention(mentionCandidates[mentionIndex])
        return
      }
      if (e.key === 'Escape') { setMentionQuery(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) send()
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMentionQuery(null)
    setSending(true)
    inputRef.current?.focus()

    const mentionsDaneel = /@daneel\b/i.test(text)
    if (mentionsDaneel) setThinking(true)

    try {
      const res = await fetch(`/api/projects/${projectSlug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: username, content: text }),
      })
      const data = await res.json()
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const toAdd = [data.message, data.aiMessage].filter(m => m && !existingIds.has(m.id))
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev
      })
      if (data.message) lastIdRef.current = Math.max(lastIdRef.current, data.aiMessage?.id ?? data.message.id)
      if (data.aiMessage?.content?.includes('📝')) onDocumentUpdated?.()
      if (data.aiMessage?.content?.includes('📖')) onChapterUpdated?.()
      if (data.aiMessage) onPollCreated?.(data.createdPoll ?? undefined)
      if (data.createdTask) onTaskAssigned?.()
    } catch {}
    finally {
      setSending(false)
      setThinking(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  // All known participants including Daneel (always shown)
  const allParticipants = [DANEEL, ...allUsers.filter(u => u !== DANEEL)]

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-950">

      {/* Presence bar */}
      <div className="px-4 py-2 border-b border-slate-800/60 flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {allParticipants.map(name => (
            <Avatar key={name} name={name} online={name === DANEEL ? true : onlineUsers.includes(name)} />
          ))}
        </div>
        <span className="text-xs text-slate-600 ml-1">
          {onlineUsers.length} online
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !thinking && (
          <div className="text-center mt-10">
            <p className="text-3xl mb-2 text-emerald-500">⬡</p>
            <p className="text-sm text-slate-600">No messages yet. Say hi, or @Daneel to get started.</p>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.author === username
          const isDaneel = msg.author === DANEEL
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm border ${
                isDaneel
                  ? 'bg-slate-900/90 border-slate-700/60 text-slate-200 dark:text-slate-200'
                  : isMe
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-50'
                  : 'bg-slate-800/60 border-slate-700/40 text-slate-800 dark:text-slate-200'
              }`}>
                <p className={`text-xs mb-1 font-medium ${
                  isDaneel ? 'text-emerald-400' : isMe ? 'text-emerald-700 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'
                }`}>
                  {msg.author}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{renderContent(msg.content)}</p>
              </div>
            </div>
          )
        })}

        {thinking && (
          <div className="flex justify-start">
            <div className="bg-slate-900/90 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm">
              <p className="text-emerald-400 text-xs mb-1 font-medium">Daneel</p>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-3 py-2 border-t border-slate-800/60 shrink-0 relative">
        {/* @ mention dropdown */}
        {mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20">
            {mentionCandidates.map((name, i) => {
              const isDaneelOpt = name === DANEEL
              return (
                <button
                  key={name}
                  onMouseDown={e => { e.preventDefault(); selectMention(name) }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    i === mentionIndex ? 'bg-slate-700/60' : 'hover:bg-slate-800/60'
                  }`}
                >
                  <Avatar name={name} online={isDaneelOpt ? true : onlineUsers.includes(name)} />
                  <span className={isDaneelOpt ? 'text-emerald-300 font-medium' : 'text-slate-200'}>
                    {name}
                  </span>
                  {isDaneelOpt && <span className="text-xs text-slate-500 ml-auto">AI</span>}
                  {!isDaneelOpt && onlineUsers.includes(name) && (
                    <span className="text-xs text-emerald-500 ml-auto">online</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex gap-2 pr-4 sm:pr-8 md:pr-16">
          <button
            onClick={() => {
              const prefix = '@Daneel '
              const newInput = input.startsWith(prefix) ? input : prefix + input
              setInput(newInput)
              setTimeout(() => {
                inputRef.current?.focus()
                const pos = newInput.startsWith(prefix) ? newInput.length : prefix.length
                inputRef.current?.setSelectionRange(pos, pos)
              }, 0)
            }}
            disabled={sending}
            title="Tag Daneel"
            className="px-2 py-1.5 bg-slate-800 border border-slate-700 text-emerald-400 rounded-lg text-sm hover:bg-slate-700 hover:border-emerald-500/40 disabled:opacity-40 transition-colors shrink-0"
          >
            ⬡
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onClick={e => updateMentionQuery(input, (e.target as HTMLInputElement).selectionStart ?? input.length)}
            placeholder="Message… (@Daneel for AI, @name to tag)"
            disabled={sending}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
          >
            {sending ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Polls Panel ──────────────────────────────────────────────────────────────

function PollsPanel({ projectSlug, username, polls, onRefresh, onPollClosed, onlineUsers, isAdmin }: {
  projectSlug: string; username: string; polls: Poll[]; onRefresh: () => void
  onPollClosed: (summary: string) => void; onlineUsers: string[]; isAdmin: boolean
}) {
  const [open, setOpen] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [creating, setCreating] = useState(false)
  const [closedExpanded, setClosedExpanded] = useState(false)

  const createPoll = async () => {
    const valid = options.filter(o => o.trim())
    if (!question.trim() || valid.length < 2) return
    setCreating(true)
    await fetch(`/api/projects/${projectSlug}/polls`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), options: valid, createdBy: username }),
    })
    setQuestion(''); setOptions(['', '']); setShowCreate(false); setCreating(false); onRefresh()
  }

  const vote = async (pollId: number, optionIdx: number) => {
    await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterName: username, optionIdx }),
    })
    onRefresh()
  }

  const deletePoll = async (pollId: number) => {
    await fetch(`/api/polls/${pollId}`, { method: 'DELETE' })
    onRefresh()
  }

  const closePoll = async (pollId: number) => {
    await fetch(`/api/polls/${pollId}/close`, { method: 'POST' })
    onRefresh()

    const poll = polls.find(p => p.id === pollId)
    if (!poll) return
    const tallies = poll.options.map((_, i) => poll.votes.filter(v => v.optionIdx === i).length)
    const total = poll.votes.length
    const maxTally = Math.max(...tallies, 0)
    const lines = poll.options.map((opt, i) => {
      const count = tallies[i]
      const pct = total > 0 ? Math.round((count / total) * 100) : 0
      const winner = count === maxTally && total > 0
      return `• ${opt} — ${count} vote${count !== 1 ? 's' : ''}${pct > 0 ? ` (${pct}%)` : ''}${winner ? ' 🏆' : ''}`
    }).join('\n')
    const summary = `📊 Poll closed: **"${poll.question}"**\n${lines}\n\n@Daneel the team has voted — acknowledge the result and factor it into the project if relevant.`
    onPollClosed(summary)
  }

  const openPolls = polls.filter(p => p.status === 'OPEN')
  const closedPolls = polls.filter(p => p.status === 'CLOSED')

  return (
    <div className="border-t border-slate-800/60 bg-slate-900/30 shrink-0" style={{ maxHeight: '45%' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60">
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors">
          <span>{open ? '▼' : '▶'}</span> Poll Control
          {openPolls.length > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full text-xs font-medium">{openPolls.length}</span>
          )}
        </button>
        {open && (
          <button onClick={() => setShowCreate(v => !v)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            {showCreate ? 'Cancel' : '+ New Poll'}
          </button>
        )}
      </div>
      {open && (
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(45vh - 2rem)' }}>
          {showCreate && (
            <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/50">
              <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Poll question…"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 mb-2" />
              <div className="space-y-1.5 mb-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={opt} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n) }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                    {options.length > 2 && (
                      <button onClick={() => setOptions(options.filter((_, j) => j !== i))}
                        className="text-slate-600 hover:text-red-400 text-sm transition-colors">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setOptions([...options, ''])} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">+ Add option</button>
                <button onClick={createPoll} disabled={creating || !question.trim() || options.filter(o => o.trim()).length < 2}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors">
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          )}
          <div className="p-3 space-y-2">
            {openPolls.length === 0 && !showCreate && <p className="text-xs text-slate-600 text-center py-2">No open polls.</p>}
            {openPolls.map(p => <PollCard key={p.id} poll={p} username={username} onVote={idx => vote(p.id, idx)} onClose={() => closePoll(p.id)} onDelete={() => deletePoll(p.id)} onlineUsers={onlineUsers} isAdmin={isAdmin} />)}
            {closedPolls.length > 0 && (
              <div>
                <button onClick={() => setClosedExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 w-full py-1 transition-colors">
                  <span>{closedExpanded ? '▼' : '▶'}</span> Closed ({closedPolls.length})
                </button>
                {closedExpanded && closedPolls.map(p => <PollCard key={p.id} poll={p} username={username} onVote={() => {}} onClose={() => {}} onDelete={() => deletePoll(p.id)} onlineUsers={[]} isAdmin={isAdmin} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PollCard({ poll, username, onVote, onClose, onDelete, onlineUsers, isAdmin }: {
  poll: Poll; username: string; onVote: (idx: number) => void; onClose: () => void; onDelete: () => void
  onlineUsers: string[]; isAdmin: boolean
}) {
  const myVote = poll.votes.find(v => v.voterName === username)
  const totalVotes = poll.votes.length
  const tallies = poll.options.map((_, i) => poll.votes.filter(v => v.optionIdx === i).length)
  const maxTally = Math.max(...tallies, 0)
  const isOpen = poll.status === 'OPEN'

  // Close button logic: show when all online users have voted, or admin override
  const voterNames = new Set(poll.votes.map(v => v.voterName))
  const waitingOn = onlineUsers.filter(u => !voterNames.has(u))
  const allVoted = waitingOn.length === 0 && onlineUsers.length > 0
  const canClose = allVoted || isAdmin

  return (
    <div className={`rounded-lg border p-3 ${isOpen
      ? 'border-slate-700/60 bg-slate-950/80 dark:border-slate-700/60 dark:bg-slate-950/80'
      : 'border-slate-800/40 bg-slate-900/40 dark:border-slate-800/40 dark:bg-slate-900/40 opacity-60'
    } poll-card`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded mb-1 ${isOpen ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200/60 dark:bg-slate-700/40 text-slate-500'}`}>
            {isOpen ? 'OPEN' : 'CLOSED'}
          </span>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{poll.question}</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 mt-0.5">{poll.createdBy} · {totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button
            onClick={onDelete}
            className="text-xs text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0 mt-0.5"
            title="Delete poll — discards all votes, no results sent"
          >
            ✕
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const count = tallies[i]
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isMine = myVote?.optionIdx === i
          const isWinner = !isOpen && count === maxTally && totalVotes > 0
          return (
            <button key={i} onClick={() => isOpen && onVote(i)} disabled={!isOpen}
              className={`w-full text-left rounded-lg border px-3 py-1.5 text-sm relative overflow-hidden transition-colors ${
                isMine
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                  : isWinner
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-300 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
              } ${isOpen ? 'cursor-pointer' : 'cursor-default'}`}>
              <div className={`absolute inset-y-0 left-0 opacity-20 rounded-l-lg ${isMine ? 'bg-emerald-400' : isWinner ? 'bg-emerald-400' : 'bg-slate-400 dark:bg-slate-500'}`}
                style={{ width: `${pct}%` }} />
              <div className="relative flex justify-between items-center">
                <span className="flex items-center gap-1.5">{isMine && <span className="text-emerald-500 dark:text-emerald-400 text-xs">✓</span>}{opt}</span>
                <span className="text-xs text-slate-500 dark:text-slate-600 shrink-0">{count}{pct > 0 ? ` (${pct}%)` : ''}</span>
              </div>
            </button>
          )
        })}
      </div>
      {poll.votes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {poll.votes.map(v => (
            <span key={v.voterName} className="text-xs bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-500 px-1.5 py-0.5 rounded-full">
              {v.voterName} → {poll.options[v.optionIdx] ?? '?'}
            </span>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
          {canClose ? (
            <button
              onClick={onClose}
              className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                allVoted
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-400 border border-amber-500/40'
              }`}
              title={allVoted ? 'All users have voted' : 'Admin override — not everyone has voted yet'}
            >
              {allVoted ? 'Complete Poll' : '⚠ Force Complete (override)'}
            </button>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-600">
              <span>Waiting for votes…</span>
              <span className="font-medium" title={`Waiting on: ${waitingOn.join(', ')}`}>
                {totalVotes}/{onlineUsers.length} voted
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentPage({ project }: { project: ProjectInfo }) {
  const [mounted, setMounted] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  const [view, setView] = useState<MainView>({ type: 'console' })
  const [pendingTasks, setPendingTasks] = useState(0)
  const [unvotedPolls, setUnvotedPolls] = useState(0)

  // Content lists
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>([])
  const [chaptersLoaded, setChaptersLoaded] = useState(false)
  const [charactersLoaded, setCharactersLoaded] = useState(false)
  const [worldLoaded, setWorldLoaded] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('dan-username')
    if (stored) setUsername(stored)
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.role === 'admin') setIsAdmin(true)
    })
  }, [])

  const fetchDocuments = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.slug}/documents`)
    if (res.ok) setDocuments(await res.json())
  }, [project.slug])

  const fetchPolls = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.slug}/polls`)
    if (res.ok) setPolls(await res.json())
  }, [project.slug])

  const fetchChapters = useCallback(async () => {
    const res = await fetch(`/api/chapters?projectSlug=${project.slug}`)
    if (res.ok) { setChapters(await res.json()); setChaptersLoaded(true) }
  }, [project.slug])

  const fetchCharacters = useCallback(async () => {
    const res = await fetch(`/api/characters?projectSlug=${project.slug}`)
    if (res.ok) { setCharacters(await res.json()); setCharactersLoaded(true) }
  }, [project.slug])

  const fetchWorld = useCallback(async () => {
    const res = await fetch(`/api/world?projectSlug=${project.slug}`)
    if (res.ok) { setWorldEntries(await res.json()); setWorldLoaded(true) }
  }, [project.slug])

  const postMessage = useCallback(async (content: string) => {
    await fetch(`/api/projects/${project.slug}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: username ?? 'System', content }),
    })
  }, [project.slug, username])

  useEffect(() => {
    fetchDocuments()
    fetchPolls()
    fetchChapters()
    fetchCharacters()
    fetchWorld()
    const interval = setInterval(fetchPolls, 10000)
    return () => clearInterval(interval)
  }, [fetchDocuments, fetchPolls, fetchChapters, fetchCharacters, fetchWorld])

  // Notification counts (pending tasks + unvoted polls)
  const fetchNotifications = useCallback(() => {
    fetch(`/api/projects/${project.slug}/notifications`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setPendingTasks(d.pendingTasks ?? 0); setUnvotedPolls(d.pendingPolls ?? 0) } })
      .catch(() => {})
  }, [project.slug])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Track online users at the page level (for poll voting gate)
  useEffect(() => {
    const fetchPresence = () => {
      fetch(`/api/projects/${project.slug}/presence`)
        .then(r => r.json())
        .then(data => setOnlineUsers(data.online ?? []))
        .catch(() => {})
    }
    fetchPresence()
    const interval = setInterval(fetchPresence, 5000)
    return () => clearInterval(interval)
  }, [project.slug])

  const showToast = (msg: string) => setToast(msg)

  // Create handlers
  const createChapter = async (title: string) => {
    const res = await fetch('/api/chapters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, projectSlug: project.slug }),
    })
    if (res.ok) {
      const chapter = await res.json()
      await fetchChapters()
      setView({ type: 'chapter', id: chapter.id })
    }
  }

  const createCharacter = async (name: string) => {
    const res = await fetch('/api/characters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, projectSlug: project.slug }),
    })
    if (res.ok) {
      const character = await res.json()
      await fetchCharacters()
      setView({ type: 'character', id: character.id })
    }
  }

  const createWorldEntry = async (name: string) => {
    const res = await fetch('/api/world', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: 'Location', projectSlug: project.slug }),
    })
    if (res.ok) {
      const entry = await res.json()
      await fetchWorld()
      setView({ type: 'world', id: entry.id })
    }
  }

  const reloadContext = async () => {
    setReloading(true)
    await fetchDocuments()
    const res = await fetch(`/api/projects/${project.slug}/agent/reload`, { method: 'POST' })
    const data = await res.json()
    showToast(data.message ?? 'Context reloaded.')
    setReloading(false)
  }

  // Current item for editors
  const selectedChapter = view.type === 'chapter' ? chapters.find(c => c.id === view.id) ?? null : null
  const selectedCharacter = view.type === 'character' ? characters.find(c => c.id === view.id) ?? null : null
  const selectedWorld = view.type === 'world' ? worldEntries.find(w => w.id === view.id) ?? null : null
  const selectedDoc = view.type === 'document' ? documents.find(d => d.key === view.key) ?? null : null

  if (!mounted) return null

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {!username && <UsernameModal onSave={name => { localStorage.setItem('dan-username', name); setUsername(name) }} />}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-200 truncate">{project.name}</h1>
          <p className="text-xs text-slate-600">
            Control Room
            {username && <span className="ml-2 text-emerald-500 font-medium">— {username}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle className="mr-2" />
          <button onClick={reloadContext} disabled={reloading}
            className="px-3 py-1.5 border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors disabled:opacity-40 whitespace-nowrap">
            {reloading ? 'Reloading…' : '↺ Reload Context'}
          </button>
          {view.type !== 'console' && (
            <button onClick={() => setView({ type: 'console' })}
              className="px-3 py-1.5 border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors whitespace-nowrap">
              ← Console
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          documents={documents}
          selectedView={view}
          onSelectDoc={key => setView({ type: 'document', key })}
          onSelectChapter={id => setView({ type: 'chapter', id })}
          onSelectCharacter={id => setView({ type: 'character', id })}
          onSelectWorld={id => setView({ type: 'world', id })}
          chapters={chapters}
          characters={characters}
          worldEntries={worldEntries}
          onCreateChapter={createChapter}
          onCreateCharacter={createCharacter}
          onCreateWorldEntry={createWorldEntry}
          chaptersLoading={!chaptersLoaded}
          charactersLoading={!charactersLoaded}
          worldLoading={!worldLoaded}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          {view.type === 'document' && selectedDoc && (
            <DocEditor key={selectedDoc.key} doc={selectedDoc} projectSlug={project.slug}
              onSaved={updated => { setDocuments(prev => prev.map(d => d.key === updated.key ? updated : d)); showToast(`"${updated.title}" saved.`) }}
              onBack={() => setView({ type: 'console' })} />
          )}
          {view.type === 'chapter' && selectedChapter && (
            <ChapterEditor key={selectedChapter.id} chapter={selectedChapter} username={username ?? 'Anonymous'}
              onSaved={updated => { setChapters(prev => prev.map(c => c.id === updated.id ? updated : c)); showToast('Chapter saved.') }}
              onBack={() => setView({ type: 'console' })} />
          )}
          {view.type === 'character' && selectedCharacter && (
            <CharacterEditor key={selectedCharacter.id} character={selectedCharacter}
              onSaved={updated => { setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c)); showToast('Character saved.') }}
              onBack={() => setView({ type: 'console' })} />
          )}
          {view.type === 'world' && selectedWorld && (
            <WorldEntryEditor key={selectedWorld.id} entry={selectedWorld}
              onSaved={updated => { setWorldEntries(prev => prev.map(w => w.id === updated.id ? updated : w)); showToast('Entry saved.') }}
              onBack={() => setView({ type: 'console' })} />
          )}
          {view.type === 'console' && (
            <>
              <ChatPanel
                projectSlug={project.slug}
                username={username ?? 'Anonymous'}
                onDocumentUpdated={fetchDocuments}
                onChapterUpdated={fetchChapters}
                onPollCreated={(poll) => {
                  if (poll) setPolls(prev => [...prev, poll])
                  fetchPolls()
                  fetchNotifications()
                }}
                onTaskAssigned={() => {
                  fetchNotifications()
                }}
              />
              {/* Pending counters */}
              <div className="shrink-0 px-3 py-2 border-t border-slate-800/60 flex gap-2">
                <Link href={`/projects/${project.slug}/polls`}
                  className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 group-hover:text-slate-400 transition-colors">◎</span>
                    <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">Polls</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${unvotedPolls > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                    {unvotedPolls > 0 ? `${unvotedPolls} pending` : '—'}
                  </span>
                </Link>
                <Link href={`/projects/${project.slug}/tasks`}
                  className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 group-hover:text-slate-400 transition-colors">✓</span>
                    <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">Tasks</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${pendingTasks > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                    {pendingTasks > 0 ? `${pendingTasks} pending` : '—'}
                  </span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
