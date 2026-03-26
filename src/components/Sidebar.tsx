'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DanIcon } from '@/components/DanLogo'

// ─── Global nav (shown when not inside a project) ─────────────────────────────

const GLOBAL_NAV = [
  { href: '/projects', label: 'Projects', icon: '◫' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

// ─── Project nav (shown when inside /projects/[slug]/...) ─────────────────────

function NavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30'
          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </Link>
  )
}

function ProjectNav({ slug, pathname }: { slug: string; pathname: string }) {
  const items = [
    { href: `/projects/${slug}/agent`, label: 'Agent', icon: '⬡' },
  ]

  return (
    <>
      {/* Back to all projects */}
      <Link
        href="/projects"
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-300 font-medium transition-colors border border-transparent"
      >
        ← Projects
      </Link>

      <div className="mx-3 my-1 border-t border-slate-800/60" />

      {/* Project-scoped links */}
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={item.label}
          active={pathname.startsWith(item.href)}
        />
      ))}

      <div className="mx-3 my-1 border-t border-slate-800/60" />

      <NavLink
        href="/settings"
        icon="⚙"
        label="Settings"
        active={pathname.startsWith('/settings')}
      />
    </>
  )
}

// ─── Tip Bar ──────────────────────────────────────────────────────────────────

const GLOBAL_TIPS = [
  'Create a project to get started.',
  'Each project has its own chat, docs, chapters, and characters.',
  'Go to Settings to connect Claude, GPT, or your own server.',
]

const PROJECT_TIPS = [
  '@Daneel in chat to get an AI response.',
  '@name to tag a teammate — they\'ll be highlighted in blue.',
  'Story Bible and Project Instructions give Daneel its context.',
  'Wake Prompt = what Daneel reads on every startup.',
  'Use "↺ Reload Context" after editing docs to refresh Daneel.',
  'Chapters, Characters, and World all live in the left sidebar.',
  'Use polls to vote on story direction as a team.',
  'Click + next to any section to create a new entry inline.',
  'Your name is stored in your browser — no account needed.',
]

function TipBar({ inProject }: { inProject: boolean }) {
  const tips = inProject ? PROJECT_TIPS : GLOBAL_TIPS
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % tips.length)
        setVisible(true)
      }, 300)
    }, 6000)
    return () => clearInterval(interval)
  }, [tips.length])

  // Reset to first tip when context changes
  useEffect(() => { setIdx(0); setVisible(true) }, [inProject])

  return (
    <div className="p-4 border-t border-slate-900 min-h-[3.5rem] flex items-start">
      <p
        className="text-xs text-slate-600 leading-relaxed transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        💡 {tips[idx]}
      </p>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function UserFooter() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.username) setUsername(d.username)
    })
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (!username) return null

  return (
    <div className="px-3 py-3 border-t border-slate-900 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className="w-5 h-5 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-emerald-400 leading-none">
            {username[0].toUpperCase()}
          </span>
        </div>
        <span className="text-xs text-slate-400 truncate font-medium">@{username}</span>
      </div>
      <button
        onClick={logout}
        className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()

  // Extract projectSlug from /projects/[slug]/... paths
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectSlug = projectMatch?.[1]

  return (
    <aside className="w-56 bg-slate-950 border-r border-slate-900 flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-slate-900 flex items-center justify-between">
        <Link href="/projects" className="hover:opacity-80 transition-opacity flex items-center gap-2">
          <DanIcon size={48} />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-[0.2em] text-slate-900 dark:text-white">DAN</span>
            <span className="text-[10px] tracking-wide text-slate-500">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </span>
        </Link>
        <ThemeToggle />
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {projectSlug ? (
          <ProjectNav slug={projectSlug} pathname={pathname} />
        ) : (
          GLOBAL_NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname.startsWith(item.href)}
            />
          ))
        )}
      </nav>

      <TipBar inProject={!!projectSlug} />
      <UserFooter />
    </aside>
  )
}
