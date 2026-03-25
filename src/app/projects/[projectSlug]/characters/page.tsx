import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const ROLE_COLORS: Record<string, string> = {
  Protagonist: 'bg-emerald-500/20 text-emerald-400',
  Antagonist: 'bg-red-500/20 text-red-400',
  Supporting: 'bg-slate-700/40 text-slate-400',
  Mentor: 'bg-amber-500/20 text-amber-400',
  'Love Interest': 'bg-pink-500/20 text-pink-400',
  Minor: 'bg-slate-700/30 text-slate-500',
}

async function createCharacter(projectId: number, projectSlug: string, formData: FormData) {
  'use server'
  const name = formData.get('name') as string
  if (!name?.trim()) return
  const character = await prisma.character.create({ data: { projectId, name: name.trim() } })
  redirect(`/projects/${projectSlug}/characters/${character.id}`)
}

export default async function Page({ params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) notFound()

  const characters = await prisma.character.findMany({
    where: { projectId: project.id },
    orderBy: { name: 'asc' },
  })

  const action = createCharacter.bind(null, project.id, project.slug)

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-200">Characters</h1>
        <span className="text-sm text-slate-600">{characters.length} total</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {characters.map((character) => (
          <Link
            key={character.id}
            href={`/projects/${project.slug}/characters/${character.id}`}
            className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-5 hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                {character.name}
              </h2>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  ROLE_COLORS[character.role] ?? 'bg-slate-700/40 text-slate-400'
                }`}
              >
                {character.role}
              </span>
            </div>
            {character.description && (
              <p className="text-sm text-slate-500 mt-2 line-clamp-2">{character.description}</p>
            )}
          </Link>
        ))}
      </div>

      <form
        action={action}
        className="rounded-xl border-2 border-dashed border-slate-800/60 p-5 hover:border-emerald-500/30 transition-colors"
      >
        <div className="flex gap-3">
          <input
            name="name"
            type="text"
            placeholder="New character name…"
            required
            className="flex-1 text-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
          >
            Add Character
          </button>
        </div>
      </form>
    </div>
  )
}
