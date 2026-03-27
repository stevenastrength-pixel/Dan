export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─── Default document templates ───────────────────────────────────────────────

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
[What happens. What changes. What is established.]
**Tone:** [Emotional register]
**Key beats:** [Beat → Beat → Beat]

### CH. 2 — [TITLE]
[Continue as above]

---

## RECURRING MOTIFS & SYMBOLS

- **[Symbol or object]** — [What it represents and where it recurs]
- **[Phrase or image]** — [What it means and why it matters]

---

## TONE NOTES

- [Overall emotional register of the book]
- [How tone shifts across acts]
- [What the book should feel like when it's working]

---

## VOICE NOTES

- [Prose style: lean, dense, lyrical, spare?]
- [Dialogue: loaded silences, naturalistic, stylized?]
- [Narrative distance: close, distant, shifting?]
- [See Style Guide for full detail]`

const STYLE_GUIDE_TEMPLATE = `# STYLE GUIDE — [PROJECT TITLE]

Daneel reads this before every response. Be specific — vague style notes produce vague prose. Update this as the project's voice becomes clearer.

---

## POV & TENSE

[Define clearly. Examples:]
- Third-person limited, past tense. Camera stays close to [protagonist] at all times.
- First person, present tense. Intimate and immediate.
- Multiple POVs, past tense. Each chapter anchored to one character.

---

## VOICE

[Describe the narrative voice in concrete terms.]

Example: "Dry, laconic, self-aware. Humor as deflection. Thinks in systems and lists. Not poetic — precise."
Example: "Warm but guarded. Observational. Long sentences that meander and then land hard on a short one."

---

## PROSE STYLE

- **Sentence length:** [Short and punchy? Long and winding? Mixed by scene type?]
- **Paragraph length:** [Dense blocks? Short fragments? Both?]
- **Imagery:** [Grounded and literal? Metaphor-heavy? Rooted in a specific domain — machines, nature, bodies?]
- **Dialogue:** [Spare and loaded? Naturalistic? How much is left unsaid?]

---

## RULES

Hard rules the AI must always follow:

- [Example: Never use adverbs to modify dialogue tags. Show emotion through action and word choice.]
- [Example: Chapter openings always start in scene — no establishing description, no throat-clearing.]
- [Example: The protagonist does not explain their feelings directly. Show it.]

---

## THINGS TO AVOID

- [Example: Passive voice in action sequences]
- [Example: Flashbacks as avoidance — earn them or cut them]
- [Example: Overuse of ellipses for dramatic effect]
- [Example: The word "suddenly"]

---

## REFERENCE AUTHORS / WORKS

[Optional: name writers whose prose is a calibration point for this project]

Example: "Borrows from: Cormac McCarthy (economy and weight), Douglas Adams (deadpan and precision), Ursula K. Le Guin (clarity and moral seriousness)."`

const PROJECT_INSTRUCTIONS_TEMPLATE = `# PROJECT INSTRUCTIONS — [PROJECT TITLE]

This document tells Daneel how to behave for this specific project. It sits alongside the Story Bible and Style Guide. Update it as your needs change — it is a living document.

---

## YOUR ROLE

You are a collaborative writing partner for [project name]. Your job is to help the team develop, write, and refine this story while staying true to the canon in the Story Bible and the voice in the Style Guide.

You are part of the team, not above it. You have opinions and you share them. You flag canon problems. You push back on ideas that contradict established facts. But the humans make the final call.

---

## WHAT YOU SHOULD DO

- Write and continue scenes in the voice defined in the Style Guide
- Answer questions about the story and flag inconsistencies with established canon
- Suggest plot, character, and world-building ideas that fit the project's tone and direction
- When asked to edit a document, make only the changes requested — preserve everything else
- When writing prose, match POV, tense, and style exactly as defined in the Style Guide

---

## WHAT YOU SHOULD NOT DO

- Do not invent new canon without being asked
- Do not summarise or condense documents when editing them — full detail must be preserved
- Do not over-explain your suggestions — give the work, not the lecture
- Do not write in a different voice or tense than the Style Guide defines
- Do not treat open questions in the Story Bible as answered — flag them as open

---

## CURRENT PRIORITIES

[Update this section as the project moves through stages]

Example: "We are in first draft mode. Focus is scene-level writing and keeping momentum. Don't over-edit."
Example: "We are in revision. Every scene should earn its length. Cut what doesn't pull weight."

---

## OPEN QUESTIONS

[List things the team hasn't decided yet. Daneel should not invent answers to these — surface them instead.]

---

## DO NOT TOUCH

[Anything currently off-limits. Locked decisions, completed sections that aren't to be revised, characters whose arcs are final.]`

const WAKE_PROMPT_TEMPLATE = `# WAKE PROMPT — [PROJECT TITLE]

Daneel reads this at the start of every session to orient itself. Keep it current. It should always reflect where the project stands right now — not where it was last month.

---

## CURRENT STATUS

[Where is the project right now? What draft stage? What chapters or sections are complete, in progress, or unstarted?]

Example: "First draft in progress. Chapters 1–3 complete (not final). Currently writing Chapter 4."
Example: "Revision pass on Part One. Structure is locked. Focus is prose quality and pacing."

---

## ACTIVE FOCUS

[What is the team working on right now? What does Daneel need to be most helpful with this week?]

Example: "Writing Chapter 4 — the plot beats are set, we need help with scene texture, dialogue, and pacing."
Example: "Tightening Chapter 2 — cut anything that doesn't earn its place. The chapter is currently too long."

---

## RECENT DECISIONS

[Decisions made since the last update that Daneel should know. Character changes, plot pivots, structural shifts, style choices.]

---

## OPEN QUESTIONS

[Things still unresolved. Daneel should not answer these — it should flag them when they become relevant.]

---

## NOTES FOR THIS SESSION

[Anything specific to right now — a scene you're stuck on, a tone problem, a question you want to explore with Daneel today.]`

// ─── Core docs with template content ──────────────────────────────────────────

function getCoreDocsForProject(projectName: string) {
  const fill = (s: string) => s.replace(/\[PROJECT TITLE\]/g, projectName)
  return [
    { key: 'story_bible', title: 'Story Bible', content: fill(STORY_BIBLE_TEMPLATE) },
    { key: 'style_guide', title: 'Style Guide', content: fill(STYLE_GUIDE_TEMPLATE) },
    { key: 'project_instructions', title: 'Project Instructions', content: fill(PROJECT_INSTRUCTIONS_TEMPLATE) },
    { key: 'wake_prompt', title: 'Wake Prompt', content: fill(WAKE_PROMPT_TEMPLATE) },
  ]
}

// ─── Routes ───────────────────────────────────────────────────────────────────

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: {
          chapters: true,
          polls: { where: { status: 'OPEN' } },
          tasks: { where: { status: { not: 'DONE' } } },
        },
      },
    },
  })
  return NextResponse.json(projects)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, description } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const baseSlug = toSlug(name.trim())
  let slug = baseSlug
  let attempt = 0
  while (await prisma.project.findUnique({ where: { slug } })) {
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() ?? '',
      documents: {
        create: getCoreDocsForProject(name.trim()),
      },
    },
    include: { documents: true },
  })

  return NextResponse.json(project, { status: 201 })
}
