import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function createCharacter(formData: FormData) {
  'use server'
  const name = formData.get('name') as string
  if (!name?.trim()) return
  const character = await prisma.character.create({ data: { name: name.trim() } })
  redirect(`/characters/${character.id}`)
}

const ROLE_COLORS: Record<string, string> = {
  Protagonist: 'bg-indigo-100 text-indigo-700',
  Antagonist: 'bg-red-100 text-red-700',
  Supporting: 'bg-slate-100 text-slate-600',
  Mentor: 'bg-amber-100 text-amber-700',
  'Love Interest': 'bg-pink-100 text-pink-700',
  Minor: 'bg-gray-100 text-gray-600',
}

export default async function CharactersPage() {
  const characters = await prisma.character.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Characters</h1>
        <span className="text-sm text-slate-400">{characters.length} total</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {characters.map((character) => (
          <Link
            key={character.id}
            href={`/characters/${character.id}`}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {character.name}
              </h2>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  ROLE_COLORS[character.role] ?? 'bg-slate-100 text-slate-600'
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
        action={createCharacter}
        className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-5 hover:border-indigo-300 transition-colors"
      >
        <div className="flex gap-3">
          <input
            name="name"
            type="text"
            placeholder="New character name…"
            required
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Add Character
          </button>
        </div>
      </form>
    </div>
  )
}
