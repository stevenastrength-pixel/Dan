'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function PlayPage() {
  const params = useParams()
  const slug = params.projectSlug as string

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 gap-6 px-8 text-center">
      <div className="text-5xl">▶</div>
      <div>
        <h1 className="text-xl font-bold text-slate-200 mb-2">AI Dungeon Crawler</h1>
        <p className="text-sm text-slate-500 max-w-md">
          Play your campaign co-op with Daneel as DM. Explore locations, fight
          encounters, and progress through the story — your actual campaign content
          comes alive.
        </p>
        <p className="text-xs text-amber-400 mt-4 font-medium">Coming in Phase C</p>
      </div>
      <div className="flex gap-3">
        <Link href={`/projects/${slug}/party`}
          className="px-4 py-2 border border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 text-sm font-medium rounded-lg transition-colors">
          Set up Party first →
        </Link>
        <Link href={`/projects/${slug}/sheet`}
          className="px-4 py-2 border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 text-sm font-medium rounded-lg transition-colors">
          Create Character
        </Link>
      </div>
    </div>
  )
}
