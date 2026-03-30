'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useMobileMenu } from '@/components/AppShell'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectMessage = { id: number; role: 'user' | 'assistant'; author: string; content: string; imageUrl?: string | null; fileName?: string | null; isPinned: boolean; createdAt: string }
type ProjectInfo = { id: number; name: string; slug: string; description: string; type: string }
type ProjectDocument = { id: number; key: string; title: string; content: string; updatedAt: string }
type Poll = {
  id: number; question: string; options: string[]; createdBy: string
  status: 'OPEN' | 'CLOSED'; createdAt: string
  votes: Array<{ voterName: string; optionIdx: number }>
}
type Chapter = { id: string; title: string; content: string; order: number; updatedAt: string }
type Character = { id: string; name: string; role: string; description: string; notes: string; traits: string[] }
type WorldEntry = { id: string; name: string; type: string; description: string; notes: string; updatedAt: string }
type ProjectImage = { id: string; imageType: string; title: string; filename: string; url: string; createdAt: string }

type MainView =
  | { type: 'console' }
  | { type: 'document'; key: string }
  | { type: 'chapter'; id: string }
  | { type: 'character'; id: string }
  | { type: 'world'; id: string }
  | { type: 'gallery'; imageType: 'concept_art' | 'map' }

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

function Toast({ message, onDismiss, showClose }: { message: string; onDismiss: () => void; showClose?: boolean }) {
  useEffect(() => {
    if (showClose) return
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss, showClose])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-3">
      <span>{message}</span>
      {showClose && (
        <button onClick={onDismiss} className="text-white/70 hover:text-white text-base leading-none ml-1" aria-label="Dismiss">✕</button>
      )}
    </div>
  )
}

