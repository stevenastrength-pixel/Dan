'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Project = {
  id: number
  name: string
  slug: string
  description: string
  createdAt: string
  _count: { chapters: number; polls: number; tasks: number }
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

type MenuState =
  | { type: 'none' }
  | { type: 'menu'; projectId: number }
  | { type: 'rename'; projectId: number; name: string }
  | { type: 'delete'; projectId: number; confirmText: string }

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [menu, setMenu] = useState<MenuState>({ type: 'none' })
  const [actionBusy, setActionBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(data)
        setLoading(false)
      })
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (menu.type === 'none') return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu({ type: 'none' })
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu.type])

  const handleNameChange = (val: string) => {
    setName(val)
    if (!slugManuallyEdited) setSlug(toSlug(val))
  }

  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    setError('')
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setCreating(false)
      return
    }
    const project: Project = await res.json()
    router.push(`/projects/${project.slug}/agent`)
  }

  const renameProject = async (slug: string, newName: string) => {
    if (!newName.trim()) return
    setActionBusy(true)
    await fetch(`/api/projects/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await fetch('/api/projects').then((r) => r.json())
    setProjects(data)
    setMenu({ type: 'none' })
    setActionBusy(false)
  }

  const deleteProject = async (slug: string) => {
    setActionBusy(true)
    await fetch(`/api/projects/${slug}`, { method: 'DELETE' })
    setProjects((prev) => prev.filter((p) => p.slug !== slug))
    setMenu({ type: 'none' })
    setActionBusy(false)
  }

  if (loading) return <div className="p-8 text-slate-600 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-200">Projects</h1>
          <p className="text-sm text-slate-600 mt-0.5">Your collaborative novel projects.</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
        >
          {showCreate ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">New Project</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Novel"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Slug (URL)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">/projects/</span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value)
                    setSlugManuallyEdited(true)
                  }}
                  placeholder="my-novel"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short blurb about the project (optional)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end">
              <button
                onClick={create}
                disabled={creating || !name.trim()}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              >
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project list */}
      {projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3 text-slate-700">◈</p>
          <p className="text-base font-medium text-slate-500">No projects yet</p>
          <p className="text-sm text-slate-600 mt-1">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const isMenuOpen = menu.type !== 'none' && menu.projectId === project.id
            const isRenaming = menu.type === 'rename' && menu.projectId === project.id
            const isDeleting = menu.type === 'delete' && menu.projectId === project.id

            return (
              <div key={project.id} className="relative">
                <div className="flex items-stretch rounded-xl border border-slate-800/60 bg-slate-900/60 hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all group overflow-hidden">
                  {/* Clickable main area */}
                  <Link
                    href={`/projects/${project.slug}/agent`}
                    className="flex-1 min-w-0 p-5"
                  >
                    <h2 className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                      {project.name}
                    </h2>
                    {project.description && (
                      <p className="text-sm text-slate-500 mt-0.5">{project.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-600 uppercase tracking-wide">Chapters</span>
                        <span className="text-sm font-semibold text-slate-500 tabular-nums">{project._count.chapters}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-600 uppercase tracking-wide">Polls</span>
                        <span className={`text-sm font-semibold tabular-nums ${project._count.polls === 0 ? 'text-slate-600' : project._count.polls >= 10 ? 'text-red-400' : 'text-amber-400'}`}>
                          {project._count.polls}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-600 uppercase tracking-wide">Tasks</span>
                        <span className={`text-sm font-semibold tabular-nums ${project._count.tasks === 0 ? 'text-slate-600' : project._count.tasks >= 10 ? 'text-red-400' : 'text-amber-400'}`}>
                          {project._count.tasks}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* Right controls: gear + arrow */}
                  <div className="flex items-center gap-1 pr-2 pl-3 shrink-0">
                    {/* Gear button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMenu(isMenuOpen ? { type: 'none' } : { type: 'menu', projectId: project.id })
                      }}
                      className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
                      title="Project options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14M12 2v2M12 20v2M2 12h2M20 12h2"/>
                      </svg>
                    </button>

                    {/* Arrow nav button */}
                    <Link
                      href={`/projects/${project.slug}/agent`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center w-8 h-8 rounded-md text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="Open project"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                    </Link>
                  </div>
                </div>

                {/* Dropdown / inline panel */}
                {isMenuOpen && (
                  <div
                    ref={menuRef}
                    className="absolute top-10 right-3 z-20 w-52 rounded-xl border border-slate-700/60 bg-slate-900 shadow-xl p-2"
                  >
                    {!isRenaming && !isDeleting && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenu({ type: 'rename', projectId: project.id, name: project.name })
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenu({ type: 'delete', projectId: project.id, confirmText: '' })
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          Delete project…
                        </button>
                      </>
                    )}

                    {isRenaming && menu.type === 'rename' && (
                      <div className="p-1 space-y-2">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-1">Rename project</p>
                        <input
                          autoFocus
                          value={menu.name}
                          onChange={(e) => setMenu({ ...menu, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameProject(project.slug, menu.name)
                            if (e.key === 'Escape') setMenu({ type: 'none' })
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => renameProject(project.slug, menu.name)}
                            disabled={actionBusy || !menu.name.trim()}
                            className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                          >
                            {actionBusy ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setMenu({ type: 'none' })}
                            className="flex-1 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {isDeleting && menu.type === 'delete' && (
                      <div className="p-1 space-y-2">
                        <p className="text-xs text-slate-300 px-1 leading-snug">
                          Delete <span className="font-semibold text-white">{project.name}</span>? This cannot be undone.
                        </p>
                        <p className="text-[11px] text-slate-500 px-1">Type <span className="font-mono font-bold text-slate-300">DELETE</span> to confirm.</p>
                        <input
                          autoFocus
                          value={menu.confirmText}
                          onChange={(e) => setMenu({ ...menu, confirmText: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && menu.confirmText === 'DELETE') deleteProject(project.slug)
                            if (e.key === 'Escape') setMenu({ type: 'none' })
                          }}
                          placeholder="DELETE"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteProject(project.slug)}
                            disabled={actionBusy || menu.confirmText !== 'DELETE'}
                            className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-500 disabled:opacity-40 transition-colors"
                          >
                            {actionBusy ? 'Deleting…' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setMenu({ type: 'none' })}
                            className="flex-1 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
