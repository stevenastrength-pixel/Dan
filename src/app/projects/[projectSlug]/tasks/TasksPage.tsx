'use client'

import { useState, useEffect, useCallback } from 'react'

type Task = {
  id: number
  assignedTo: string
  title: string
  description: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  createdBy: string
  createdAt: string
  updatedAt: string
}

const STATUS_LABELS: Record<Task['status'], string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
}

const STATUS_NEXT: Record<Task['status'], Task['status']> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
}

const STATUS_COLORS: Record<Task['status'], string> = {
  TODO: 'bg-slate-700/40 text-slate-400',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-400',
  DONE: 'bg-emerald-500/20 text-emerald-400',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────

function TaskModal({ task, projectSlug, username, onClose, onUpdate }: {
  task: Task
  projectSlug: string
  username: string
  onClose: () => void
  onUpdate: (updated: Task) => void
}) {
  const [response, setResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const submit = async () => {
    if (!response.trim()) return
    setSubmitting(true)
    const content = `Re: **${task.title}** — ${response.trim()}\n@Daneel`
    await fetch(`/api/projects/${projectSlug}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: username, content }),
    })
    // Advance status to IN_PROGRESS if still TODO
    if (task.status === 'TODO') {
      const res = await fetch(`/api/projects/${projectSlug}/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      })
      if (res.ok) onUpdate({ ...task, status: 'IN_PROGRESS' })
    }
    setSubmitted(true)
    setSubmitting(false)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-800/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mb-2 ${STATUS_COLORS[task.status]}`}>
                {STATUS_LABELS[task.status]}
              </span>
              <h2 className="text-base font-semibold text-slate-200 leading-snug">{task.title}</h2>
              {task.description && (
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{task.description}</p>
              )}
              <p className="text-xs text-slate-600 mt-2">
                Assigned by {task.createdBy === 'Daneel' ? '⬡ Daneel' : task.createdBy} · {timeAgo(task.createdAt)}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-600 hover:text-slate-400 transition-colors text-lg leading-none shrink-0">✕</button>
          </div>
        </div>

        <div className="p-6">
          {submitted ? (
            <p className="text-sm text-emerald-400 text-center py-2">✓ Response sent to Daneel</p>
          ) : (
            <>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Your response
              </label>
              <textarea
                autoFocus
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder="Type your update or answer here…"
                rows={4}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none mb-3"
              />
              <p className="text-xs text-slate-600 mb-4">Your response will be posted to chat and sent to @Daneel.</p>
              <button
                onClick={submit}
                disabled={submitting || !response.trim()}
                className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              >
                {submitting ? 'Sending…' : 'Send Response'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, projectSlug, onUpdate, onDelete, onOpen, isAdmin, currentUser, allTasks }: {
  task: Task
  projectSlug: string
  onUpdate: (updated: Task) => void
  onDelete: (id: number) => void
  onOpen: (task: Task) => void
  isAdmin: boolean
  currentUser: string
  allTasks: Task[]
}) {
  const [updating, setUpdating] = useState(false)

  const advanceStatus = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setUpdating(true)
    const next = STATUS_NEXT[task.status]
    const res = await fetch(`/api/projects/${projectSlug}/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      onUpdate({ ...task, status: next })
      if (next === 'DONE') {
        const bc = new BroadcastChannel('dan-notifications')
        bc.postMessage('refresh')
        bc.close()
        // Count remaining active tasks for this user (excluding the one just completed)
        const remaining = allTasks.filter(
          t => t.assignedTo === currentUser && t.status !== 'DONE' && t.id !== task.id
        ).length
        await fetch(`/api/projects/${projectSlug}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: currentUser,
            content: `✓ Task completed with no additional notes: **${task.title}**\n(${currentUser} has ${remaining} active task${remaining === 1 ? '' : 's'} remaining — ${remaining === 0 ? 'queue is now empty' : 'do not assign new tasks unless asked'})\n@Daneel`,
          }),
        })
      }
    }
    setUpdating(false)
  }

  const canDelete = isAdmin || currentUser === task.assignedTo

  return (
    <div
      onClick={() => onOpen(task)}
      className={`rounded-xl border p-4 transition-all cursor-pointer hover:border-slate-600 ${task.status === 'DONE' ? 'opacity-60 border-slate-800/40 bg-slate-900/30' : 'border-slate-700/60 bg-slate-900/60'}`}
    >
      <div className="flex items-start gap-3">
        <button onClick={advanceStatus} disabled={updating} title="Advance status"
          className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
            task.status === 'DONE'
              ? 'border-emerald-500 bg-emerald-500/20'
              : task.status === 'IN_PROGRESS'
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-slate-600 hover:border-emerald-500'
          }`}>
          {task.status === 'DONE' && <span className="text-emerald-400 text-xs leading-none">✓</span>}
          {task.status === 'IN_PROGRESS' && <span className="text-amber-400 text-[8px] leading-none">▶</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium leading-snug ${task.status === 'DONE' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status]}`}>
                {STATUS_LABELS[task.status]}
              </span>
              {canDelete && (
                <button onClick={e => { e.stopPropagation(); onDelete(task.id) }} title="Delete task"
                  className="text-slate-600 hover:text-red-400 transition-colors text-xs">✕</button>
              )}
            </div>
          </div>

          {task.description && (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{task.description}</p>
          )}

          <p className="text-[10px] text-slate-600 mt-1.5">
            {task.createdBy === 'Daneel' ? '⬡ Daneel' : task.createdBy} · {timeAgo(task.createdAt)}
          </p>
        </div>
      </div>
    </div>
  )
}

function TaskGroup({ title, tasks, projectSlug, onUpdate, onDelete, onOpen, isAdmin, currentUser, allTasks }: {
  title: string
  tasks: Task[]
  projectSlug: string
  onUpdate: (t: Task) => void
  onDelete: (id: number) => void
  onOpen: (t: Task) => void
  isAdmin: boolean
  currentUser: string
  allTasks: Task[]
}) {
  const [collapsed, setCollapsed] = useState(title === 'Done')
  if (tasks.length === 0) return null

  return (
    <div className="mb-6">
      <button onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors">
        <span>{collapsed ? '▶' : '▼'}</span>
        {title}
        <span className="bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full font-normal normal-case">{tasks.length}</span>
      </button>
      {!collapsed && (
        <div className="space-y-2">
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} projectSlug={projectSlug}
              onUpdate={onUpdate} onDelete={onDelete} onOpen={onOpen} isAdmin={isAdmin} currentUser={currentUser} allTasks={allTasks} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TasksPage({ project }: { project: { name: string; slug: string } }) {
  const [username, setUsername] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [showAll, setShowAll] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('dan-username')
    if (stored) setUsername(stored)
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.role === 'admin') setIsAdmin(true)
    })
  }, [])

  const fetchTasks = useCallback(async () => {
    if (!username) return
    const [myRes, allRes] = await Promise.all([
      fetch(`/api/projects/${project.slug}/tasks?assignedTo=${encodeURIComponent(username)}`),
      fetch(`/api/projects/${project.slug}/tasks`),
    ])
    if (myRes.ok) setTasks(await myRes.json())
    if (allRes.ok) setAllTasks(await allRes.json())
  }, [project.slug, username])

  useEffect(() => {
    if (!username) return
    fetchTasks()
    const interval = setInterval(fetchTasks, 10000)
    return () => clearInterval(interval)
  }, [fetchTasks, username])

  const handleUpdate = (updated: Task) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    setAllTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/projects/${project.slug}/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
    setAllTasks(prev => prev.filter(t => t.id !== id))
  }

  const broadcastRefresh = () => {
    const channel = new BroadcastChannel('dan-notifications')
    channel.postMessage('refresh')
    channel.close()
  }

  const clearMyTasks = async () => {
    for (const t of tasks) {
      await fetch(`/api/projects/${project.slug}/tasks/${t.id}`, { method: 'DELETE' })
    }
    setTasks([])
    setAllTasks(prev => prev.filter(t => t.assignedTo !== username))
    setClearConfirm(false)
    broadcastRefresh()
    await fetch(`/api/projects/${project.slug}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: username,
        content: `🗑 All tasks cleared by ${username}. Queue is now empty.\n@Daneel`,
      }),
    })
  }

  // Group tasks by status for "my tasks" view
  const myTodo = tasks.filter(t => t.status === 'TODO')
  const myInProgress = tasks.filter(t => t.status === 'IN_PROGRESS')
  const myDone = tasks.filter(t => t.status === 'DONE')

  // Group all tasks by user for admin "all tasks" view
  const userMap: Record<string, Task[]> = {}
  for (const t of allTasks) {
    if (!userMap[t.assignedTo]) userMap[t.assignedTo] = []
    userMap[t.assignedTo].push(t)
  }

  const displayUsername = username ?? ''

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          projectSlug={project.slug}
          username={username ?? 'Anonymous'}
          onClose={() => setSelectedTask(null)}
          onUpdate={updated => { handleUpdate(updated); setSelectedTask(updated) }}
        />
      )}
      <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-slate-200">{project.name}</h1>
          <p className="text-xs text-slate-600">Tasks{username ? ` — ${username}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {!showAll && tasks.length > 0 && (
            clearConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Clear all your tasks?</span>
                <button onClick={clearMyTasks}
                  className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-500 transition-colors">
                  Yes, clear
                </button>
                <button onClick={() => setClearConfirm(false)}
                  className="px-2.5 py-1.5 border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setClearConfirm(true)}
                className="px-3 py-1.5 border border-slate-700 rounded-lg text-xs font-medium text-slate-500 hover:border-red-500/40 hover:text-red-400 transition-colors">
                Clear all
              </button>
            )
          )}
          {isAdmin && (
            <button onClick={() => setShowAll(v => !v)}
              className="px-3 py-1.5 border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors">
              {showAll ? 'My Tasks' : 'All Tasks'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!username && (
          <p className="text-sm text-slate-600 text-center py-12">Loading…</p>
        )}

        {username && !showAll && (
          <>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-12">No tasks assigned to you yet. Ask @Daneel to assign one.</p>
            ) : (
              <>
                <TaskGroup title="In Progress" tasks={myInProgress} projectSlug={project.slug}
                  onUpdate={handleUpdate} onDelete={handleDelete} onOpen={setSelectedTask} isAdmin={isAdmin} currentUser={displayUsername} allTasks={allTasks} />
                <TaskGroup title="To Do" tasks={myTodo} projectSlug={project.slug}
                  onUpdate={handleUpdate} onDelete={handleDelete} onOpen={setSelectedTask} isAdmin={isAdmin} currentUser={displayUsername} allTasks={allTasks} />
                <TaskGroup title="Done" tasks={myDone} projectSlug={project.slug}
                  onUpdate={handleUpdate} onDelete={handleDelete} onOpen={setSelectedTask} isAdmin={isAdmin} currentUser={displayUsername} allTasks={allTasks} />
              </>
            )}
          </>
        )}

        {username && showAll && isAdmin && (
          <>
            {Object.keys(userMap).length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-12">No tasks assigned yet.</p>
            ) : (
              Object.entries(userMap).map(([user, userTasks]) => (
                <div key={user} className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-emerald-400 leading-none">{user[0]?.toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-300">@{user}</span>
                    <span className="text-xs text-slate-600">{userTasks.filter(t => t.status !== 'DONE').length} active</span>
                  </div>
                  <div className="space-y-2 ml-1">
                    {userTasks.filter(t => t.status !== 'DONE').map(t => (
                      <TaskCard key={t.id} task={t} projectSlug={project.slug}
                        onUpdate={handleUpdate} onDelete={handleDelete} onOpen={setSelectedTask} isAdmin={isAdmin} currentUser={displayUsername} allTasks={allTasks} />
                    ))}
                    {userTasks.filter(t => t.status === 'DONE').length > 0 && (
                      <p className="text-xs text-slate-600 px-1">{userTasks.filter(t => t.status === 'DONE').length} completed</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
