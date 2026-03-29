import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import EncountersPage from './EncountersPage'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) notFound()
  return <EncountersPage project={{
    name: project.name,
    slug: project.slug,
    partySize: project.partySize ?? undefined,
    minLevel: project.minLevel ?? undefined,
    maxLevel: project.maxLevel ?? undefined,
  }} />
}
