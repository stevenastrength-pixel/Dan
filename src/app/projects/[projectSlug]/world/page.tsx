import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const TYPE_COLORS: Record<string, string> = {
  Location: 'bg-emerald-500/20 text-emerald-400',
  Faction: 'bg-blue-500/20 text-blue-400',
  Concept: 'bg-violet-500/20 text-violet-400',
  Item: 'bg-amber-500/20 text-amber-400',
  Event: 'bg-red-500/20 text-red-400',
}

const TYPES = ['Location', 'Faction', 'Concept', 'Item', 'Event']

async function createEntry(projectId: number, projectSlug: string, formData: FormData) {
  'use server'
  const name = formData.get('name') as string
  const type = formData.get('type') as string
  if (!name?.trim()) return
  const entry = await prisma.worldEntry.create({ data: { projectId, name: name.trim(), type } })
  redirect(`/projects/${projectSlug}/world/${entry.id}`)
}

export default async function Page({ params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) notFound()

  const entries = await prisma.worldEntry.findMany({
    where: { projectId: project.id },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  const grouped = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.type]) acc[entry.type] = []
      acc[entry.type].push(entry)
      return acc
    },
    {} as Record<string, typeof entries>
  )

  const action = createEntry.bind(null, project.id, project.slug)

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-200">World Building</h1>
        <span className="text-sm text-slate-600">{entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-12 text-center mb-4">
          <p className="text-slate-600 text-sm">
            No world entries yet. Add your first location, faction, or concept below.
          </p>
        </div>
      ) : (
        <div className="space-y-6 mb-6">
          {TYPES.filter((t) => grouped[t]?.length).map((type) => (
            <div key={type}>
              <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {type}s
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {grouped[type].map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/projects/${project.slug}/world/${entry.id}`}
                    className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm text-slate-200 group-hover:text-emerald-300 transition-colors">
                        {entry.name}
                      </h3>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                          TYPE_COLORS[entry.type] ?? 'bg-slate-700/40 text-slate-400'
                        }`}
                      >
                        {entry.type}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">{entry.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        action={action}
        className="rounded-xl border-2 border-dashed border-slate-800/60 p-5 hover:border-emerald-500/30 transition-colors"
      >
        <div className="flex gap-3">
          <input
            name="name"
            type="text"
            placeholder="Entry name…"
            required
            className="flex-1 text-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <select
            name="type"
            className="text-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
          >
            Add Entry
          </button>
        </div>
      </form>
    </div>
  )
}
