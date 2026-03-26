'use client'

import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <main className="overflow-auto flex flex-col flex-1">
        {children}
      </main>
    </div>
  )
}
