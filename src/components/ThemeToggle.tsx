'use client'

import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  const containerCls = theme === 'dark'
    ? 'border-slate-700 bg-slate-900'
    : 'border-slate-300 bg-white shadow-sm'

  const sunCls = theme === 'light'
    ? 'bg-amber-100 text-amber-500'
    : 'text-slate-500 hover:text-slate-400'

  const moonCls = theme === 'dark'
    ? 'bg-slate-700 text-indigo-300'
    : 'text-slate-400 hover:text-slate-500'

  return (
    <div className={`flex items-center rounded-lg border p-0.5 transition-colors ${containerCls} ${className ?? ''}`}>
      <button
        onClick={() => setTheme('light')}
        title="Light mode"
        className={`px-2 py-1 rounded-md text-sm leading-none transition-all ${sunCls}`}
      >
        ☀
      </button>
      <button
        onClick={() => setTheme('dark')}
        title="Dark mode"
        className={`px-2 py-1 rounded-md text-sm leading-none transition-all ${moonCls}`}
      >
        ☾
      </button>
    </div>
  )
}
