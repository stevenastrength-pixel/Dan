import { prisma } from '@/lib/prisma'

// ─── Slug helper ──────────────────────────────────────────────────────────────

export function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── Novel document templates ─────────────────────────────────────────────────

const STORY_BIBLE_TEMPLATE = `# STORY BIBLE — [PROJECT TITLE]
## Novel Project — Master Reference Document

---

## LOGLINE

[One to three sentences. Who is the protagonist? What do they want or need? What stands in their way? What is at stake?]

---

## THEMES

1. **[Theme name]** — [What does this theme ask or explore?]
2. **[Theme name]** — [What does this theme ask or explore?]
3. **[Theme name]** — [What does this theme ask or explore?]

---

## WORLD-BUILDING

### The Setting
[Describe the world: time period, location, atmosphere, rules. What makes this world distinct? What is the social, political, or economic landscape the story lives inside?]

### [Key World Element — faction, system, technology, institution]
[Describe it. What is it? Who controls it? How does it shape the story?]

---

## CHARACTERS

### [PROTAGONIST NAME]
**Role:** Protagonist
**Age:** [Age or range]
**Occupation:** [What they do day to day]
**Physical:** [Key distinguishing features — brief]
**Voice:** [How they speak and think. What is their inner register?]
**Core trait:** [The one defining quality — what drives them or limits them]
**History:** [Only the backstory that matters to the story]
**Arc:** [Where they start → key turning points → where they end]

### [SUPPORTING CHARACTER]
**Role:** [Their function in the story]
**Core trait:** [What defines them]
**History:** [Relevant background]
**Arc:** [How they change or what they represent]

---

## CHAPTER OUTLINE

### CH. 1 — [TITLE]
[Brief beat summary — what happens, what changes, what the reader feels]

### CH. 2 — [TITLE]
[Brief beat summary]`

const STYLE_GUIDE_TEMPLATE = `# STYLE GUIDE — [PROJECT TITLE]

## Voice
[Whose perspective? First person, third limited, omniscient? What is the narrative distance?]

## Tone
[What is the emotional register of this book? Dark? Wry? Urgent? Lyrical?]

## Prose Style
[Short sentences or long? Dense or spare? What writers or books does this sound like?]

## What to Avoid
[List specific things: passive constructions, adverbs, clichés, sentimentality, over-explanation.]

## Sample Paragraph
[Paste a paragraph that captures the target voice.]`

const PROJECT_INSTRUCTIONS_TEMPLATE = `# PROJECT INSTRUCTIONS — [PROJECT TITLE]

## Overview
[A brief description of the project for Daneel's orientation.]

## Current Priorities
[What is the team working on right now?]

## Locked Decisions
[Anything currently off-limits. Locked decisions, completed sections that aren't to be revised, characters whose arcs are final.]`

const WAKE_PROMPT_TEMPLATE = `# WAKE PROMPT — [PROJECT TITLE]

Daneel reads this at the start of every session to orient itself. Keep it current. It should always reflect where the project stands right now — not where it was last month.

---

## CURRENT STATUS

[Where is the project right now? What draft stage? What chapters or sections are complete, in progress, or unstarted?]

## ACTIVE FOCUS

[What is the team working on right now? What does Daneel need to be most helpful with this week?]

## RECENT DECISIONS

[Decisions made since the last update that Daneel should know. Character changes, plot pivots, structural shifts, style choices.]

## OPEN QUESTIONS

[Things still unresolved. Daneel should not answer these — it should flag them when they become relevant.]

## NOTES FOR THIS SESSION

[Anything specific to right now — a scene you're stuck on, a tone problem, a question you want to explore with Daneel today.]`

export function getCoreDocsForProject(projectName: string) {
  const fill = (s: string) => s.replace(/\[PROJECT TITLE\]/g, projectName)
  return [
    { key: 'story_bible', title: 'Story Bible', content: fill(STORY_BIBLE_TEMPLATE) },
    { key: 'style_guide', title: 'Style Guide', content: fill(STYLE_GUIDE_TEMPLATE) },
    { key: 'project_instructions', title: 'Project Instructions', content: fill(PROJECT_INSTRUCTIONS_TEMPLATE) },
    { key: 'wake_prompt', title: 'Wake Prompt', content: fill(WAKE_PROMPT_TEMPLATE) },
  ]
}

