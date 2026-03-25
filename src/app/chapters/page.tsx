import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function createChapter(formData: FormData) {
  'use server'
  const title = formData.get('title') as string
  if (!title?.trim()) return
  const maxOrder = await prisma.chapter.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const chapter = await prisma.chapter.create({
    data: { title: title.trim(), order: (maxOrder?.order ?? 0) + 1 },
  })
  redirect(`/chapters/${chapter.id}`)
}

export default async function ChaptersPage() {
  const chapters = await prisma.chapter.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { comments: true, versions: true } } },
  })

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Chapters</h1>
        <span className="text-sm text-slate-400">{chapters.length} total</span>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter, idx) => (
          <Link
            key={chapter.id}
            href={`/chapters/${chapter.id}`}
            className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                  Chapter {idx + 1}
                </p>
                <h2 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {chapter.title}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                {chapter._count.comments > 0 && (
                  <span title="Comments">💬 {chapter._count.comments}</span>
                )}
                {chapter._count.versions > 0 && (
                  <span title="Saved versions">🕐 {chapter._count.versions}</span>
                )}
                <span>{new Date(chapter.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Link>
        ))}

        <form
          action={createChapter}
          className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-5 hover:border-indigo-300 transition-colors"
        >
          <div className="flex gap-3">
            <input
              name="title"
              type="text"
              placeholder="New chapter title…"
              required
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Add Chapter
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
