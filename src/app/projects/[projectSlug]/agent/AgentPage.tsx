'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useMobileMenu } from '@/components/AppShell'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectMessage = { id: number; role: 'user' | 'assistant'; author: string; content: string; imageUrl?: string | null; fileName?: string | null; createdAt: string }
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
    <div className="w-64 h-full border-l border-slate-800/60 flex flex-col shrink-0 bg-slate-950 overflow-y-auto">
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

  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ msg: ProjectMessage; x: number; y: number } | null>(null)
  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string | null; isImage: boolean } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const lastIdRef = useRef<number>(0)
  const anchorIdRef = useRef<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.style.height = 'auto'
    inputRef.current.style.height = input ? Math.min(inputRef.current.scrollHeight, 120) + 'px' : 'auto'
  }, [input])

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const timer = setTimeout(() => window.addEventListener('mousedown', close), 0)
    return () => { clearTimeout(timer); window.removeEventListener('mousedown', close) }
  }, [ctxMenu])

  const deleteMessage = async (id: number) => {
    const res = await fetch(`/api/projects/${projectSlug}/messages/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== id))
    } else {
      const err = await res.json().catch(() => ({}))
      console.error('[deleteMessage] failed', res.status, err)
    }
  }

  const replyTo = (msg: ProjectMessage) => {
    const lines = msg.content.split('\n').map((l: string) => `> ${l}`).join('\n')
    setInput(`${lines}\n\n`)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const DANEEL = 'Daneel'
  const mentionCandidates = mentionQuery !== null
    ? [DANEEL, ...allUsers.filter(u => u !== username && u !== DANEEL)]
        .filter(u => u.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : []

  // Auto-scroll — anchor to first old message after loading older; scroll to bottom otherwise
  useEffect(() => {
    if (anchorIdRef.current !== null) {
      const el = document.getElementById(`msg-${anchorIdRef.current}`)
      el?.scrollIntoView({ block: 'start' })
      anchorIdRef.current = null
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, pendingFile])

  // Initial message load
  useEffect(() => {
    fetch(`/api/projects/${projectSlug}/messages`)
      .then(r => r.json())
      .then((msgs: ProjectMessage[]) => {
        setMessages(msgs)
        if (msgs.length > 0) lastIdRef.current = msgs[msgs.length - 1].id
        setHasMore(msgs.length >= 200)
      })
      .catch(() => {})
  }, [projectSlug])

  const loadOlder = async () => {
    if (loadingOlder || messages.length === 0) return
    setLoadingOlder(true)
    try {
      const oldest = messages[0].id
      const res = await fetch(`/api/projects/${projectSlug}/messages?beforeId=${oldest}`)
      if (!res.ok) { console.error('[loadOlder] HTTP error', res.status); return }
      const data = await res.json()
      const older: ProjectMessage[] = Array.isArray(data) ? data : []
      console.log('[loadOlder] beforeId:', oldest, '→ got', older.length, 'messages')
      if (older.length > 0) {
        anchorIdRef.current = messages[0].id
        setMessages(prev => [...older.filter(m => !prev.some(p => p.id === m.id)), ...prev])
      }
      setHasMore(older.length >= 50)
    } catch (e) { console.error('[loadOlder] error:', e) }
    finally { setLoadingOlder(false) }
  }

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
            if (newOnes.length === 0) return prev
            // Retire any optimistic temps now confirmed by a real message
            const withoutStaleTemps = prev.filter(m =>
              m.id >= 0 || !newOnes.some(r => r.author === m.author && r.content === m.content)
            )
            return [...withoutStaleTemps, ...newOnes]
          })
          lastIdRef.current = fresh[fresh.length - 1].id
          if (fresh.some(m => m.author === DANEEL)) setThinking(false)
        }
      } catch {}
    }, 1000)
    return () => clearInterval(interval)
  }, [projectSlug])

  // Heartbeat — mark this user as online (only when username is known)
  useEffect(() => {
    if (!username?.trim()) return
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    updateMentionQuery(val, e.target.selectionStart ?? val.length)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const attachFile = (file: File) => {
    const isImage = file.type.startsWith('image/')
    const preview = isImage ? URL.createObjectURL(file) : null
    setPendingFile({ file, preview, isImage })
    inputRef.current?.focus()
  }

  const send = async () => {
    const text = input.trim()
    if (!text && !pendingFile || sending) return
    setInput('')
    setMentionQuery(null)
    setSending(true)
    if (inputRef.current) { inputRef.current.style.height = 'auto' }

    // Optimistic insert — appears instantly
    const capturedFile = pendingFile
    setPendingFile(null)
    const tempId = -Date.now()
    setMessages(prev => [...prev, {
      id: tempId, role: 'user' as const, author: username,
      content: text,
      imageUrl: capturedFile?.preview ?? null,
      fileName: capturedFile?.file.name ?? null,
      createdAt: new Date().toISOString(),
    }])

    let imageUrl: string | null = null
    let fileName: string | null = null
    if (capturedFile) {
      const fd = new FormData()
      fd.append('file', capturedFile.file)
      try {
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upData = await up.json()
        imageUrl = upData.url ?? null
        fileName = upData.name ?? capturedFile.file.name ?? null
      } catch {}
    }

    const mentionsDaneel = /@daneel\b/i.test(text)
    if (mentionsDaneel) setThinking(true)

    try {
      const res = await fetch(`/api/projects/${projectSlug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: username, content: text, imageUrl, fileName }),
      })
      const data = await res.json()
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId)
        const existingIds = new Set(withoutTemp.map(m => m.id))
        const toAdd = [data.message, data.aiMessage].filter(m => m && !existingIds.has(m.id))
        return toAdd.length > 0 ? [...withoutTemp, ...toAdd] : withoutTemp
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
    }
  }

  // All known participants including Daneel (always shown)
  const allParticipants = [DANEEL, ...allUsers.filter(u => u !== DANEEL)]

  const searchResults = searchQuery.trim().length > 0
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  const highlightSnippet = (content: string, query: string) => {
    const idx = content.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <span>{content.slice(0, 120)}</span>
    const start = Math.max(0, idx - 40)
    const end = Math.min(content.length, idx + query.length + 80)
    return (
      <span>
        {start > 0 && '…'}{content.slice(start, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded px-0.5">{content.slice(idx, idx + query.length)}</mark>
        {content.slice(idx + query.length, end)}{end < content.length && '…'}
      </span>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Search panel */}
      {searchOpen && (
        <div className="w-72 shrink-0 flex flex-col border-r border-slate-700/60 bg-slate-900 z-10">
          <div className="px-3 py-2.5 border-b border-slate-700/60 flex items-center gap-2">
            <span className="text-slate-500 text-sm">🔍</span>
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="flex-1 text-sm bg-transparent text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="text-slate-500 hover:text-slate-200 transition-colors text-lg leading-none">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchQuery.trim() === '' && (
              <p className="text-xs text-slate-600 text-center mt-8 px-4">Type to search messages</p>
            )}
            {searchQuery.trim() !== '' && searchResults.length === 0 && (
              <p className="text-xs text-slate-600 text-center mt-8 px-4">No messages found</p>
            )}
            {searchResults.map(msg => {
              const raw = msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z'
              const time = new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              return (
                <button
                  key={msg.id}
                  onClick={() => {
                    const el = document.getElementById(`msg-${msg.id}`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el?.classList.add('ring-2', 'ring-emerald-400', 'rounded-2xl')
                    setTimeout(() => el?.classList.remove('ring-2', 'ring-emerald-400', 'rounded-2xl'), 1500)
                  }}
                  className="w-full text-left px-3 py-2.5 border-b border-slate-800 hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-300">{msg.author}</span>
                    <span className="text-[10px] text-slate-600">{time}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {highlightSnippet(msg.content, searchQuery)}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

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
        <button onClick={() => setSearchOpen(o => !o)} title="Search messages" className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${searchOpen ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>Search</button>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} data-no-squish className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-[#eae6df] dark:bg-[#17212b]">
        {hasMore && (
          <div className="flex justify-center pt-1 pb-3">
            <button onClick={loadOlder} disabled={loadingOlder}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-40">
              {loadingOlder ? 'Loading…' : '↑ Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && !thinking && (
          <div className="text-center mt-10">
            <p className="text-3xl mb-2 text-emerald-500">⬡</p>
            <p className="text-sm text-slate-500">No messages yet. Say hi, or @Daneel to get started.</p>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.author === username
          const isDaneel = msg.author === DANEEL
          const raw = msg.createdAt.endsWith('Z') ? msg.createdAt : msg.createdAt + 'Z'
          const time = new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ msg, x: e.clientX, y: e.clientY }) }}
                className={`max-w-[75%] px-3.5 py-2 text-sm shadow-sm cursor-default select-text ${
                  isMe
                    ? 'bg-[#effdde] dark:bg-[#2b5278] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tr-sm'
                    : 'bg-white dark:bg-[#182533] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-sm'
                }`}>
                {!isMe && (
                  <p className={`text-xs mb-0.5 font-semibold ${isDaneel ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {msg.author}
                  </p>
                )}
                {msg.imageUrl && (msg.fileName && !msg.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mb-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm text-slate-700 dark:text-slate-200 max-w-xs">
                    <span className="text-lg shrink-0">📄</span>
                    <span className="truncate font-medium">{msg.fileName}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-auto">↓</span>
                  </a>
                ) : (
                  <img src={msg.imageUrl} alt={msg.fileName ?? 'attachment'} className="rounded-xl max-w-full max-h-64 object-contain mb-1 cursor-pointer" onClick={() => window.open(msg.imageUrl!, '_blank')} />
                ))}
                <div className="flex items-end gap-3">
                  {msg.content && <p className="whitespace-pre-wrap leading-relaxed flex-1">{renderContent(msg.content)}</p>}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 leading-none mb-0.5">{time}</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Context menu */}
        {ctxMenu && (() => {
          const menuW = 192, menuH = 140
          const x = ctxMenu.x + menuW > window.innerWidth ? ctxMenu.x - menuW : ctxMenu.x
          const y = ctxMenu.y + menuH > window.innerHeight ? ctxMenu.y - menuH : ctxMenu.y
          return (
            <div
              className="fixed z-50 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 py-1.5 w-48"
              style={{ left: x, top: y }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              {[
                { label: '↩ Reply', action: () => { replyTo(ctxMenu.msg); setCtxMenu(null) } },
                { label: '⎘ Copy Text', action: () => { navigator.clipboard.writeText(ctxMenu.msg.content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim()); setCtxMenu(null) } },
                ...(ctxMenu.msg.author === username ? [{ label: '🗑 Delete', action: () => { deleteMessage(ctxMenu.msg.id); setCtxMenu(null) }, danger: true }] : []),
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${(item as { danger?: boolean }).danger ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          )
        })()}

        {thinking && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#182533] rounded-2xl rounded-tl-sm shadow-sm px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100">
              <p className="text-emerald-600 dark:text-emerald-400 text-xs mb-0.5 font-semibold">Daneel</p>
              <span className="flex gap-1 items-center py-0.5">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950 shrink-0 relative">
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

        {pendingFile && (
          <div className="mb-2 flex items-start gap-2">
            <div className="relative">
              {pendingFile.isImage && pendingFile.preview
                ? <img src={pendingFile.preview} alt="preview" className="rounded-xl max-h-32 max-w-48 object-contain border border-slate-200 dark:border-slate-700" />
                : <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-sm text-slate-700 dark:text-slate-200 max-w-48"><span className="text-lg">📄</span><span className="truncate">{pendingFile.file.name}</span></div>
              }
              <button onClick={() => setPendingFile(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-700 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500 transition-colors">✕</button>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) attachFile(f); e.target.value = '' }} />
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            title="Attach file"
            className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-base hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shrink-0"
          >
            📎
          </button>
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
            className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-emerald-500 dark:text-emerald-400 rounded-lg text-base hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-emerald-500/40 disabled:opacity-40 transition-colors shrink-0"
          >
            ⬡
          </button>
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={e => {
              const file = Array.from(e.clipboardData.files)[0]
              if (file) { e.preventDefault(); attachFile(file) }
            }}
            onClick={e => updateMentionQuery(input, (e.target as HTMLTextAreaElement).selectionStart ?? input.length)}
            placeholder="Message…"
            className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none overflow-hidden leading-relaxed"
          />
          <button
            onClick={send}
            disabled={(!input.trim() && !pendingFile) || sending}
            className="w-10 h-10 flex items-center justify-center bg-emerald-600 text-white rounded-lg text-base font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors shrink-0"
          >
            {sending ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentPage({ project }: { project: ProjectInfo }) {
  const { toggle: toggleNav } = useMobileMenu()
  const [docSidebarOpen, setDocSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  )
  const [mounted, setMounted] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  const [view, setView] = useState<MainView>({ type: 'console' })
  const [pendingTasks, setPendingTasks] = useState(0)
  const [unvotedPolls, setUnvotedPolls] = useState(0)
  const [clockTime, setClockTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClockTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Content lists
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>([])
  const [chaptersLoaded, setChaptersLoaded] = useState(false)
  const [charactersLoaded, setCharactersLoaded] = useState(false)
  const [worldLoaded, setWorldLoaded] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.username) {
        setUsername(d.username)
        localStorage.setItem('dan-username', d.username)
      }
      setAuthLoaded(true)
    })
  }, [])

  const fetchDocuments = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.slug}/documents`)
    if (res.ok) setDocuments(await res.json())
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

  useEffect(() => {
    fetchDocuments()
    fetchChapters()
    fetchCharacters()
    fetchWorld()
  }, [fetchDocuments, fetchChapters, fetchCharacters, fetchWorld])

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
    <div className="flex flex-1 min-h-0 bg-slate-950 overflow-hidden">
      {authLoaded && !username && <UsernameModal onSave={name => { localStorage.setItem('dan-username', name); setUsername(name) }} />}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Main area (header + content) — pushed left on mobile when doc sidebar opens */}
      <div className={`flex flex-col flex-1 min-h-0 overflow-hidden transition-transform duration-200 ease-in-out ${docSidebarOpen ? '-translate-x-64 lg:translate-x-0' : 'translate-x-0'}`}>

      {/* Header */}
      <div className="relative z-50 px-4 h-16 border-b border-slate-800/60 shrink-0 flex items-center gap-3">
        <button onClick={toggleNav} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0 text-base">☰</button>
        <h1 className="text-sm font-semibold text-slate-200 truncate">{project.name}</h1>
        {username && <span className="text-xs text-slate-600 hidden sm:inline">— {username}</span>}
        {clockTime && (() => {
          const is420 = /^(0?4|16):20/.test(clockTime)
          return (
            <div className={`hidden sm:block px-3 py-1 rounded-lg border font-mono text-sm tabular-nums tracking-widest transition-all duration-700 ${
              is420
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_2px_rgba(16,185,129,0.25)]'
                : 'border-slate-700/60 bg-slate-900/60 text-slate-400'
            }`}>{clockTime}</div>
          )
        })()}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button onClick={reloadContext} disabled={reloading}
            className="w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 flex items-center justify-center border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors disabled:opacity-40">
            ↺<span className="hidden sm:inline ml-1">{reloading ? 'Reloading…' : 'Reload Context'}</span>
          </button>
          {view.type !== 'console' && (
            <button onClick={() => { setView({ type: 'console' }); setDocSidebarOpen(true) }}
              className="w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 flex items-center justify-center border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors">
              ←<span className="hidden sm:inline ml-1">Console</span>
            </button>
          )}
          <button onClick={() => setDocSidebarOpen(v => !v)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors text-base ${docSidebarOpen ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
            title="Toggle documents">
            📄
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {view.type === 'document' && selectedDoc && (
          <DocEditor key={selectedDoc.key} doc={selectedDoc} projectSlug={project.slug}
            onSaved={updated => { setDocuments(prev => prev.map(d => d.key === updated.key ? updated : d)); showToast(`"${updated.title}" saved.`) }}
            onBack={() => { setView({ type: 'console' }); if (window.innerWidth >= 1024) setDocSidebarOpen(true) }} />
        )}
        {view.type === 'chapter' && selectedChapter && (
          <ChapterEditor key={selectedChapter.id} chapter={selectedChapter} username={username ?? 'Anonymous'}
            onSaved={updated => { setChapters(prev => prev.map(c => c.id === updated.id ? updated : c)); showToast('Chapter saved.') }}
            onBack={() => { setView({ type: 'console' }); if (window.innerWidth >= 1024) setDocSidebarOpen(true) }} />
        )}
        {view.type === 'character' && selectedCharacter && (
          <CharacterEditor key={selectedCharacter.id} character={selectedCharacter}
            onSaved={updated => { setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c)); showToast('Character saved.') }}
            onBack={() => { setView({ type: 'console' }); if (window.innerWidth >= 1024) setDocSidebarOpen(true) }} />
        )}
        {view.type === 'world' && selectedWorld && (
          <WorldEntryEditor key={selectedWorld.id} entry={selectedWorld}
            onSaved={updated => { setWorldEntries(prev => prev.map(w => w.id === updated.id ? updated : w)); showToast('Entry saved.') }}
            onBack={() => { setView({ type: 'console' }); if (window.innerWidth >= 1024) setDocSidebarOpen(true) }} />
        )}
        {view.type === 'console' && (
          <>
            <ChatPanel
              projectSlug={project.slug}
              username={username ?? 'Anonymous'}
              onDocumentUpdated={fetchDocuments}
              onChapterUpdated={fetchChapters}
              onPollCreated={() => { fetchNotifications() }}
              onTaskAssigned={() => { fetchNotifications() }}
            />
            {/* Pending counters */}
            <div className="shrink-0 px-3 py-2 border-t border-slate-800/60 flex gap-2">
              <Link href={`/projects/${project.slug}/polls`}
                className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 group-hover:text-slate-400 transition-colors">◎</span>
                  <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">Polls</span>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${unvotedPolls === 0 ? 'text-slate-600' : unvotedPolls >= 10 ? 'text-red-400' : 'text-amber-400'}`}>
                  {unvotedPolls > 0 ? `${unvotedPolls} pending` : '—'}
                </span>
              </Link>
              <Link href={`/projects/${project.slug}/tasks`}
                className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 transition-colors group">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 group-hover:text-slate-400 transition-colors">✓</span>
                  <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">Tasks</span>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${pendingTasks === 0 ? 'text-slate-600' : pendingTasks >= 10 ? 'text-red-400' : 'text-amber-400'}`}>
                  {pendingTasks > 0 ? `${pendingTasks} pending` : '—'}
                </span>
              </Link>
            </div>
          </>
        )}
      </div>

      </div>{/* end translated wrapper */}

      {/* Doc sidebar — sibling of translated wrapper, slides in from right */}
      <div className={`
        fixed lg:static inset-y-0 right-0 z-40 shrink-0 lg:h-full
        transition-transform duration-200 ease-in-out
        ${docSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:hidden'}
      `}>
        <Sidebar
          documents={documents}
          selectedView={view}
          onSelectDoc={key => { setView({ type: 'document', key }); setDocSidebarOpen(false) }}
          onSelectChapter={id => { setView({ type: 'chapter', id }); setDocSidebarOpen(false) }}
          onSelectCharacter={id => { setView({ type: 'character', id }); setDocSidebarOpen(false) }}
          onSelectWorld={id => { setView({ type: 'world', id }); setDocSidebarOpen(false) }}
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
      </div>
    </div>
  )
}
