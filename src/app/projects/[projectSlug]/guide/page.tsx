import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import CampaignGuide from './CampaignGuide'
import NovelGuide from './NovelGuide'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { projectSlug: string } }) {
  const project = await prisma.project.findUnique({ where: { slug: params.projectSlug } })
  if (!project) notFound()
  if (project.type === 'campaign') return <CampaignGuide projectName={project.name} />
  return <NovelGuide projectName={project.name} />
}
