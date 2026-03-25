'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ─── Global nav (shown when not inside a project) ─────────────────────────────

const GLOBAL_NAV = [
  { href: '/projects', label: 'Projects', icon: '◫' },
  { href: '/chapters', label: 'Chapters', icon: '◻' },
  { href: '/characters', label: 'Characters', icon: '◯' },
  { href: '/world', label: 'World', icon: '◎' },
  { href: '/agent', label: 'Daneel (Global)', icon: '⬡' },
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
    { href: `/projects/${slug}/chapters`, label: 'Chapters', icon: '◻' },
    { href: `/projects/${slug}/characters`, label: 'Characters', icon: '◯' },
    { href: `/projects/${slug}/world`, label: 'World', icon: '◎' },
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()

  // Extract projectSlug from /projects/[slug]/... paths
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectSlug = projectMatch?.[1]

  return (
    <aside className="w-56 bg-slate-950 border-r border-slate-900 flex flex-col shrink-0">
      <div className="p-5 border-b border-slate-900">
        <Link href="/projects">
          <h1 className="text-base font-bold text-emerald-400 tracking-tight hover:text-emerald-300">
            Dan
          </h1>
        </Link>
        <p className="text-xs text-slate-600 mt-0.5">Collaborative Writing</p>
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

      <div className="p-4 border-t border-slate-900">
        <p className="text-xs text-slate-700">Your name is saved in your browser.</p>
      </div>
    </aside>
  )
}