export function getCampaignDocsForProject(projectName: string, premise: string, setting: string) {
  return [
    {
      key: 'campaign_overview',
      title: 'Campaign Overview',
      content: `# CAMPAIGN OVERVIEW — ${projectName}\n\n## Premise\n${premise || '[Write your campaign premise here — the hook, the central conflict, what draws the party in.]'}\n\n## Adventure Background\n[The history behind the conflict. What happened before the party arrived? What forces are in motion?]\n\n## Themes\n- [Theme 1]\n- [Theme 2]\n- [Theme 3]\n\n## Tone\n[Dark? Heroic? Mysterious? How should this campaign feel at the table?]\n\n## Adventure Synopsis\n[A brief overview of the full arc — beginning, middle, end. Keep it high-level.]`,
    },
    {
      key: 'running_this_campaign',
      title: 'Running This Campaign',
      content: `# RUNNING THIS CAMPAIGN — ${projectName}\n\n## GM Guidance\n[Key things to know before running this campaign.]\n\n## Adventure Hooks\n[Ways to draw the party into the adventure. Give 2–3 options.]\n\n## Adjusting Difficulty\n[Notes on scaling encounters for different party sizes or levels.]\n\n## Content Warnings\n[Note any mature or sensitive content in this campaign.]`,
    },
    {
      key: 'setting_guide',
      title: 'Setting Guide',
      content: `# SETTING GUIDE — ${setting || projectName}\n\n## Overview\n[Describe the setting — geography, history, atmosphere, what makes it distinct.]\n\n## Key Locations\n[Major areas of the campaign world.]\n\n## Calendar & Time\n[How time works in this setting. Seasons, important dates, in-world calendar.]\n\n## Factions\n[Major power groups operating in this setting.]`,
    },
    {
      key: 'session_zero',
      title: 'Session Zero / Safety Notes',
      content: `# SESSION ZERO & SAFETY — ${projectName}\n\n## Session Zero Agenda\n[What to cover with your players before the campaign begins.]\n\n## Lines & Veils\n**Lines** (never goes there):\n- \n\n**Veils** (happens, but off-screen):\n- \n\n## Safety Tools\n[X-Card, Lines & Veils, Open Door Policy — describe what you're using.]\n\n## Content Flags\n[Flag any heavy themes so players can opt in knowingly.]`,
    },
    {
      key: 'house_rules',
      title: 'House Rules',
      content: `# HOUSE RULES — ${projectName}\n\n[Document any rules modifications for this campaign.]\n\n## Combat\n-\n\n## Exploration\n-\n\n## Social\n-\n\n## Other\n-`,
    },
    {
      key: 'wake_prompt',
      title: 'Wake Prompt',
      content: `# WAKE PROMPT — ${projectName}\n\nDaneel reads this at the start of every session to orient itself as GM co-author.\n\n---\n\n## CURRENT STATUS\n[Where is the campaign right now? Which sessions are complete, in progress, or unwritten?]\n\n## ACTIVE FOCUS\n[What are we building right now? Which session, location, or encounter needs work?]\n\n## RECENT DECISIONS\n[Plot decisions, NPC changes, world-building choices made since last update.]\n\n## OPEN QUESTIONS\n[Unresolved story questions. Daneel should surface these, not answer them.]\n\n## NOTES FOR THIS SESSION\n[Anything specific to right now — a scene you're stuck on, an NPC you need to develop.]`,
    },
  ]
}

// ─── Project creation ─────────────────────────────────────────────────────────

export async function createProject(params: {
  name: string
  type: 'novel' | 'campaign'
  description?: string
  premise?: string
  setting?: string
  minLevel?: number
  maxLevel?: number
  partySize?: number
  levelingMode?: string
  creatorUsername?: string
}): Promise<{ id: number; slug: string; name: string; type: string }> {
  const { name, type, description, premise, setting, minLevel, maxLevel, partySize, levelingMode, creatorUsername } = params

  const baseSlug = toSlug(name.trim())
  let slug = baseSlug
  let attempt = 0
  while (await prisma.project.findUnique({ where: { slug } })) {
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const docs = type === 'campaign'
    ? getCampaignDocsForProject(name.trim(), premise ?? '', setting ?? '')
    : getCoreDocsForProject(name.trim())

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() ?? '',
      type,
      ...(type === 'campaign' ? {
        minLevel: minLevel ?? 1,
        maxLevel: maxLevel ?? 10,
        partySize: partySize ?? 4,
        levelingMode: levelingMode ?? 'milestone',
      } : {}),
      ...(creatorUsername ? { contributors: { create: { username: creatorUsername } } } : {}),
      documents: { create: docs },
    },
  })

  return { id: project.id, slug: project.slug, name: project.name, type: project.type }
}
