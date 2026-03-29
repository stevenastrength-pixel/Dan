'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DanIcon } from '@/components/DanLogo'

// ─── Global nav ───────────────────────────────────────────────────────────────

const GLOBAL_NAV = [
  { href: '/novels', label: 'Novels', icon: '◫' },
  { href: '/campaigns', label: 'Campaigns', icon: '⚔' },
  { href: '/agent', label: 'Chat', icon: '⬡' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

// ─── Project nav ──────────────────────────────────────────────────────────────

function NavLink({ href, icon, label, active, badge }: { href: string; icon: string; label: string; active: boolean; badge?: number }) {
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
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[1.1rem] text-center">
          {badge}
        </span>
      )}
    </Link>
  )
}

function ProjectNav({ slug, pathname, pollBadge, taskBadge }: { slug: string; pathname: string; pollBadge: number; taskBadge: number }) {
  const [projectType, setProjectType] = useState<'novel' | 'campaign' | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.type) setProjectType(d.type) })
      .catch(() => {})
  }, [slug])

  const backHref = projectType === 'campaign' ? '/campaigns' : '/novels'
  const backLabel = projectType === 'campaign' ? '← Campaigns' : '← Novels'

  const novelItems = [
    { href: `/projects/${slug}/agent`, label: 'Agent', icon: '⬡', badge: undefined },
    { href: `/projects/${slug}/polls`, label: 'Polls', icon: '◎', badge: pollBadge },
    { href: `/projects/${slug}/tasks`, label: 'Tasks', icon: '✓', badge: taskBadge },
    { href: `/projects/${slug}/guide`, label: 'Guide', icon: '?', badge: undefined },
  ]

  const campaignItems = [
    { href: `/projects/${slug}/agent`, label: 'Agent', icon: '⬡', badge: undefined },
    { href: `/projects/${slug}/locations`, label: 'Locations', icon: '⌖', badge: undefined },
    { href: `/projects/${slug}/encounters`, label: 'Encounters', icon: '⚔', badge: undefined },
    { href: `/projects/${slug}/quests`, label: 'Quests', icon: '📜', badge: undefined },
    { href: `/projects/${slug}/tables`, label: 'Tables', icon: '🎲', badge: undefined },
    { href: `/projects/${slug}/timeline`, label: 'Timeline', icon: '◷', badge: undefined },
    { href: `/projects/${slug}/polls`, label: 'Polls', icon: '◎', badge: pollBadge },
    { href: `/projects/${slug}/tasks`, label: 'Tasks', icon: '✓', badge: taskBadge },
    { href: `/projects/${slug}/guide`, label: 'Guide', icon: '?', badge: undefined },
  ]

  const items = projectType === 'campaign' ? campaignItems : novelItems

  return (
    <>
      <Link
        href={backHref}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-300 font-medium transition-colors border border-transparent"
      >
        {backLabel}
      </Link>

      <div className="mx-3 my-1 border-t border-slate-800/60" />

      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={item.label}
          active={pathname.startsWith(item.href)}
          badge={item.badge}
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
  'Each project has its own chat, docs, chapters, characters, polls, and tasks.',
  'Go to Settings to connect Claude, GPT, or your own OpenClaw server.',
  'You can select a specific model per provider in Settings.',
  'DAN: where your story gets written, argued about, and occasionally voted on.',
]

const PROJECT_TIPS = [
  '@Daneel in chat to get an AI response.',
  '@name to tag a teammate — highlighted in blue.',
  'Story Bible and Project Instructions give Daneel its full context.',
  'Wake Prompt = what Daneel reads on every startup.',
  'Use ↺ Reload Context after editing docs to refresh Daneel.',
  'Ask @Daneel to write or edit a chapter directly — it writes to the file.',
  'Daneel uses patch_chapter for targeted edits and update_chapter for full rewrites.',
  'Ask @Daneel to assign a task to a teammate by name.',
  'Click any task to open it and send your response straight to Daneel.',
  'Yellow badges on Polls and Tasks mean something needs your attention.',
  'The counter bar at the bottom of chat shows your pending polls and tasks.',
  'Use polls to vote on story direction — Daneel will factor in the result.',
  'Ask @Daneel to create a poll — it skips the prose and calls the tool directly.',
  'Click + next to Chapters, Characters, or World to create a new entry inline.',
  'Daneel has read more books than you. He\'s not bragging. He just... has.',
  'Your characters are fictional. Your deadline is not.',
  'In the beginning was the Word document, and the Word document was empty.',
  'All happy stories are alike; each unhappy draft is unhappy in its own way.',
  'Daneel does not sleep. Daneel does not dream. Daneel does not judge chapter 3.',
  'A task unfinished is just a plot twist waiting to happen.',
  'The first rule of Poll Club: you do not talk about Poll Club.',
  'On mobile? Flick up anywhere outside the chat to hide your browser bar.',
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
    }, 30000)
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
  const [pollBadge, setPollBadge] = useState(0)
  const [taskBadge, setTaskBadge] = useState(0)

  // Extract projectSlug from /projects/[slug]/... paths
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectSlug = projectMatch?.[1]
  // Also treat /novels and /campaigns as non-project pages
  const isListPage = pathname === '/novels' || pathname === '/campaigns' || pathname === '/projects'

  useEffect(() => {
    if (!projectSlug) { setPollBadge(0); setTaskBadge(0); return }
    const fetchNotifications = () => {
      fetch(`/api/projects/${projectSlug}/notifications`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) { setPollBadge(d.pendingPolls ?? 0); setTaskBadge(d.pendingTasks ?? 0) } })
        .catch(() => {})
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000)

    const channel = new BroadcastChannel('dan-notifications')
    channel.onmessage = () => fetchNotifications()

    return () => { clearInterval(interval); channel.close() }
  }, [projectSlug])

  return (
    <aside className="w-56 h-full bg-slate-950 border-r border-slate-900 flex flex-col shrink-0">
      <div className="px-4 h-16 border-b border-slate-900 flex items-center justify-between shrink-0">
        <Link href="/novels" className="hover:opacity-80 transition-opacity flex items-center gap-2">
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
          <ProjectNav slug={projectSlug} pathname={pathname} pollBadge={pollBadge} taskBadge={taskBadge} />
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
