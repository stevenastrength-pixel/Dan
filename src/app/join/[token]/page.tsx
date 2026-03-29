'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import DanLogo from '@/components/DanLogo'

interface ProjectInfo {
  projectName: string
  projectSlug: string
  projectType: string
  description: string
}

export default function JoinPage() {
  const params = useParams()
  const token = params.token as string

  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<'login' | 'register'>('login')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setLoadError(d.error)
        else setProjectInfo(d)
      })
      .catch(() => setLoadError('Failed to load invite.'))
  }, [token])

  const joinProject = async (slug: string) => {
    await fetch(`/api/projects/${slug}/contributors`, { method: 'POST' })
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Login failed.'); setLoading(false); return }
    await joinProject(projectInfo!.projectSlug)
    window.location.href = `/projects/${projectInfo!.projectSlug}/agent`
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, inviteCode, projectInviteToken: token }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Registration failed.'); setLoading(false); return }
    await joinProject(projectInfo!.projectSlug)
    window.location.href = `/projects/${projectInfo!.projectSlug}/agent`
  }

  const typeLabel = projectInfo?.projectType === 'campaign' ? 'D&D campaign' : 'collaborative novel'

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 px-4 gap-8">
      <DanLogo />

      {loadError ? (
        <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-slate-900/60 p-8 text-center">
          <p className="text-sm text-red-400">{loadError}</p>
        </div>
      ) : !projectInfo ? (
        <p className="text-sm text-slate-500">Loading invite…</p>
      ) : (
        <div className="w-full max-w-sm space-y-4">
          {/* Project card */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              You&apos;re invited to join a {typeLabel}
            </p>
            <h1 className="text-lg font-semibold text-slate-100">{projectInfo.projectName}</h1>
            {projectInfo.description && (
              <p className="text-sm text-slate-400 mt-1 line-clamp-3">{projectInfo.description}</p>
            )}
          </div>

          {/* Auth card */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6">
            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-slate-800/60 rounded-lg p-1">
              <button
                onClick={() => { setTab('login'); setError('') }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'login' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Sign in
              </button>
              <button
                onClick={() => { setTab('register'); setError('') }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'register' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Create account
              </button>
            </div>

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Username</label>
                  <input
                    autoFocus
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="your-username"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !username.trim() || !password}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                >
                  {loading ? 'Signing in…' : `Sign in & join ${projectInfo.projectName}`}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Username</label>
                  <input
                    autoFocus
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="choose-a-username"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="at least 8 characters"
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  This invite link grants you access — no invite code needed.
                </p>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !username.trim() || !password}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                >
                  {loading ? 'Creating account…' : `Create account & join ${projectInfo.projectName}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
