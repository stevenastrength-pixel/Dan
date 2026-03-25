'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Project = {
  id: number
  name: string
  slug: string
  description: string
  createdAt: string
  _count: { chapters: number; characters: number; polls: number }
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

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(data)
        setLoading(false)
      })
  }, [])

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
                placeholder="OMG: Mimir"
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
                  placeholder="omg-mimir"
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
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}/agent`}
              className="block rounded-xl border border-slate-800/60 bg-slate-900/60 p-5 hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                    {project.name}
                  </h2>
                  {project.description && (
                    <p className="text-sm text-slate-500 mt-0.5">{project.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-slate-600">
                      {project._count.chapters} chapter{project._count.chapters !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-slate-600">
                      {project._count.characters} character{project._count.characters !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-slate-600">
                      {project._count.polls} poll{project._count.polls !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-slate-600">Created {formatDate(project.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <span className="text-xs text-slate-600 font-mono bg-slate-800/60 px-2 py-0.5 rounded">
                    /{project.slug}
                  </span>
                  <span className="text-slate-700 group-hover:text-emerald-500 transition-colors">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
