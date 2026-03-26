'use client'

import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

const ACCENT_DARK = '#22C55E'
const ACCENT_LIGHT = '#F59E0B'
const FG_DARK = '#E5E7EB'
const FG_LIGHT = '#2D1B69'
const FG_BRIGHT = '#F9FAFB'

const CX = 28
const CY = 40
const NODES = [
  { x: 30, y: 18 },
  { x: 42, y: 52 },
  { x: 18, y: 54 },
]
const HEX_R = 5
const hexPoints = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i - Math.PI / 2
  return `${CX + HEX_R * Math.cos(angle)},${CY + HEX_R * Math.sin(angle)}`
}).join(' ')

// ─── Icon only (sidebar) ──────────────────────────────────────────────────────

export function DanIcon({ size = 28 }: { size?: number }) {
  const [hovered, setHovered] = useState(false)
  const { theme } = useTheme()
  const FG = theme === 'light' ? FG_LIGHT : FG_DARK
  const ACCENT = theme === 'light' ? ACCENT_LIGHT : ACCENT_DARK
  return (
    <svg
      viewBox="0 0 68 80"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size * (80 / 68)}
      role="img"
      aria-label="DAN"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <path
        d="M 12,12 L 12,68 L 26,68 C 48,68 56,56 56,40 C 56,24 48,12 26,12 Z"
        fill="none"
        stroke={FG}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {NODES.map((n, i) => (
        <line
          key={i}
          x1={n.x} y1={n.y} x2={CX} y2={CY}
          stroke={ACCENT} strokeWidth="1"
          strokeOpacity={hovered ? 1 : 0.55}
          style={{ transition: 'stroke-opacity .3s ease' }}
        />
      ))}
      <polygon
        points={hexPoints}
        fill="none" stroke={ACCENT} strokeWidth="1.2"
        strokeOpacity={hovered ? 1 : 0.7}
        style={{ transition: 'stroke-opacity .3s ease' }}
      />
      {NODES.map((n, i) => (
        <circle
          key={i}
          cx={n.x} cy={n.y} r="2.8"
          fill={ACCENT} fillOpacity={hovered ? 1 : 0.75}
          style={{ transition: 'fill-opacity .3s ease' }}
        />
      ))}
      <circle cx={CX} cy={CY} r="1.6" fill={ACCENT} />
    </svg>
  )
}

// ─── Full logo (login / register) ─────────────────────────────────────────────

export default function DanLogo() {
  const [hovered, setHovered] = useState(false)
  const { theme } = useTheme()
  const FG = theme === 'light' ? FG_LIGHT : FG_DARK
  const ACCENT = theme === 'light' ? ACCENT_LIGHT : ACCENT_DARK
  return (
    <div
      className="flex flex-col items-center gap-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon */}
      <svg
        viewBox="0 0 68 80"
        xmlns="http://www.w3.org/2000/svg"
        width={120}
        height={140}
        role="img"
        aria-label="DAN"
      >
        <path
          d="M 12,12 L 12,68 L 26,68 C 48,68 56,56 56,40 C 56,24 48,12 26,12 Z"
          fill="none"
          stroke={FG}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {NODES.map((n, i) => (
          <line
            key={i}
            x1={n.x} y1={n.y} x2={CX} y2={CY}
            stroke={ACCENT} strokeWidth="1"
            strokeOpacity={hovered ? 1 : 0.55}
            style={{ transition: 'stroke-opacity .3s ease' }}
          />
        ))}
        <polygon
          points={hexPoints}
          fill="none" stroke={ACCENT} strokeWidth="1.2"
          strokeOpacity={hovered ? 1 : 0.7}
          style={{ transition: 'stroke-opacity .3s ease' }}
        />
        {NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x} cy={n.y} r="2.8"
            fill={ACCENT} fillOpacity={hovered ? 1 : 0.75}
            style={{ transition: 'fill-opacity .3s ease' }}
          />
        ))}
        <circle cx={CX} cy={CY} r="1.6" fill={ACCENT} />
      </svg>

      {/* Wordmark */}
      <div className="text-center">
        <p className="text-5xl font-semibold tracking-[0.3em] text-slate-900 dark:text-white">DAN</p>
        <p className="text-sm tracking-[0.2em] text-slate-500 mt-2 uppercase">
          Distributed Authoring Nexus
        </p>
      </div>
    </div>
  )
}
