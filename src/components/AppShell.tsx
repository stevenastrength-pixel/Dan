'use client'

import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

type MenuCtx = { open: boolean; toggle: () => void }
export const MobileMenuContext = createContext<MenuCtx>({ open: false, toggle: () => {} })
export const useMobileMenu = () => useContext(MobileMenuContext)

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [squish, setSquish] = useState(false)
  const pathname = usePathname()
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const touchStartY = useRef(0)

  useEffect(() => { setOpen(false) }, [pathname])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Don't squish when scrolling inside a chat or other scrollable panel
    const target = e.target as HTMLElement
    if (target.closest('[data-no-squish]')) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy < -10) setSquish(true)
  }

  const handleTouchEnd = () => {
    setSquish(false)
  }

  return (
    <MobileMenuContext.Provider value={{ open, toggle: () => setOpen(v => !v) }}>
      <div
        className="fixed inset-0 flex bg-slate-950 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: squish ? 'scaleY(0.985)' : 'scaleY(1)', transformOrigin: 'top', transition: squish ? 'none' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
      >

        {/* Mobile backdrop */}
        {open && !isAuthPage && (
          <div
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Nav sidebar — hidden on auth pages, slides in on mobile, always visible on md+ */}
        {!isAuthPage && (
          <div className={`
            fixed md:static inset-y-0 left-0 z-40 shrink-0
            transition-transform duration-200 ease-in-out
            ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            <Sidebar />
          </div>
        )}

        <main className={`overflow-auto flex flex-col flex-1 min-h-0 transition-transform duration-200 ease-in-out ${!isAuthPage && open ? 'translate-x-56 md:translate-x-0' : 'translate-x-0'}`}>
          {children}
        </main>

      </div>
    </MobileMenuContext.Provider>
  )
}
