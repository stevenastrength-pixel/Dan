import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function createEntry(formData: FormData) {
  'use server'
  const name = formData.get('name') as string
  const type = formData.get('type') as string
  if (!name?.trim()) return
  const entry = await prisma.worldEntry.create({ data: { name: name.trim(), type } })
  redirect(`/world/${entry.id}`)
}

const TYPE_COLORS: Record<string, string> = {
  Location: 'bg-emerald-100 text-emerald-700',
  Faction: 'bg-blue-100 text-blue-700',
  Concept: 'bg-violet-100 text-violet-700',
  Item: 'bg-amber-100 text-amber-700',
  Event: 'bg-red-100 text-red-700',
}

const TYPES = ['Location', 'Faction', 'Concept', 'Item', 'Event']

export default async function WorldPage() {
  const entries = await prisma.worldEntry.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] })

  const grouped = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.type]) acc[entry.type] = []
      acc[entry.type].push(entry)
      return acc
    },
    {} as Record<string, typeof entries>
  )

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">World Building</h1>
        <span className="text-sm text-slate-400">{entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center mb-4">
          <p className="text-slate-400 text-sm">
            No world entries yet. Add your first location, faction, or concept below.
          </p>
        </div>
      ) : (
        <div className="space-y-6 mb-6">
          {TYPES.filter((t) => grouped[t]?.length).map((type) => (
            <div key={type}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {type}s
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {grouped[type].map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/world/${entry.id}`}
                    className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-indigo-200 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {entry.name}
                      </h3>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                          TYPE_COLORS[entry.type] ?? 'bg-slate-100 text-slate-600'
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
        action={createEntry}
        className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-5 hover:border-indigo-300 transition-colors"
      >
        <div className="flex gap-3">
          <input
            name="name"
            type="text"
            placeholder="Entry name…"
            required
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            name="type"
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Add Entry
          </button>
        </div>
      </form>
    </div>
  )
}
