import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import AgentPage from './AgentPage'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({
    where: { slug: params.projectSlug },
  })
  if (!project) notFound()

  return (
    <AgentPage
      project={{
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
      }}
    />
  )
}
