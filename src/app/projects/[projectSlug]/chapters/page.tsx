import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function createChapter(projectId: number, projectSlug: string, formData: FormData) {
  'use server'
  const title = formData.get('title') as string
  if (!title?.trim()) return
  const maxOrder = await prisma.chapter.findFirst({
    where: { projectId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const chapter = await prisma.chapter.create({
    data: { projectId, title: title.trim(), order: (maxOrder?.order ?? 0) + 1 },
  })
  redirect(`/projects/${projectSlug}/chapters/${chapter.id}`)
}

export default async function Page({ params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) notFound()

  const chapters = await prisma.chapter.findMany({
    where: { projectId: project.id },
    orderBy: { order: 'asc' },
    include: { _count: { select: { comments: true, versions: true } } },
  })

  const action = createChapter.bind(null, project.id, project.slug)

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-200">Chapters</h1>
        <span className="text-sm text-slate-600">{chapters.length} total</span>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter, idx) => (
          <Link
            key={chapter.id}
            href={`/projects/${project.slug}/chapters/${chapter.id}`}
            className="block rounded-xl border border-slate-800/60 bg-slate-900/60 p-5 hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                  Chapter {idx + 1}
                </p>
                <h2 className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                  {chapter.title}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
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
          action={action}
          className="rounded-xl border-2 border-dashed border-slate-800/60 p-5 hover:border-emerald-500/30 transition-colors"
        >
          <div className="flex gap-3">
            <input
              name="title"
              type="text"
              placeholder="New chapter title…"
              required
              className="flex-1 text-sm bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
            >
              Add Chapter
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
