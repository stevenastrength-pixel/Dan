const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const CORE_DOCS = [
  { key: 'story_bible', title: 'Story Bible' },
  { key: 'project_instructions', title: 'Project Instructions' },
  { key: 'wake_prompt', title: 'Wake Prompt' },
]

async function main() {
  // Ensure the default project (id=1) exists
  let project = await prisma.project.findFirst({ where: { id: 1 } })

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'My Novel',
        slug: 'my-novel',
        description: 'A collaborative novel project.',
      },
    })
    console.log(`✓ Created default project: "${project.name}" (id=${project.id})`)
  } else {
    console.log(`✓ Default project already exists: "${project.name}" (id=${project.id})`)
  }

  // Ensure all three core docs exist for the default project
  for (const doc of CORE_DOCS) {
    const existing = await prisma.projectDocument.findUnique({
      where: { projectId_key: { projectId: project.id, key: doc.key } },
    })
    if (!existing) {
      await prisma.projectDocument.create({
        data: { projectId: project.id, key: doc.key, title: doc.title },
      })
      console.log(`  ✓ Created document: "${doc.title}"`)
    } else {
      console.log(`  · Document already exists: "${doc.title}"`)
    }
  }

  console.log('\nSeed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