function ConfirmToast({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-slate-200 text-sm px-4 py-3 rounded-lg shadow-xl z-50 flex items-center gap-3">
      <span>{message}</span>
      <button onClick={onConfirm} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-semibold transition-colors">Reset</button>
      <button onClick={onCancel} className="text-white/70 hover:text-white text-base leading-none" aria-label="Cancel">✕</button>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type CtxMenuItem = { label: string; action: () => void; danger?: boolean }

function SidebarSection({
  label, items, selectedId, onSelect, onCreate, createPlaceholder, loading, getContextMenu, onImportFile
}: {
  label: string
  items: Array<{ id: string; label: string; sub?: string }>
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  createPlaceholder: string
  loading?: boolean
  getContextMenu?: (id: string, idx: number) => CtxMenuItem[]
  onImportFile?: (title: string, file: File) => void
}) {
  const [open, setOpen] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [importMode, setImportMode] = useState(false)
  const [importTitle, setImportTitle] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const timer = setTimeout(() => window.addEventListener('mousedown', close), 0)
    return () => { clearTimeout(timer); window.removeEventListener('mousedown', close) }
  }, [ctxMenu])

  const submit = () => {
    if (!newName.trim()) return
    onCreate(newName.trim())
    setNewName('')
    setCreating(false)
  }

  const submitImport = () => {
    if (!importFile) return
    const title = importTitle.trim() || importFile.name.replace(/\.[^.]+$/, '')
    onImportFile!(title, importFile)
    setImportMode(false)
    setImportTitle('')
    setImportFile(null)
  }

  return (
    <div className="border-t border-slate-800/60 first:border-t-0">
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors">
          <span>{open ? '▼' : '▶'}</span>{label}
        </button>
        {open && (
          <button onClick={() => { setCreating(v => !v); setImportMode(false) }}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
            {creating || importMode ? '✕' : '+'}
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
              {onImportFile && (
                <button onClick={() => { setCreating(false); setImportMode(true) }}
                  className="text-xs text-slate-500 hover:text-slate-300 px-1" title="Import from file">📄</button>
              )}
            </div>
          )}
          {importMode && onImportFile && (
            <div className="px-3 pb-3 space-y-1.5">
              <input
                value={importTitle}
                onChange={e => setImportTitle(e.target.value)}
                placeholder={createPlaceholder}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <input ref={fileInputRef} type="file" accept=".txt,.md,.markdown,.pdf,.png,.jpg,.jpeg,.webp"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  setImportFile(f)
                  if (f && !importTitle) setImportTitle(f.name.replace(/\.[^.]+$/, ''))
                }}
                className="hidden" />
              <div className="flex gap-1">
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-1 rounded border border-slate-700 text-[10px] text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors truncate">
                  {importFile ? importFile.name : 'Choose file…'}
                </button>
                <button onClick={submitImport} disabled={!importFile}
                  className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-40 px-1">↵</button>
                <button onClick={() => { setImportMode(false); setImportFile(null); setImportTitle('') }}
                  className="text-xs text-slate-600 hover:text-slate-400 px-1">✕</button>
              </div>
            </div>
          )}
          {loading && <p className="text-xs text-slate-600 px-3 pb-2">Loading…</p>}
          <nav className="space-y-0.5 px-2 pb-2">
            {items.map((item, idx) => (
              <div key={item.id}>
                {renaming?.id === item.id ? (
                  <div className="px-1 py-0.5 flex gap-1">
                    <input
                      autoFocus
                      value={renaming.value}
                      onChange={e => setRenaming({ id: item.id, value: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const menuItem = getContextMenu?.(item.id, idx).find(m => m.label.startsWith('✏'))
                          // trigger the rename save via context menu's stored action with new value
                          // We find the rename action from the menu and call it with updated value
                          setRenaming(null)
                        }
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                      onBlur={() => setRenaming(null)}
                      className="flex-1 bg-slate-800 border border-emerald-500/50 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => onSelect(item.id)}
                    onContextMenu={e => {
                      if (!getContextMenu) return
                      e.preventDefault()
                      e.stopPropagation()
                      setCtxMenu({ id: item.id, x: e.clientX, y: e.clientY })
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedId === item.id
                        ? 'bg-emerald-600/15 text-emerald-300'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}>
                    <span className="block truncate">{item.label}</span>
                    {item.sub && <span className="text-[10px] text-slate-600">{item.sub}</span>}
                  </button>
                )}
              </div>
            ))}
          </nav>
        </>
      )}

      {/* Context menu — rendered via portal to escape CSS transform containing block */}
      {ctxMenu && getContextMenu && typeof document !== 'undefined' && createPortal((() => {
        const idx = items.findIndex(i => i.id === ctxMenu.id)
        const menuItems = getContextMenu(ctxMenu.id, idx)
        const menuH = menuItems.length * 36 + 8
        const x = ctxMenu.x + 192 > window.innerWidth ? ctxMenu.x - 192 : ctxMenu.x
        const y = ctxMenu.y + menuH > window.innerHeight ? ctxMenu.y - menuH : ctxMenu.y
        return (
          <div
            className="fixed z-[9999] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1.5 w-48"
            style={{ left: x, top: y }}
            onMouseDown={e => e.stopPropagation()}
          >
            {menuItems.map(item => (
              <button
                key={item.label}
                onClick={() => { item.action(); setCtxMenu(null) }}
                className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-700/60 transition-colors ${item.danger ? 'text-red-400' : 'text-slate-200'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )
      })(), document.body)}
    </div>
  )
}

function GallerySection({ label, projectSlug, imageType, onOpen }: {
  label: string
  projectSlug: string
  imageType: 'concept_art' | 'map'
  onOpen?: () => void
}) {
  const [open, setOpen] = useState(true)
  const [images, setImages] = useState<ProjectImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const handler = () => setCtxMenu(null)
    window.addEventListener('click', handler)
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setCtxMenu(null) })
    return () => window.removeEventListener('click', handler)
  }, [ctxMenu])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    fetch(`/api/projects/${projectSlug}/images?type=${imageType}`)
      .then(r => r.ok ? r.json() : [])
      .then(setImages)
      .catch(() => {})
  }, [projectSlug, imageType])

  useEffect(() => {
    if (lightboxIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null)
      if (e.key === 'ArrowLeft') setLightboxIdx(i => i !== null && i > 0 ? i - 1 : i)
      if (e.key === 'ArrowRight') setLightboxIdx(i => i !== null && i < images.length - 1 ? i + 1 : i)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIdx, images.length])

  const upload = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('imageType', imageType)
    fd.append('title', file.name.replace(/\.[^.]+$/, ''))
    try {
      const res = await fetch(`/api/projects/${projectSlug}/images`, { method: 'POST', body: fd })
      if (res.ok) { const img = await res.json(); setImages(prev => [...prev, img]) }
    } catch { /* no-op */ }
    setUploading(false)
  }

  const deleteImage = async (id: string, idx: number) => {
    await fetch(`/api/projects/${projectSlug}/images/${id}`, { method: 'DELETE' })
    setImages(prev => prev.filter(i => i.id !== id))
    if (lightboxIdx !== null) {
      if (lightboxIdx === idx) setLightboxIdx(null)
      else if (lightboxIdx > idx) setLightboxIdx(lightboxIdx - 1)
    }
  }

  const generate = async () => {
    const prompt = generatePrompt.trim()
    if (!prompt) return
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch(`/api/projects/${projectSlug}/images/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageType, title: prompt.slice(0, 60) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed.' }))
        setGenerateError(err.error ?? 'Generation failed.')
      } else {
        const img = await res.json()
        setImages(prev => [...prev, img])
        setGeneratePrompt('')
        setGenerateOpen(false)
      }
    } catch {
      setGenerateError('Network error.')
    }
    setGenerating(false)
  }

  const lightbox = lightboxIdx !== null && mounted && typeof document !== 'undefined' ? createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
      onClick={() => setLightboxIdx(null)}
    >
      <button
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white text-xl transition-colors"
        onClick={() => setLightboxIdx(null)}
      >✕</button>
      {lightboxIdx > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white text-4xl transition-colors"
          onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i - 1 : i) }}
        >‹</button>
      )}
      {lightboxIdx < images.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white text-4xl transition-colors"
          onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i + 1 : i) }}
        >›</button>
      )}
      <div
        className="flex flex-col items-center gap-3 px-16"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={images[lightboxIdx].url}
          alt={images[lightboxIdx].title}
          className="max-h-[82vh] max-w-[88vw] object-contain rounded-lg shadow-2xl"
        />
        {images[lightboxIdx].title && (
          <p className="text-slate-300 text-sm">{images[lightboxIdx].title}</p>
        )}
        <p className="text-slate-600 text-[10px]">{lightboxIdx + 1} / {images.length}</p>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="border-t border-slate-800/60">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setOpen(v => !v)}
          onContextMenu={e => { if (!onOpen) return; e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
          <span>{open ? '▼' : '▶'}</span>{label}
        </button>
        {open && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setGenerateOpen(v => !v); setGenerateError('') }}
              disabled={generating}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium disabled:opacity-40"
              title="Generate with AI"
            >✦</button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium disabled:opacity-40"
              title="Upload image"
            >+</button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) { upload(f); e.target.value = '' }
        }}
      />

      {open && (
        <div className="px-2 pb-2">
          {generateOpen && (
            <div className="mb-2 space-y-1">
              <input
                ref={promptInputRef}
                autoFocus
                value={generatePrompt}
                onChange={e => setGeneratePrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') generate(); if (e.key === 'Escape') { setGenerateOpen(false); setGenerateError('') } }}
                placeholder="Describe the image…"
                disabled={generating}
                className="w-full bg-slate-800 border border-violet-500/30 rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
              />
              {generateError && <p className="text-[10px] text-red-400 px-1">{generateError}</p>}
              <div className="flex gap-1">
                <button
                  onClick={generate}
                  disabled={generating || !generatePrompt.trim()}
                  className="flex-1 py-1 rounded bg-violet-600/20 border border-violet-500/30 text-[10px] text-violet-300 hover:bg-violet-600/30 disabled:opacity-40 transition-colors"
                >
                  {generating ? 'Generating…' : '✦ Generate'}
                </button>
                <button
                  onClick={() => { setGenerateOpen(false); setGenerateError(''); setGeneratePrompt('') }}
                  className="px-2 py-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                >✕</button>
              </div>
            </div>
          )}
          {images.length === 0 && !uploading && !generating && !generateOpen && (
            <p className="text-[10px] text-slate-600 px-1 pb-1">No images yet — ✦ generate or + upload</p>
          )}
          {(uploading || generating) && (
            <p className="text-[10px] text-slate-500 px-1 pb-1 animate-pulse">{generating ? 'Generating…' : 'Uploading…'}</p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {images.map((img, idx) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-lg overflow-hidden bg-slate-800 cursor-pointer"
                onClick={() => setLightboxIdx(idx)}
              >
                <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors" />
                <p className="absolute bottom-0 inset-x-0 px-1.5 py-1 text-[9px] text-white opacity-0 group-hover:opacity-90 transition-opacity truncate leading-tight">
                  {img.title}
                </p>
                <button
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-[9px] text-white/0 group-hover:text-white/70 hover:!text-white hover:bg-red-600/80 transition-colors"
                  onClick={e => { e.stopPropagation(); deleteImage(img.id, idx) }}
                  title="Delete"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {lightbox}

      {ctxMenu && onOpen && mounted && createPortal(
        <div
          style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 9999 }}
          className="min-w-[140px] rounded-lg border border-slate-700/60 bg-slate-900 shadow-xl py-1"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            onClick={() => { onOpen(); setCtxMenu(null) }}
          >→ Open in view</button>
        </div>,
        document.body
      )}
    </div>
  )
}

function Sidebar({
  documents, selectedView, onSelectDoc, onSelectChapter, onSelectCharacter, onSelectWorld,
  chapters, characters, worldEntries,
  onCreateChapter, onCreateCharacter, onCreateWorldEntry,
  onRenameChapter, onDeleteChapter, onMoveChapter, onDuplicateChapter,
  onRenameCharacter, onDeleteCharacter,
  onRenameWorld, onDeleteWorld,
  chaptersLoading, charactersLoading, worldLoading,
  projectType, projectSlug, onImportFile, onOpenGallery,
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
  onRenameChapter: (id: string, title: string) => void
  onDeleteChapter: (id: string) => void
  onMoveChapter: (id: string, direction: 'up' | 'down' | number) => void
  onDuplicateChapter: (id: string) => void
  onRenameCharacter: (id: string, name: string) => void
  onDeleteCharacter: (id: string) => void
  onRenameWorld: (id: string, name: string) => void
  onDeleteWorld: (id: string) => void
  chaptersLoading: boolean
  charactersLoading: boolean
  worldLoading: boolean
  projectType: string
  projectSlug: string
  onImportFile?: (title: string, file: File) => void
  onOpenGallery?: (imageType: 'concept_art' | 'map') => void
}) {
  const selectedDocKey = selectedView.type === 'document' ? selectedView.key : null
  const selectedChapterId = selectedView.type === 'chapter' ? selectedView.id : null
  const selectedCharacterId = selectedView.type === 'character' ? selectedView.id : null
  const selectedWorldId = selectedView.type === 'world' ? selectedView.id : null

  const [docsOpen, setDocsOpen] = useState(true)
  const [renamePrompt, setRenamePrompt] = useState<{ id: string; current: string; type: 'chapter' | 'character' | 'world' } | null>(null)
  const [positionPrompt, setPositionPrompt] = useState<{ id: string; current: number; total: number } | null>(null)
  const [positionValue, setPositionValue] = useState('')
  const [renameValue, setRenameValue] = useState('')

  const chapterContextMenu = (id: string, idx: number): CtxMenuItem[] => [
    { label: '✏ Rename', action: () => { setRenameValue(chapters[idx]?.title ?? ''); setRenamePrompt({ id, current: chapters[idx]?.title ?? '', type: 'chapter' }) } },
    ...(idx > 0 ? [{ label: '↑ Move Up', action: () => onMoveChapter(id, 'up') }] : []),
    ...(idx < chapters.length - 1 ? [{ label: '↓ Move Down', action: () => onMoveChapter(id, 'down') }] : []),
    { label: '# Set Position', action: () => { setPositionValue(String(idx + 1)); setPositionPrompt({ id, current: idx + 1, total: chapters.length }) } },
    { label: '⎘ Duplicate', action: () => onDuplicateChapter(id) },
    { label: '🗑 Delete', action: () => onDeleteChapter(id), danger: true },
  ]

  const characterContextMenu = (id: string, idx: number): CtxMenuItem[] => [
    { label: '✏ Rename', action: () => { setRenameValue(characters[idx]?.name ?? ''); setRenamePrompt({ id, current: characters[idx]?.name ?? '', type: 'character' }) } },
    { label: '🗑 Delete', action: () => onDeleteCharacter(id), danger: true },
  ]

  const worldContextMenu = (id: string, idx: number): CtxMenuItem[] => [
    { label: '✏ Rename', action: () => { setRenameValue(worldEntries[idx]?.name ?? ''); setRenamePrompt({ id, current: worldEntries[idx]?.name ?? '', type: 'world' }) } },
    { label: '🗑 Delete', action: () => onDeleteWorld(id), danger: true },
  ]

  const submitRename = () => {
    if (!renamePrompt || !renameValue.trim()) { setRenamePrompt(null); return }
    if (renamePrompt.type === 'chapter') onRenameChapter(renamePrompt.id, renameValue.trim())
    else if (renamePrompt.type === 'character') onRenameCharacter(renamePrompt.id, renameValue.trim())
    else onRenameWorld(renamePrompt.id, renameValue.trim())
    setRenamePrompt(null)
  }

  const submitPosition = () => {
    if (!positionPrompt) return
    const pos = parseInt(positionValue)
    if (!isNaN(pos) && pos >= 1 && pos <= positionPrompt.total) {
      onMoveChapter(positionPrompt.id, pos - 1)
    }
    setPositionPrompt(null)
  }

  return (
    <div className="w-64 h-full border-l border-slate-800/60 flex flex-col shrink-0 bg-slate-950 overflow-y-auto">

      {/* Rename modal */}
      {renamePrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onMouseDown={() => setRenamePrompt(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-72 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-semibold">Rename</p>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenamePrompt(null) }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenamePrompt(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              <button onClick={submitRename} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Set position modal */}
      {positionPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onMouseDown={() => setPositionPrompt(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-64 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Move to {projectType === 'campaign' ? 'Part' : 'Chapter'} #</p>
            <p className="text-[10px] text-slate-600 mb-3">1 – {positionPrompt.total}</p>
            <input
              autoFocus
              type="number"
              min={1}
              max={positionPrompt.total}
              value={positionValue}
              onChange={e => setPositionValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitPosition(); if (e.key === 'Escape') setPositionPrompt(null) }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPositionPrompt(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              <button onClick={submitPosition} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors">Move</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Chapters / Parts */}
      <SidebarSection
        label={projectType === 'campaign' ? 'Parts' : 'Chapters'}
        items={(() => {
          const isCampaign = projectType === 'campaign'
          let num = 0
          return chapters.map(c => {
            const isPrologue = /^prologue$/i.test(c.title.trim())
            if (!isPrologue) num++
            const position = isPrologue ? 'Prologue' : isCampaign ? `Part ${num}` : `Ch. ${num}`
            return { id: c.id, label: c.title, sub: `${position} · ${timeAgo(c.updatedAt)}` }
          })
        })()}
        selectedId={selectedChapterId}
        onSelect={onSelectChapter}
        onCreate={onCreateChapter}
        onImportFile={projectType !== 'campaign' ? onImportFile : undefined}
        createPlaceholder={projectType === 'campaign' ? 'Part title…' : 'Chapter title…'}
        loading={chaptersLoading}
        getContextMenu={chapterContextMenu}
      />

      {/* Characters / NPCs */}
      <SidebarSection
        label={projectType === 'campaign' ? 'NPCs' : 'Characters'}
        items={characters.map(c => ({ id: c.id, label: c.name, sub: c.role || undefined }))}
        selectedId={selectedCharacterId}
        onSelect={onSelectCharacter}
        onCreate={onCreateCharacter}
        createPlaceholder={projectType === 'campaign' ? 'NPC name…' : 'Character name…'}
        loading={charactersLoading}
        getContextMenu={characterContextMenu}
      />

      {/* World / Factions */}
      <SidebarSection
        label={projectType === 'campaign' ? 'Factions & Lore' : 'World'}
        items={worldEntries.map(w => ({ id: w.id, label: w.name, sub: w.type || undefined }))}
        selectedId={selectedWorldId}
        onSelect={onSelectWorld}
        onCreate={onCreateWorldEntry}
        createPlaceholder={projectType === 'campaign' ? 'Faction or concept…' : 'Entry name…'}
        loading={worldLoading}
        getContextMenu={worldContextMenu}
      />

      {/* Concept Art — both project types */}
      <GallerySection label="Concept Art" projectSlug={projectSlug} imageType="concept_art"
        onOpen={onOpenGallery ? () => onOpenGallery('concept_art') : undefined} />

      {/* Maps — campaign only */}
      {projectType === 'campaign' && (
        <GallerySection label="Maps" projectSlug={projectSlug} imageType="map"
          onOpen={onOpenGallery ? () => onOpenGallery('map') : undefined} />
      )}
    </div>
  )
}

// ─── Gallery View (full-screen) ───────────────────────────────────────────────

function GalleryView({ projectSlug, imageType, onBack }: {
  projectSlug: string
  imageType: 'concept_art' | 'map'
  onBack: () => void
}) {
  const label = imageType === 'concept_art' ? 'Concept Art' : 'Maps'
  const [images, setImages] = useState<ProjectImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    fetch(`/api/projects/${projectSlug}/images?type=${imageType}`)
      .then(r => r.ok ? r.json() : [])
      .then(setImages)
      .catch(() => {})
  }, [projectSlug, imageType])

  useEffect(() => {
    if (lightboxIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null)
      if (e.key === 'ArrowLeft') setLightboxIdx(i => i !== null && i > 0 ? i - 1 : i)
      if (e.key === 'ArrowRight') setLightboxIdx(i => i !== null && i < images.length - 1 ? i + 1 : i)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIdx, images.length])

  const upload = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('imageType', imageType)
    fd.append('title', file.name.replace(/\.[^.]+$/, ''))
    try {
      const res = await fetch(`/api/projects/${projectSlug}/images`, { method: 'POST', body: fd })
      if (res.ok) { const img = await res.json(); setImages(prev => [...prev, img]) }
    } catch { /* no-op */ }
    setUploading(false)
  }

  const deleteImage = async (id: string, idx: number) => {
    await fetch(`/api/projects/${projectSlug}/images/${id}`, { method: 'DELETE' })
    setImages(prev => prev.filter(i => i.id !== id))
    if (lightboxIdx !== null) {
      if (lightboxIdx === idx) setLightboxIdx(null)
      else if (lightboxIdx > idx) setLightboxIdx(lightboxIdx - 1)
    }
  }

  const generate = async () => {
    const prompt = generatePrompt.trim()
    if (!prompt) return
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch(`/api/projects/${projectSlug}/images/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageType, title: prompt.slice(0, 60) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed.' }))
        setGenerateError(err.error ?? 'Generation failed.')
      } else {
        const img = await res.json()
        setImages(prev => [...prev, img])
        setGeneratePrompt('')
      }
    } catch {
      setGenerateError('Network error.')
    }
    setGenerating(false)
  }

  const lightbox = lightboxIdx !== null && mounted && typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
      <button className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white text-xl transition-colors" onClick={() => setLightboxIdx(null)}>✕</button>
      {lightboxIdx > 0 && (
        <button className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white text-4xl transition-colors" onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i - 1 : i) }}>‹</button>
      )}
      {lightboxIdx < images.length - 1 && (
        <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white text-4xl transition-colors" onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? i + 1 : i) }}>›</button>
      )}
      <div className="flex flex-col items-center gap-3 px-16" onClick={e => e.stopPropagation()}>
        <img src={images[lightboxIdx].url} alt={images[lightboxIdx].title} className="max-h-[82vh] max-w-[88vw] object-contain rounded-lg shadow-2xl" />
        {images[lightboxIdx].title && <p className="text-slate-300 text-sm">{images[lightboxIdx].title}</p>}
        <p className="text-slate-600 text-[10px]">{lightboxIdx + 1} / {images.length}</p>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 shrink-0">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">← Console</button>
        <span className="text-slate-800">|</span>
        <span className="text-sm font-semibold text-slate-300">{label}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <input
            value={generatePrompt}
            onChange={e => setGeneratePrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') generate() }}
            placeholder="Describe an image… (AI will expand it)"
            disabled={generating}
            className="w-72 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50"
          />
          <button
            onClick={generate}
            disabled={generating || !generatePrompt.trim()}
            className="px-3 py-1.5 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-lg text-sm hover:bg-violet-600/30 disabled:opacity-40 transition-colors shrink-0"
            title="Generate with AI"
          >
            {generating ? '…' : '✦ Generate'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-40 transition-colors shrink-0"
          >
            {uploading ? '…' : '+ Upload'}
          </button>
        </div>
      </div>

      {generateError && (
        <p className="px-4 py-2 text-sm text-red-400 bg-red-500/10 border-b border-red-500/20 shrink-0">{generateError}</p>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {images.length === 0 && !generating && !uploading && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
            <p className="text-sm">No images yet</p>
            <p className="text-xs">Use ✦ Generate or + Upload above</p>
          </div>
        )}
        {(generating || uploading) && (
          <p className="text-slate-500 text-sm animate-pulse mb-4">{generating ? '✦ AI is generating…' : 'Uploading…'}</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className="group relative aspect-square rounded-xl overflow-hidden bg-slate-800 cursor-pointer"
              onClick={() => setLightboxIdx(idx)}
            >
              <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors" />
              <p className="absolute bottom-0 inset-x-0 px-2 py-1.5 text-xs text-white opacity-0 group-hover:opacity-90 transition-opacity truncate">{img.title}</p>
              <button
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-[10px] text-white/0 group-hover:text-white/70 hover:!text-white hover:bg-red-600/80 transition-colors"
                onClick={e => { e.stopPropagation(); deleteImage(img.id, idx) }}
                title="Delete"
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { upload(f); e.target.value = '' } }}
      />
      {lightbox}
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

  // Sync content when updated externally (e.g. after file transcription)
  useEffect(() => {
    setContent(chapter.content ?? '')
    setTitle(chapter.title)
  }, [chapter.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

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

function ChatPanel({ projectSlug, username, onDocumentUpdated, onChapterUpdated, onCharacterUpdated, onWorldUpdated, onPollCreated, onTaskAssigned }: { projectSlug: string; username: string; onDocumentUpdated?: () => void; onChapterUpdated?: () => void; onCharacterUpdated?: () => void; onWorldUpdated?: () => void; onPollCreated?: (poll?: Poll) => void; onTaskAssigned?: () => void }) {
  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<string[]>([])
  const [readers, setReaders] = useState<{ username: string; lastReadMessageId: number }[]>([])

  // @ mention dropdown
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)

  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ msg: ProjectMessage; x: number; y: number } | null>(null)
  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string | null; isImage: boolean; isAudio: boolean } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [replyingTo, setReplyingTo] = useState<ProjectMessage | null>(null)
  const [pinnedMessages, setPinnedMessages] = useState<ProjectMessage[]>([])
  const [pinnedIdx, setPinnedIdx] = useState(0)

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
      setPinnedMessages(prev => prev.filter(m => m.id !== id))
    } else {
      const err = await res.json().catch(() => ({}))
      console.error('[deleteMessage] failed', res.status, err)
    }
  }

  const pinMessage = async (id: number, pin: boolean) => {
    const res = await fetch(`/api/projects/${projectSlug}/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned: pin }),
    })
    if (!res.ok) return
    const updated: ProjectMessage = await res.json()
    setMessages(prev => prev.map(m => m.id === id ? updated : m))
    if (pin) {
      setPinnedMessages(prev => [updated, ...prev.filter(m => m.id !== id)])
      setPinnedIdx(0)
    } else {
      setPinnedMessages(prev => {
        const next = prev.filter(m => m.id !== id)
        setPinnedIdx(i => Math.min(i, Math.max(0, next.length - 1)))
        return next
      })
    }
  }

  const jumpToPinned = (msg: ProjectMessage) => {
    const el = document.getElementById(`msg-${msg.id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-emerald-400', 'rounded-2xl')
      setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400', 'rounded-2xl'), 1500)
    }
  }

  const replyTo = (msg: ProjectMessage) => {
    setReplyingTo(msg)
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
    const el = scrollContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
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

  // Load pinned messages
  useEffect(() => {
    fetch(`/api/projects/${projectSlug}/messages?pinned=true`)
      .then(r => r.ok ? r.json() : [])
      .then((msgs: ProjectMessage[]) => {
        setPinnedMessages(msgs)
        setPinnedIdx(0)
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

  // Heartbeat — mark this user as online and report last read message
  useEffect(() => {
    if (!username?.trim()) return
    const ping = () => {
      const lastId = messages[messages.length - 1]?.id
      const realLastId = lastId && lastId > 0 ? lastId : undefined
      fetch(`/api/projects/${projectSlug}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, ...(realLastId ? { lastReadMessageId: realLastId } : {}) }),
      }).catch(() => {})
    }
    ping()
    const interval = setInterval(ping, 30000)
    return () => clearInterval(interval)
  }, [projectSlug, username, messages])

  // Poll presence
  useEffect(() => {
    const fetchPresence = () => {
      fetch(`/api/projects/${projectSlug}/presence`)
        .then(r => r.json())
        .then(data => {
          setOnlineUsers(data.online ?? [])
          setAllUsers(data.all ?? [])
          setReaders(data.readers ?? [])
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

  const isAudioFile = (name: string | null | undefined) =>
    !!name && /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i.test(name)

  const attachFile = (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isAudio = file.type.startsWith('audio/') || isAudioFile(file.name)
    const preview = (isImage || isAudio) ? URL.createObjectURL(file) : null
    setPendingFile({ file, preview, isImage, isAudio })
    inputRef.current?.focus()
  }

  const send = async () => {
    let text = input.trim()
    if (!text && !pendingFile || sending) return
    // Prepend @mention for reply if replying to someone else and not already tagged
    if (replyingTo && replyingTo.author !== username) {
      const tag = `@${replyingTo.author} `
      if (!text.startsWith(tag)) text = tag + text
    }
    setReplyingTo(null)
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
      isPinned: false,
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
      if (data.aiMessage?.content?.includes('👤') || data.aiMessage?.content?.includes('👥')) onCharacterUpdated?.()
      if (data.aiMessage?.content?.includes('🌍')) onWorldUpdated?.()
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

      {/* Pinned message banner */}
      {pinnedMessages.length > 0 && (() => {
        const pinned = pinnedMessages[pinnedIdx % pinnedMessages.length]
        const preview = pinned.content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n/g, ' ').trim()
        return (
          <div
            onClick={() => {
              jumpToPinned(pinned)
              if (pinnedMessages.length > 1) setPinnedIdx(i => (i + 1) % pinnedMessages.length)
            }}
            className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-200 dark:border-slate-800/60 bg-indigo-50 dark:bg-slate-900/80 cursor-pointer group hover:bg-indigo-100 dark:hover:bg-slate-800/60 transition-colors shrink-0"
          >
            <div className="shrink-0 text-emerald-600 dark:text-emerald-500 text-sm leading-none">📌</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-indigo-500 dark:text-slate-500 uppercase tracking-wider">Pinned</span>
                {pinnedMessages.length > 1 && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-600">{(pinnedIdx % pinnedMessages.length) + 1}/{pinnedMessages.length}</span>
                )}
                <span className="text-[10px] text-slate-400 dark:text-slate-600">· {pinned.author}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 truncate leading-snug">{preview.slice(0, 90)}{preview.length > 90 ? '…' : ''}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); pinMessage(pinned.id, false) }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 text-xs px-1 transition-all shrink-0"
              title="Unpin"
            >
              ✕
            </button>
          </div>
        )
      })()}

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
          // Users whose last read position is exactly this message (excluding the message author and current user)
          const seenBy = readers.filter(r => r.lastReadMessageId === msg.id && r.username !== msg.author && r.username !== username)
          return (
            <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
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
                {msg.imageUrl && (isAudioFile(msg.fileName) ? (
                  <div className="mb-2 min-w-[16rem]">
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>🎵</span>
                      <span className="truncate max-w-[14rem] font-medium">{msg.fileName}</span>
                    </div>
                    <audio src={msg.imageUrl} controls className="w-full" style={{ height: '36px' }} />
                  </div>
                ) : msg.fileName && !msg.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
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
                  <div className="flex items-center gap-1 shrink-0 leading-none mb-0.5">
                    {msg.isPinned && <span className="text-[9px] text-slate-400 dark:text-slate-500" title="Pinned">📌</span>}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{time}</span>
                  </div>
                </div>
              </div>
              {seenBy.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 px-1">
                  {seenBy.map(r => (
                    <div key={r.username} title={`Seen by ${r.username}`} className="w-3.5 h-3.5 rounded-full bg-slate-400 dark:bg-slate-500 flex items-center justify-center" >
                      <span className="text-[7px] font-bold text-white leading-none">{r.username[0].toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}
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
                { label: ctxMenu.msg.isPinned ? '📌 Unpin' : '📌 Pin', action: () => { pinMessage(ctxMenu.msg.id, !ctxMenu.msg.isPinned); setCtxMenu(null) } },
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
        {/* Reply banner */}
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold shrink-0">Replying to</span>
            <span className="text-xs text-slate-300 font-medium shrink-0">{replyingTo.author}</span>
            <span className="text-xs text-slate-600 truncate flex-1">{replyingTo.content.slice(0, 60)}{replyingTo.content.length > 60 ? '…' : ''}</span>
            <button onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-slate-300 text-xs leading-none shrink-0">✕</button>
          </div>
        )}
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
                : pendingFile.isAudio && pendingFile.preview
                ? (
                  <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 w-64">
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                      <span>🎵</span><span className="truncate">{pendingFile.file.name}</span>
                    </div>
                    <audio src={pendingFile.preview} controls className="w-full h-8" style={{ height: '32px' }} />
                  </div>
                )
                : <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-sm text-slate-700 dark:text-slate-200 max-w-48"><span className="text-lg">📄</span><span className="truncate">{pendingFile.file.name}</span></div>
              }
              <button onClick={() => setPendingFile(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-700 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500 transition-colors">✕</button>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) attachFile(f); e.target.value = '' }} />
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
  const [contributors, setContributors] = useState<string[]>([])
  const [isContributor, setIsContributor] = useState(false)
  const [joiningContributor, setJoiningContributor] = useState(false)
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [view, setView] = useState<MainView>({ type: 'console' })
  const [pendingTasks, setPendingTasks] = useState(0)
  const [unvotedPolls, setUnvotedPolls] = useState(0)
  const [clockTime, setClockTime] = useState('')
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)

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

  const openInviteModal = async () => {
    setInviteModal(true)
    setInviteLoading(true)
    // Try to get existing token first, generate one if none exists
    const res = await fetch(`/api/projects/${project.slug}/invite`)
    const data = await res.json()
    if (data.token) {
      setInviteToken(data.token)
      setInviteLoading(false)
    } else {
      const gen = await fetch(`/api/projects/${project.slug}/invite`, { method: 'POST' })
      const genData = await gen.json()
      setInviteToken(genData.token ?? null)
      setInviteLoading(false)
    }
  }

  const regenerateInvite = async () => {
    setInviteLoading(true)
    const res = await fetch(`/api/projects/${project.slug}/invite`, { method: 'POST' })
    const data = await res.json()
    setInviteToken(data.token ?? null)
    setInviteLoading(false)
    setInviteCopied(false)
  }

  const copyInviteText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    })
  }

  const fetchContributors = useCallback(() => {
    fetch(`/api/projects/${project.slug}/contributors`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setContributors(d.contributors ?? [])
        setIsContributor(Boolean(d.isContributor))
      })
      .catch(() => {})
  }, [project.slug])

  useEffect(() => {
    fetchDocuments()
    fetchChapters()
    fetchCharacters()
    fetchWorld()
    fetchContributors()
  }, [fetchDocuments, fetchChapters, fetchCharacters, fetchWorld, fetchContributors])

  useEffect(() => {
    fetchContributors()
    const interval = setInterval(fetchContributors, 10000)
    return () => clearInterval(interval)
  }, [fetchContributors])

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

  const createChapterFromFile = async (title: string, file: File) => {
    // Create the chapter first
    const res = await fetch('/api/chapters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, projectSlug: project.slug }),
    })
    if (!res.ok) return
    const chapter = await res.json()
    await fetchChapters()
    setView({ type: 'chapter', id: chapter.id })

    // Transcribe in background — show a toast so the user knows it's working
    showToast(`Transcribing "${file.name}"…`)
    const fd = new FormData()
    fd.append('file', file)
    const tRes = await fetch('/api/chapters/transcribe', { method: 'POST', body: fd })
    if (!tRes.ok) { showToast('Transcription failed.'); return }
    const { content } = await tRes.json()
    if (!content) return

    // Save transcribed content to the chapter
    const putRes = await fetch(`/api/chapters/${chapter.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: chapter.title, content, savedBy: 'Transcription' }),
    })
    if (!putRes.ok) { showToast('Failed to save transcription.'); return }
    const savedChapter = await putRes.json()
    // Update chapters state directly with the returned chapter so the editor remounts immediately
    setChapters(prev => prev.map(c => c.id === savedChapter.id ? savedChapter : c))
    showToast('Transcription complete.')
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

  // ── Chapter management ──────────────────────────────────────────────────────

  const handleRenameChapter = async (id: string, title: string) => {
    const res = await fetch(`/api/chapters/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (res.ok) {
      const updated = await res.json()
      setChapters(prev => prev.map(c => c.id === id ? { ...c, title: updated.title } : c))
    }
  }

  const handleDeleteChapter = async (id: string) => {
    const res = await fetch(`/api/chapters/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setChapters(prev => prev.filter(c => c.id !== id))
      if (view.type === 'chapter' && view.id === id) setView({ type: 'console' })
    }
  }

  const handleMoveChapter = async (id: string, direction: 'up' | 'down' | number) => {
    const idx = chapters.findIndex(c => c.id === id)
    if (idx === -1) return
    let newIdx: number
    if (direction === 'up') newIdx = Math.max(0, idx - 1)
    else if (direction === 'down') newIdx = Math.min(chapters.length - 1, idx + 1)
    else newIdx = Math.max(0, Math.min(chapters.length - 1, direction))
    if (newIdx === idx) return
    const reordered = [...chapters]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(newIdx, 0, moved)
    setChapters(reordered)
    await fetch('/api/chapters/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: reordered.map(c => c.id) }),
    })
  }

  const handleDuplicateChapter = async (id: string) => {
    const res = await fetch('/api/chapters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duplicateId: id, projectSlug: project.slug }),
    })
    if (res.ok) await fetchChapters()
  }

  // ── Character management ─────────────────────────────────────────────────────

  const handleRenameCharacter = async (id: string, name: string) => {
    const res = await fetch(`/api/characters/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, name: updated.name } : c))
    }
  }

  const handleDeleteCharacter = async (id: string) => {
    const res = await fetch(`/api/characters/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCharacters(prev => prev.filter(c => c.id !== id))
      if (view.type === 'character' && view.id === id) setView({ type: 'console' })
    }
  }

  // ── World management ─────────────────────────────────────────────────────────

  const handleRenameWorld = async (id: string, name: string) => {
    const res = await fetch(`/api/world/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const updated = await res.json()
      setWorldEntries(prev => prev.map(w => w.id === id ? { ...w, name: updated.name } : w))
    }
  }

  const handleDeleteWorld = async (id: string) => {
    const res = await fetch(`/api/world/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setWorldEntries(prev => prev.filter(w => w.id !== id))
      if (view.type === 'world' && view.id === id) setView({ type: 'console' })
    }
  }

  const reloadContext = async () => {
    setConfirmReset(false)
    setReloading(true)
    await fetchDocuments()
    const res = await fetch(`/api/projects/${project.slug}/agent/reload`, { method: 'POST' })
    const data = await res.json()
    showToast(data.message ?? 'Session reset.')
    setReloading(false)
  }

  const joinProjectAsContributor = async () => {
    setJoiningContributor(true)
    try {
      const res = await fetch(`/api/projects/${project.slug}/contributors`, { method: 'POST' })
      if (!res.ok) {
        showToast('Could not join this project right now.')
        return
      }
      setIsContributor(true)
      setContributors(prev => {
        if (!username || prev.includes(username)) return prev
        return [...prev, username]
      })
      fetchNotifications()
      showToast('You are now a registered contributor on this project.')
    } finally {
      setJoiningContributor(false)
    }
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
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} showClose />}
      {confirmReset && <ConfirmToast message="Reset session? This will clear conversation history." onConfirm={reloadContext} onCancel={() => setConfirmReset(false)} />}

      {/* Invite modal */}
      {inviteModal && (() => {
        const inviteUrl = inviteToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteToken}` : ''
        const typeLabel = project.type === 'campaign' ? 'D&D campaign' : 'collaborative novel'
        const shareText = inviteToken
          ? `You're invited to collaborate on "${project.name}" — a ${typeLabel} in DAN.\n\nJoin here: ${inviteUrl}`
          : ''
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">Invite to {project.name}</h2>
                <button onClick={() => setInviteModal(false)} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
              </div>

              {inviteLoading ? (
                <p className="text-sm text-slate-500">Generating link…</p>
              ) : inviteToken ? (
                <>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Invite link</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={inviteUrl}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
                        onFocus={e => e.target.select()}
                      />
                      <button
                        onClick={() => copyInviteText(inviteUrl)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                      >
                        {inviteCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Shareable message</p>
                    <textarea
                      readOnly
                      value={shareText}
                      rows={4}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 resize-none focus:outline-none"
                      onFocus={e => e.target.select()}
                    />
                    <button
                      onClick={() => copyInviteText(shareText)}
                      className="mt-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                    >
                      Copy message
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    Anyone with this link can sign in or create an account and will be auto-added as a contributor.{' '}
                    <button onClick={regenerateInvite} className="text-slate-500 hover:text-slate-400 underline underline-offset-2">Revoke &amp; regenerate</button>
                  </p>
                </>
              ) : (
                <p className="text-sm text-red-400">Failed to generate invite link.</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Main area (header + content) — pushed left on mobile when doc sidebar opens */}
      <div className={`flex flex-col flex-1 min-h-0 overflow-hidden transition-transform duration-200 ease-in-out ${docSidebarOpen ? '-translate-x-64 lg:translate-x-0' : 'translate-x-0'}`}>

      {/* Header */}
      <div className="relative z-50 px-4 h-16 border-b border-slate-800/60 shrink-0 flex items-center gap-3">
        <button onClick={toggleNav} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0 text-base">☰</button>
        <h1 className="text-sm font-semibold text-slate-200 truncate">{project.name}</h1>
        {username && <span className="text-xs text-slate-600 hidden sm:inline">— {username}</span>}
        <span className="hidden md:inline text-xs text-slate-600">
          {contributors.length} contributor{contributors.length === 1 ? '' : 's'}
        </span>
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
          {!isContributor && username && (
            <button onClick={joinProjectAsContributor} disabled={joiningContributor}
              className="hidden sm:flex px-3 py-1.5 items-center justify-center border border-emerald-500/40 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-40">
              {joiningContributor ? 'Joining…' : 'Join Project'}
            </button>
          )}
          <button onClick={openInviteModal}
            className="hidden sm:flex px-3 py-1.5 items-center justify-center border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors"
            title="Invite someone to this project">
            Invite
          </button>
          <button onClick={() => setConfirmReset(true)} disabled={reloading}
            className="w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 flex items-center justify-center border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors disabled:opacity-40">
            ↺<span className="hidden sm:inline ml-1">{reloading ? 'Resetting…' : 'Reload Context'}</span>
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
        {!isContributor && username && (
          <div className="px-4 py-2 border-b border-amber-500/20 bg-amber-500/5 flex items-center gap-3 shrink-0">
            <p className="text-xs text-amber-300 flex-1">
              Register yourself as a contributor so polls stay open until you vote, even when you are offline.
            </p>
            <button onClick={joinProjectAsContributor} disabled={joiningContributor}
              className="sm:hidden px-3 py-1.5 border border-emerald-500/40 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-40">
              {joiningContributor ? 'Joining…' : 'Join'}
            </button>
          </div>
        )}
        {view.type === 'document' && selectedDoc && (
          <DocEditor key={selectedDoc.key} doc={selectedDoc} projectSlug={project.slug}
            onSaved={updated => { setDocuments(prev => prev.map(d => d.key === updated.key ? updated : d)); showToast(`"${updated.title}" saved.`) }}
            onBack={() => { setView({ type: 'console' }); if (window.innerWidth >= 1024) setDocSidebarOpen(true) }} />
        )}
        {view.type === 'chapter' && selectedChapter && (
          <ChapterEditor key={selectedChapter.id + ':' + selectedChapter.updatedAt} chapter={selectedChapter} username={username ?? 'Anonymous'}
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
        {view.type === 'gallery' && (
          <GalleryView projectSlug={project.slug} imageType={view.imageType}
            onBack={() => { setView({ type: 'console' }); if (window.innerWidth >= 1024) setDocSidebarOpen(true) }} />
        )}
        {view.type === 'console' && (
          <>
            <ChatPanel
              projectSlug={project.slug}
              username={username ?? 'Anonymous'}
              onDocumentUpdated={fetchDocuments}
              onChapterUpdated={fetchChapters}
              onCharacterUpdated={fetchCharacters}
              onWorldUpdated={fetchWorld}
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
          onRenameChapter={handleRenameChapter}
          onDeleteChapter={handleDeleteChapter}
          onMoveChapter={handleMoveChapter}
          onDuplicateChapter={handleDuplicateChapter}
          onRenameCharacter={handleRenameCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onRenameWorld={handleRenameWorld}
          onDeleteWorld={handleDeleteWorld}
          chaptersLoading={!chaptersLoaded}
          charactersLoading={!charactersLoaded}
          worldLoading={!worldLoaded}
          projectType={project.type}
          projectSlug={project.slug}
          onImportFile={createChapterFromFile}
          onOpenGallery={(imageType) => { setView({ type: 'gallery', imageType }); setDocSidebarOpen(false) }}
        />
      </div>
    </div>
  )
}
