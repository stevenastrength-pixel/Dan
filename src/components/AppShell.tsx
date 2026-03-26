'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import PersistentChat from './PersistentChat'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const onAgent = pathname === '/agent'

  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('dan-username')
    if (stored) setUsername(stored)
  }, [])

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />

      {/* Chat is ALWAYS mounted — CSS hides it when not on /agent */}
      <div
        style={{ display: onAgent ? 'flex' : 'none' }}
        className="flex-col w-1/2 overflow-hidden border-r border-slate-200"
      >
        <PersistentChat username={username} />
      </div>

      <main
        className="overflow-auto flex flex-col"
        style={{ flex: 1 }}
      >
        {children}
      </main>
    </div>
  )
}
