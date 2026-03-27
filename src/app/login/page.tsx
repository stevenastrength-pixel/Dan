'use client'

import { useState } from 'react'
import Link from 'next/link'
import DanLogo from '@/components/DanLogo'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Login failed.')
      setLoading(false)
      return
    }
    window.location.href = '/'
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 px-4 gap-10">
      <DanLogo />
      <div className="w-full max-w-sm">

        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-8">
          <h1 className="text-base font-semibold text-slate-200 mb-6">Sign in</h1>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Username
              </label>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="your-username"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-5">
          No account?{' '}
          <Link href="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
