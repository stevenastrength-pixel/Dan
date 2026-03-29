'use client'

import { useEffect, useRef, useState } from 'react'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'agent', label: 'Working with Daneel' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'characters', label: 'Characters' },
  { id: 'world', label: 'World Building' },
  { id: 'documents', label: 'Documents' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'polls', label: 'Polls' },
  { id: 'tips', label: 'Tips & Best Practices' },
]

function Prompt({ children }: { children: string }) {
  return (
    <div className="my-3 flex gap-2 items-start">
      <span className="shrink-0 text-emerald-500 font-mono text-sm mt-0.5">@Daneel</span>
      <p className="text-slate-300 text-sm italic leading-relaxed">{children}</p>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-8">
      <h2 className="text-xl font-bold text-slate-100 mb-4 pb-3 border-b border-slate-800">{title}</h2>
      {children}
    </section>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200/80 leading-relaxed">
      {children}
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-200/80 leading-relaxed">
      {children}
    </div>
  )
}

export default function NovelGuide({ projectName }: { projectName: string }) {
  const [activeSection, setActiveSection] = useState('overview')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { root: container, rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )

    const sections = container.querySelectorAll('section[id]')
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sticky nav */}
      <div className="w-52 shrink-0 border-r border-slate-800 overflow-y-auto py-6">
        <div className="px-4 mb-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Novel Guide</div>
          <div className="text-xs text-slate-600 mt-0.5 truncate">{projectName}</div>
        </div>
        <nav className="space-y-0.5">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full text-left px-4 py-1.5 text-sm transition-colors rounded-sm ${
                activeSection === s.id
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-10">

          <Section id="overview" title="Overview">
            <p className="text-slate-300 leading-relaxed mb-4">
              DAN novel mode is a collaborative workspace for writing fiction with a team.
              You can build entirely in the <strong className="text-slate-200">Agent</strong> chat using natural language,
              or work directly on any page — every section has full create, edit, and delete controls.
              Daneel and the manual pages stay in sync: anything created in chat appears instantly on the relevant page, and vice versa.
            </p>
            <p className="text-slate-300 leading-relaxed mb-4">
              Think of DAN as the shared nerve centre of your writing project — where the prose lives,
              the cast is tracked, the world is documented, and the team communicates,
              all without switching tools.
            </p>

            <Sub title="The two-layer model">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex gap-2"><span className="text-slate-500 shrink-0 mt-0.5">→</span><span><strong className="text-slate-200">Chapters</strong> hold the actual prose — the text your readers will eventually read. Each chapter is a rich-text document with version history and inline comments.</span></li>
                <li className="flex gap-2"><span className="text-slate-500 shrink-0 mt-0.5">→</span><span><strong className="text-slate-200">Structured data</strong> (characters, world entries, documents) is stored as database records that Daneel can reference, update, and reason about when it writes.</span></li>
              </ul>
            </Sub>

            <Sub title="What Daneel can access">
              <p className="text-slate-400 text-sm">
                Every time you @mention Daneel, it reads your full project context before responding:
                all documents, every chapter title and synopsis, the complete character database,
                and all world entries. You never need to paste your story bible into the chat.
              </p>
            </Sub>
          </Section>

          <Section id="agent" title="Working with Daneel">
            <p className="text-slate-300 leading-relaxed mb-4">
              Daneel responds whenever you type <strong className="text-slate-200">@Daneel</strong> in the Agent chat.
              It reads your entire project — all documents, all chapters, all characters — before every response.
              Multiple writers can work in the same chat, and Daneel tracks who said what.
            </p>

            <Sub title="Getting started">
              <Prompt>I want to write a dark fantasy novel about a necromancer trying to redeem herself. The setting is a crumbling empire. Write the story bible — premise, themes, tone, cast of main characters, and the central conflict.</Prompt>
              <Prompt>We&apos;re writing a near-future thriller. The protagonist is a corporate whistleblower. Create the story bible and set up three main characters: the protagonist, her handler at the newspaper, and the corporate antagonist.</Prompt>
            </Sub>

            <Sub title="Writing chapters">
              <Prompt>Write Chapter 1: the protagonist wakes up in a safehouse. She doesn&apos;t know who put her there. Write it in close third person, past tense, about 1200 words. Match the tense and voice from the story bible.</Prompt>
              <Prompt>Chapter 3 ends with the confrontation in the archive. Continue from there — the protagonist escapes but leaves something important behind. Pick up mid-action, about 800 words.</Prompt>
            </Sub>

            <Sub title="Editing and revising">
              <Prompt>Read Chapter 2 and rewrite the dialogue scene starting from &quot;She handed him the envelope&quot; — Marcus needs to feel more evasive. He knows more than he&apos;s letting on.</Prompt>
              <Prompt>The pacing in Chapter 4 is too slow in the middle section. Find it, tighten it by cutting about 30%, and keep the emotional beats intact.</Prompt>
            </Sub>

            <Sub title="Working with the database">
              <p className="text-slate-400 text-sm mb-2">Daneel can sync your Story Bible into the character and world databases, so the structured records always match your prose canon.</p>
              <Prompt>I just finished the story bible. Sync all the named characters into the character database and all the named locations and factions into world building.</Prompt>
              <Prompt>We just killed off Marcus in Chapter 6. Update his character record to reflect his death and note how it happened.</Prompt>
            </Sub>

            <Tip>
              Use <strong className="text-emerald-300">@Daneel</strong> for generation and editing.
              Use the pages directly when you want to make a quick fix — renaming a character, updating a world entry description, adjusting a chapter synopsis — without going through a full conversation.
            </Tip>
          </Section>

          <Section id="chapters" title="Chapters">
            <p className="text-slate-300 leading-relaxed mb-4">
              Chapters are the heart of the project — rich-text documents where the actual prose lives.
              The editor auto-saves as you type and tracks a full version history.
            </p>

            <Sub title="The editor">
              <ul className="space-y-2 text-sm text-slate-300 mb-3">
                <li className="flex gap-2"><span className="text-slate-500 shrink-0 mt-0.5">→</span><span><strong className="text-slate-200">Auto-save</strong> — every change is saved automatically, so you never lose work. The status bar shows Saved / Saving / Unsaved.</span></li>
                <li className="flex gap-2"><span className="text-slate-500 shrink-0 mt-0.5">→</span><span><strong className="text-slate-200">Version history</strong> — click the clock icon to see all saved versions. Any collaborator&apos;s save creates a new version. Click any version to restore it.</span></li>
                <li className="flex gap-2"><span className="text-slate-500 shrink-0 mt-0.5">→</span><span><strong className="text-slate-200">Word count</strong> — live word and character count in the status bar.</span></li>
                <li className="flex gap-2"><span className="text-slate-500 shrink-0 mt-0.5">→</span><span><strong className="text-slate-200">Rich formatting</strong> — bold, italic, headings, lists, blockquotes via the toolbar or keyboard shortcuts.</span></li>
              </ul>
            </Sub>

            <Sub title="Inline comments">
              <p className="text-slate-400 text-sm mb-2">
                The right panel in the editor has a <strong className="text-slate-200">Comments</strong> tab.
                Leave notes for co-writers — continuity flags, questions, revision requests — without touching the prose.
                Comments can be marked resolved once addressed.
              </p>
            </Sub>

            <Sub title="Per-chapter AI">
              <p className="text-slate-400 text-sm mb-2">
                Switch the right panel to the <strong className="text-slate-200">AI</strong> tab to chat with Daneel in context of the open chapter.
                This is the best place to ask for targeted rewrites, continuation, or prose feedback on a specific passage —
                Daneel can see exactly what&apos;s in front of you.
              </p>
            </Sub>

            <Sub title="Creating and ordering chapters">
              <p className="text-slate-400 text-sm">
                On the <strong className="text-slate-200">Chapters</strong> page, type a title in the dashed input at the bottom and hit
                <strong className="text-slate-200"> Add Chapter</strong>. Chapters are ordered by creation order.
                Daneel can also create chapters: <em className="text-slate-300">@Daneel create Chapter 5: the market scene.</em>
              </p>
            </Sub>

            <Note>
              Version history is per-chapter and per-save. If two people edit the same chapter simultaneously,
              both their saves create separate versions — you can always diff them manually.
              The last save wins on content.
            </Note>
          </Section>

          <Section id="characters" title="Characters">
            <p className="text-slate-300 leading-relaxed mb-4">
              The character database stores the cast of your project — the structured facts Daneel uses
              when writing prose, resolving continuity, and answering questions about who knows what.
            </p>

            <Sub title="Character roles">
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: 'Protagonist', color: 'bg-emerald-500/20 text-emerald-400', desc: 'POV character or main focus' },
                  { label: 'Antagonist', color: 'bg-red-500/20 text-red-400', desc: 'Primary source of conflict' },
                  { label: 'Supporting', color: 'bg-slate-700/40 text-slate-400', desc: 'Named characters with story functions' },
                  { label: 'Mentor', color: 'bg-amber-500/20 text-amber-400', desc: 'Guides the protagonist' },
                  { label: 'Love Interest', color: 'bg-pink-500/20 text-pink-400', desc: 'Romantic arc' },
                  { label: 'Minor', color: 'bg-slate-700/30 text-slate-500', desc: 'Background, functional, or one-scene' },
                ].map(r => (
                  <div key={r.label} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.color}`}>{r.label}</span>
                    <p className="text-xs text-slate-500 mt-1.5">{r.desc}</p>
                  </div>
                ))}
              </div>
            </Sub>

            <Sub title="What to store">
              <ul className="space-y-1 text-sm text-slate-300 mb-3">
                <li className="flex gap-2"><span className="text-slate-500 shrink-0">→</span><span><strong className="text-slate-200">Description</strong> — one or two sentences Daneel uses as a quick reference when writing scenes.</span></li>
                <li className="flex gap-2"><span className="text-slate-500 shrink-0">→</span><span><strong className="text-slate-200">Notes</strong> — backstory, arc, voice, things Daneel should keep in mind about this character.</span></li>
                <li className="flex gap-2"><span className="text-slate-500 shrink-0">→</span><span><strong className="text-slate-200">Traits</strong> — tag-style attributes (impulsive, sarcastic, afraid of fire). Shown in the agent&apos;s context list.</span></li>
              </ul>
            </Sub>

            <Sub title="Creating characters">
              <Prompt>Create three characters: Sera (Protagonist, mid-30s, ex-military forensic accountant, methodical but impulsive under pressure), Director Voss (Antagonist, ruthless CEO using the company as a front for state-level surveillance), and Jin (Supporting, Sera&apos;s contact at the paper, cautious and morally conflicted).</Prompt>
              <Prompt>Sync all the characters from the Story Bible into the database. Use the descriptions and notes from the document, and assign roles based on context.</Prompt>
            </Sub>

            <Sub title="Managing manually">
              <p className="text-slate-400 text-sm">
                On the <strong className="text-slate-200">Characters</strong> page, click the dashed input at the bottom to add a character by name —
                it opens the character detail page where you can fill in role, description, notes, and traits.
                Click any character card to edit their record.
              </p>
            </Sub>
          </Section>

          <Section id="world" title="World Building">
            <p className="text-slate-300 leading-relaxed mb-4">
              World entries store the facts about the world your story takes place in — the places, factions, concepts, items, and events
              that Daneel needs to reference when writing or answering continuity questions.
            </p>

            <Sub title="Entry types">
              <div className="space-y-2 mb-4">
                {[
                  { label: 'Location', color: 'bg-emerald-500/20 text-emerald-400', desc: 'Named places — cities, buildings, regions, landmarks. Include geography, atmosphere, and what makes it significant to the story.' },
                  { label: 'Faction', color: 'bg-blue-500/20 text-blue-400', desc: 'Groups with collective goals — corporations, governments, cults, guilds. Store their goals, methods, and relationships to other factions.' },
                  { label: 'Concept', color: 'bg-violet-500/20 text-violet-400', desc: 'Abstract world rules — magic systems, technology, cultural practices, historical events. Anything that shapes how the world works.' },
                  { label: 'Item', color: 'bg-amber-500/20 text-amber-400', desc: 'Significant objects — artifacts, MacGuffins, recurring props. Include what they do and why they matter to the story.' },
                  { label: 'Event', color: 'bg-red-500/20 text-red-400', desc: 'Historical or off-page events that shape the present — wars, disasters, discoveries, deaths.' },
                ].map(t => (
                  <div key={t.label} className="flex gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className="w-20 shrink-0 pt-0.5"><span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${t.color}`}>{t.label}</span></div>
                    <div className="text-sm text-slate-400">{t.desc}</div>
                  </div>
                ))}
              </div>
            </Sub>

            <Sub title="Creating world entries">
              <Prompt>Create three world entries: Location — &quot;The Meridian Tower&quot;, headquarters of Voss Corp, a hypermodern skyscraper where the top 10 floors are off-limits to everyone but the executive board. Faction — &quot;The Meridian Collective&quot;, the shadow board that actually controls Voss Corp through shell companies. Concept — &quot;Project Lacuna&quot;, the classified surveillance program at the centre of the story.</Prompt>
              <Prompt>Sync all named locations, factions, and concepts from the Story Bible into world building.</Prompt>
            </Sub>

            <Sub title="Managing manually">
              <p className="text-slate-400 text-sm">
                On the <strong className="text-slate-200">World Building</strong> page, type a name and select a type in the form at the bottom.
                Click any entry card to add a full description and extended notes.
                Entries are grouped by type for easy browsing.
              </p>
            </Sub>

            <Tip>
              The more specific your world entries are, the better Daneel writes.
              Don&apos;t just store a name — add what makes the place or faction <em className="text-emerald-200/70">feel</em> like it does.
              Daneel uses this tone and texture when writing scenes.
            </Tip>
          </Section>

          <Section id="documents" title="Documents">
            <p className="text-slate-300 leading-relaxed mb-4">
              Documents hold the prose <em className="text-slate-200">about</em> your project — the guides, references, and standing instructions
              that shape how Daneel writes and how the team works.
              New projects start with four documents:
            </p>

            <div className="space-y-2 mb-6">
              {[
                {
                  key: 'story_bible',
                  label: 'Story Bible',
                  desc: 'The canonical reference document. Premise, themes, tone, cast, world rules, arc breakdown. The first thing Daneel reads.',
                },
                {
                  key: 'project_instructions',
                  label: 'Project Instructions',
                  desc: 'Standing instructions for the team: workflow rules, what each contributor is responsible for, how to use the agent, house style decisions.',
                },
                {
                  key: 'wake_prompt',
                  label: 'Wake Prompt',
                  desc: 'What Daneel reads on every call. Set the tone, voice, any standing rules for how it should write for this specific project.',
                },
                {
                  key: 'style_guide',
                  label: 'Style Guide',
                  desc: 'Grammar, punctuation, and prose conventions. POV rules, dialogue formatting, anything Daneel should follow consistently across all chapters.',
                },
              ].map(doc => (
                <div key={doc.key} className="flex gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="w-40 shrink-0">
                    <div className="text-sm font-medium text-slate-200">{doc.label}</div>
                    <div className="font-mono text-xs text-slate-600 mt-0.5">{doc.key}</div>
                  </div>
                  <div className="text-sm text-slate-400">{doc.desc}</div>
                </div>
              ))}
            </div>

            <Sub title="Editing documents">
              <Prompt>Write the Story Bible for this project. Pull together everything we&apos;ve discussed — the premise, the tone, the main characters, the world, and the central conflict. Make it comprehensive enough to hand to a new co-writer on day one.</Prompt>
              <Prompt>Update the Wake Prompt to tell Daneel this is a literary thriller. It should write in a spare, restrained style — no purple prose. Short sentences. Tension through what&apos;s not said.</Prompt>
              <Prompt>Add a section to the Style Guide: all dialogue in single quotes, British spelling, no adverbs modifying &quot;said&quot;.</Prompt>
            </Sub>

            <Sub title="Adding custom documents">
              <p className="text-slate-400 text-sm">
                You can create custom documents for anything: a chapter outline, a research dump, a list of open plot questions,
                a deleted scenes archive. Ask Daneel to create any document by name:{' '}
                <em className="text-slate-300">@Daneel create a document called &quot;Chapter Outline&quot; and draft a beat-by-beat outline based on what we&apos;ve built so far.</em>
              </p>
            </Sub>

            <Note>
              The <strong className="text-amber-200">Wake Prompt</strong> and <strong className="text-amber-200">Style Guide</strong> are the two documents
              with the most impact on output quality. A well-written Wake Prompt changes how Daneel sounds
              across every interaction. Fill it in early.
            </Note>
          </Section>

          <Section id="tasks" title="Tasks">
            <p className="text-slate-300 leading-relaxed mb-4">
              Tasks are how the team tracks who is doing what.
              Daneel creates tasks automatically when it needs a human to do something —
              a research question, a revision to review, a decision to make.
              The team can also create tasks manually or ask Daneel to assign them.
            </p>

            <Sub title="Task workflow">
              <div className="flex gap-2 mb-4">
                {[
                  { label: 'To Do', color: 'bg-slate-700/40 text-slate-400' },
                  { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400' },
                  { label: 'Done', color: 'bg-emerald-500/20 text-emerald-400' },
                ].map(s => (
                  <div key={s.label} className={`px-3 py-1.5 rounded-lg text-sm font-medium border border-transparent ${s.color}`}>{s.label}</div>
                ))}
                <span className="text-slate-500 text-sm self-center ml-2">— advance with one click on the Tasks page</span>
              </div>
            </Sub>

            <Sub title="Asking Daneel to assign tasks">
              <Prompt>Read the Story Bible and assign tasks to everyone based on what needs to be written first. Assign chapters 1–3 to me, and the world building research to the rest of the team.</Prompt>
              <Prompt>We just finished the first draft. Create a revision checklist as tasks — assign each chapter review to a different contributor.</Prompt>
            </Sub>

            <Sub title="Managing manually">
              <p className="text-slate-400 text-sm">
                On the <strong className="text-slate-200">Tasks</strong> page, click the status badge on any task to advance it one step.
                Click a task card to open it and reply to Daneel directly from the task — useful for asking questions about what needs to be done without switching to the agent.
              </p>
            </Sub>

            <Tip>
              When you complete a task, reply in the task modal:{' '}
              <em className="text-emerald-200/70">Done — I added three pages to Chapter 2, ending with the confrontation in the archive. @Daneel what should I work on next?</em>{' '}
              Daneel reads the full task context and the project state before answering.
            </Tip>
          </Section>

          <Section id="polls" title="Polls">
            <p className="text-slate-300 leading-relaxed mb-4">
              Polls let the team vote on creative decisions — plot forks, character choices, title options —
              without derailing the chat into a long debate. Anyone can vote, and results are visible to everyone.
            </p>

            <Prompt>Create a poll: should the novel end with the protagonist succeeding but at great personal cost, or failing but with hope for the future? Give each option a short explanation.</Prompt>
            <Prompt>We can&apos;t agree on the title. Create a poll with these four options: &quot;The Lacuna Protocol&quot;, &quot;Meridian&quot;, &quot;What the Vault Holds&quot;, &quot;After Voss&quot;.</Prompt>

            <Sub title="Managing manually">
              <p className="text-slate-400 text-sm">
                On the <strong className="text-slate-200">Polls</strong> page, hit <strong className="text-slate-200">+ Poll</strong> to create one directly —
                write the question and add as many options as you need. Polls stay open until you close them.
                Click an option to vote; click the × to close a poll once a decision is made.
              </p>
            </Sub>

            <Note>
              Daneel only creates polls when you ask it to — it won&apos;t turn every creative question into a vote.
              Use polls intentionally for genuine forks where the team is split or you want a record of the decision.
            </Note>
          </Section>

          <Section id="tips" title="Tips & Best Practices">
            <div className="space-y-4">
              {[
                {
                  title: 'Write the Story Bible first',
                  body: 'Before asking Daneel to write any prose, get the Story Bible in place. It\'s the foundation everything else builds on — characters, world, tone, central conflict. A two-page Story Bible produces dramatically better chapter output than no context at all.',
                },
                {
                  title: 'Set the Wake Prompt early',
                  body: 'The Wake Prompt is the most direct way to shape Daneel\'s voice. If your novel has a specific style — spare and tense, lush and literary, darkly comedic — tell Daneel in the Wake Prompt. It reads this every time.',
                },
                {
                  title: 'Use the Style Guide for consistency',
                  body: 'Establish POV rules, tense, dialogue formatting, and any prose conventions in the Style Guide before the first chapter gets written. This is especially important with multiple co-writers — it keeps Daneel\'s output consistent regardless of who is asking.',
                },
                {
                  title: 'Sync the database after writing sessions',
                  body: 'If you write a lot of new canon in prose — a detailed Story Bible, character backstories in the chapters, new locations described in the text — ask Daneel to sync those facts into the character and world databases. It reads the documents and creates all the structured records at once.',
                },
                {
                  title: 'Give Daneel atmosphere, not just specs',
                  body: 'Don\'t say "write a tense scene." Say "write the scene where Sera discovers the real purpose of Project Lacuna. She\'s alone in Voss\'s office at 3am. Make it feel like the walls are closing in." Daneel makes better creative decisions with tone and stakes than with instructions.',
                },
                {
                  title: 'Use patch_document for targeted edits',
                  body: 'When the Story Bible needs a small update — a character detail changed, a plot point revised — ask Daneel to patch the document rather than rewrite it. This preserves everything else and avoids accidental divergence from established canon.',
                },
                {
                  title: 'Use comments for continuity flags',
                  body: 'When reviewing a chapter, leave inline comments for anything that might conflict with established canon or needs a decision. Resolve them as you go. Comments are a lighter-weight alternative to the agent for chapter-level feedback.',
                },
                {
                  title: 'Pin important messages in the agent',
                  body: 'Right-click any message in the Agent chat to pin it. Pinned messages appear in the banner at the top — great for keeping a key decision, a critical brief, or an important constraint visible across long conversations.',
                },
                {
                  title: 'Use the pages directly for quick fixes',
                  body: 'Daneel is excellent for generating bulk content. But for a single character name change, a world entry description update, or a poll close — the pages are faster and more precise. Every page has full create, edit, and delete without the agent.',
                },
              ].map(tip => (
                <div key={tip.title} className="flex gap-3 p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="text-emerald-500 shrink-0 mt-0.5">→</div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200 mb-1">{tip.title}</div>
                    <div className="text-sm text-slate-400 leading-relaxed">{tip.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </div>
  )
}
