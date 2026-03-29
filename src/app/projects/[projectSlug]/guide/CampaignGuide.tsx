'use client'

import { useEffect, useRef, useState } from 'react'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'structure', label: 'Adventure Structure' },
  { id: 'agent', label: 'Working with Daneel' },
  { id: 'locations', label: 'Locations & Areas' },
  { id: 'encounters', label: 'Encounters' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'quests', label: 'Quests' },
  { id: 'tables', label: 'Random Tables' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'documents', label: 'Documents' },
  { id: 'tips', label: 'Tips & Best Practices' },
]

function Prompt({ children }: { children: string }) {
  return (
    <div className="my-3 flex gap-2 items-start">
      <span className="shrink-0 text-indigo-500 font-mono text-sm mt-0.5">@Daneel</span>
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
    <div className="my-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-200/80 leading-relaxed">
      {children}
    </div>
  )
}

export default function CampaignGuide({ projectName }: { projectName: string }) {
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
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaign Guide</div>
          <div className="text-xs text-slate-600 mt-0.5 truncate">{projectName}</div>
        </div>
        <nav className="space-y-0.5">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full text-left px-4 py-1.5 text-sm transition-colors rounded-sm ${
                activeSection === s.id
                  ? 'text-indigo-400 bg-indigo-500/10'
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
              The DAN campaign builder is a collaborative workspace for designing published-quality 5e adventure modules.
              You can build entirely in the <strong className="text-slate-200">Agent</strong> chat using natural language,
              or work directly on any page — every section has full create, edit, and delete controls.
              Daneel and the manual pages stay in sync: anything created in chat appears instantly on the relevant page, and vice versa.
            </p>
            <p className="text-slate-300 leading-relaxed mb-4">
              Think of it like writing <em className="text-slate-200">Lost Mine of Phandelver</em> or <em className="text-slate-200">Curse of Strahd</em> —
              you have the creative vision, Daneel formats and organizes it into a structured module.
            </p>

            <Sub title="The two-layer model">
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex gap-2"><span className="text-slate-500 shrink-0 mt-0.5">→</span><span><strong className="text-slate-200">Documents</strong> hold your prose — the campaign overview, setting guide, session zero, NPC descriptions, and anything you write as a GM resource.</span></li>
                <li className="flex gap-2"><span className="text-slate-500 shrink-0 mt-0.5">→</span><span><strong className="text-slate-200">Structured data</strong> (locations, encounters, NPCs, quests, etc.) is stored as database records that Daneel can reference, update, and reason about.</span></li>
              </ul>
            </Sub>
          </Section>

          <Section id="structure" title="Adventure Structure">
            <p className="text-slate-300 leading-relaxed mb-4">
              Campaign content follows the same layered structure as published WotC adventures:
            </p>

            <div className="space-y-2 mb-6">
              {[
                { label: 'Adventure Parts', desc: 'The top-level spine. Each Part is a major chapter of the campaign (Part 1: The Missing Miners, Part 2: The Dungeon of Doom). Shown in the Agent sidebar.' },
                { label: 'Locations', desc: 'Named places in the world — dungeons, towns, ruins, wilderness regions. Each location can contain keyed areas.' },
                { label: 'Keyed Areas', desc: 'Numbered rooms and zones inside a location (1. Entry Hall, 2. Guard Room, B1. Throne Room). The classic dungeon key format.' },
                { label: 'Encounters', desc: 'Combat, social, exploration, trap, or hazard events. Can be attached to a location or keyed area.' },
                { label: 'NPCs', desc: 'Named characters the players can interact with. Stored with known info, secrets, voice notes, and a stat block reference.' },
                { label: 'Quests', desc: 'Main, side, faction, or personal quests with status tracking.' },
                { label: 'Random Tables', desc: 'd6/d8/d12/d20/d100 tables for encounters, rumors, names, weather, trinkets, and custom content.' },
                { label: 'Timeline', desc: "The villain's advancing plan — events that happen in the world on a day-by-day basis whether or not the players intervene." },
              ].map(item => (
                <div key={item.label} className="flex gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="w-32 shrink-0 text-sm font-medium text-slate-200">{item.label}</div>
                  <div className="text-sm text-slate-400">{item.desc}</div>
                </div>
              ))}
            </div>

            <Note>
              You don&apos;t need to fill every layer. A town-crawl might have NPCs and quests but no keyed areas.
              A dungeon delve might have 20 keyed areas with no quests. Build what the adventure needs.
            </Note>
          </Section>

          <Section id="agent" title="Working with Daneel">
            <p className="text-slate-300 leading-relaxed mb-4">
              Daneel responds whenever you type <strong className="text-slate-200">@Daneel</strong> in the Agent chat.
              It reads your entire campaign context — all documents, parts, locations, NPCs, quests, and timeline —
              before every response. You never need to re-explain what you&apos;ve already built.
            </p>

            <Sub title="Getting started">
              <Prompt>I want to build a low-level dungeon crawl set in an abandoned dwarven mine. The party starts in the town of Millhaven and follows a missing merchant. Level 1–4, 4 players. Create the first adventure part and write a campaign overview document.</Prompt>
              <Prompt>We&apos;re building a political intrigue campaign in a city-state. The main villain is a corrupt magistrate secretly working for a thieves&apos; guild. Set up the spine — create 3 adventure parts and the key factions.</Prompt>
            </Sub>

            <Sub title="Adding content in bulk">
              <p className="text-slate-400 text-sm mb-2">Daneel works best when you give it a creative brief and let it build the whole structure at once.</p>
              <Prompt>Create the dungeon location &quot;The Sunken Forge&quot; — a 3-floor dwarven ruin. Add 8 keyed areas on the first floor: entry hall, two guard posts, a trapped corridor, a collapsed chamber, a mushroom garden, a forge room, and a boss chamber. Include read-aloud text and DM notes for each.</Prompt>
              <Prompt>The town of Millhaven needs 4 NPCs: a nervous innkeeper, a retired adventurer, the corrupt town guard captain, and a halfling fence. Add them all with known info, secrets, and voice notes.</Prompt>
              <Prompt>Create 5 side quests for Part 1. Mix types: 2 side quests, 1 faction quest, 1 personal quest. Make them all connect to the missing merchant hook.</Prompt>
            </Sub>

            <Sub title="Asking Daneel questions">
              <p className="text-slate-400 text-sm mb-2">Daneel can also just answer questions without creating anything.</p>
              <Prompt>What CR range should I target for a deadly encounter for 4 level-2 characters?</Prompt>
              <Prompt>What&apos;s a good way to structure the reveal of the main villain halfway through the campaign?</Prompt>
              <Prompt>I want a moral dilemma for the party in Part 2. Give me 3 options based on what we have so far.</Prompt>
            </Sub>

            <Tip>
              Use <strong className="text-indigo-300">Polls</strong> to put creative decisions to a vote.{' '}
              <em className="text-indigo-200/70">@Daneel create a poll: should the main villain be redeemable or irredeemably evil?</em>
            </Tip>
          </Section>

          <Section id="locations" title="Locations & Areas">
            <p className="text-slate-300 leading-relaxed mb-4">
              Locations are the physical places in your world. Each location can have keyed areas — the numbered zones
              that make up a dungeon key or building layout.
            </p>

            <Sub title="Creating locations">
              <Prompt>Create a location: &quot;The Ashwood&quot; — a cursed forest, wilderness type. It should feel oppressive and wrong, like the trees are watching.</Prompt>
              <Prompt>Add a nested location inside The Ashwood: &quot;The Witch&apos;s Hollow&quot; — a building. This is where the hag lives.</Prompt>
            </Sub>

            <Sub title="Keyed areas">
              <p className="text-slate-400 text-sm mb-2">
                Use keys like <span className="font-mono text-slate-300 text-xs bg-slate-800 px-1 py-0.5 rounded">1</span>,{' '}
                <span className="font-mono text-slate-300 text-xs bg-slate-800 px-1 py-0.5 rounded">B2</span>,{' '}
                <span className="font-mono text-slate-300 text-xs bg-slate-800 px-1 py-0.5 rounded">A</span> for rooms and zones.
                Connections link areas together so you can navigate the dungeon map.
              </p>
              <Prompt>Add keyed area 1 to The Sunken Forge: &quot;Entry Hall&quot;. Read-aloud: the smell of old smoke and rust. Connects to areas 2 and 3. DM note: the doors are stuck (DC 12 Strength).</Prompt>
            </Sub>

            <Sub title="Managing manually">
              <p className="text-slate-400 text-sm">
                Go to <strong className="text-slate-200">Locations</strong> in the sidebar to browse, create, and edit locations directly.
                Hit <strong className="text-slate-200">+ New</strong> in the header to create a location — choose a type, set an optional parent location for nesting,
                and add atmosphere notes. Once a location is selected, use <strong className="text-slate-200">+ Area</strong> to add keyed areas with read-aloud text, DM notes, and connections.
                Click any area card to expand full details.
              </p>
            </Sub>
          </Section>

          <Section id="encounters" title="Encounters">
            <p className="text-slate-300 leading-relaxed mb-4">
              Encounters are any structured event — not just combat. Use them for meaningful social interactions,
              exploration challenges, traps, and environmental hazards too.
            </p>

            <Sub title="Creating encounters">
              <Prompt>Create a hard combat encounter for Part 1: &quot;Goblin Ambush on the East Road&quot;. 6 goblins and a hobgoblin boss. Include tactics — the goblins scatter and hide if the hobgoblin drops.</Prompt>
              <Prompt>Add a social encounter: &quot;Interrogating Captain Vane&quot;. Medium difficulty. The players have evidence of his corruption. He&apos;ll deny everything unless they can make him feel cornered. Include the breakdown conditions in tactics.</Prompt>
              <Prompt>Create a trap encounter in keyed area 4: a pressure-plate spear trap. Detection DC 14 Perception, Disarm DC 12 Thieves&apos; Tools. 2d6 piercing on fail, DC 13 Dex save for half.</Prompt>
            </Sub>

            <Sub title="Adding creatures">
              <p className="text-slate-400 text-sm mb-2">
                Daneel can search the full SRD library (334 monsters) and attach them to any encounter.
              </p>
              <Prompt>Search for an undead creature around CR 3 that would work as a dungeon boss. Add 2 of them to the Crypt Boss encounter.</Prompt>
              <Prompt>The goblin ambush should have 6 Goblins and 1 Hobgoblin. Find them in the SRD and add them.</Prompt>
            </Sub>

            <Sub title="Managing manually">
              <p className="text-slate-400 text-sm">
                On the <strong className="text-slate-200">Encounters</strong> page, hit <strong className="text-slate-200">+ New</strong> to create an encounter — set the type, difficulty, summary, read-aloud, tactics, and reward.
                Once an encounter is open, use <strong className="text-slate-200">+ Creature</strong> to search the SRD or campaign creature library, filter by max CR, set quantity, and add notes.
                Hover over any creature row and click × to remove it. XP is calculated live.
              </p>
            </Sub>

            <Note>
              XP is automatically totalled on the Encounters page based on creature CR.
              Multiply by the standard multimonster modifier (×1.5 for 3–6 creatures, ×2 for 7–10) to get the adjusted XP budget.
            </Note>
          </Section>

          <Section id="npcs" title="NPCs">
            <p className="text-slate-300 leading-relaxed mb-4">
              NPCs in campaign mode have extra fields beyond a normal novel character: known info (what they&apos;ll freely share),
              secrets (what the party can discover), voice notes (how to play them at the table), and a stat block reference.
            </p>

            <Sub title="Creating NPCs">
              <Prompt>Create an NPC: Aldric Vane, corrupt town guard captain. He&apos;s taking bribes from the Red Hand thieves&apos; guild to look the other way on their operations. Known info: cheerful and helpful on the surface. Secrets: he has a ledger of payments hidden under a loose board in his office. Voice: gruff, defensive when questioned, overly jovial when nervous.</Prompt>
            </Sub>

            <Sub title="Stat block references">
              <p className="text-slate-400 text-sm">
                Use the <span className="font-mono text-slate-300 text-xs bg-slate-800 px-1 py-0.5 rounded">statBlockRef</span> field
                to point to an SRD stat block (<em className="text-slate-300">SRD: Bandit Captain</em>) or a custom homebrew creature.
                Daneel stores this as a text reference — the full stat block lives in the Encounters page.
              </p>
            </Sub>

            <Sub title="Syncing from documents">
              <Prompt>I just wrote a full NPC roster in the Campaign Overview document. Sync all the named characters into the NPC database.</Prompt>
            </Sub>
          </Section>

          <Section id="quests" title="Quests">
            <p className="text-slate-300 leading-relaxed mb-4">
              Quests track what the players are being asked to do (or secretly need to do).
              Use status to track where each quest stands during a session.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: 'active', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', desc: 'Players know about it and are working on it' },
                { label: 'unknown-to-party', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', desc: 'Exists in the world, party hasn\'t found it yet' },
                { label: 'resolved', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', desc: 'Completed' },
                { label: 'abandoned', color: 'bg-red-500/20 text-red-400 border-red-500/30', desc: 'Failed or given up' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${s.color}`}>{s.label}</span>
                  <p className="text-xs text-slate-500 mt-1.5">{s.desc}</p>
                </div>
              ))}
            </div>

            <Prompt>Create 3 quests for Part 1: main quest &quot;Find the Missing Merchant&quot;, side quest &quot;Clear the Rats from Millhaven&apos;s Granary&quot; (reward: 50gp and a room for a week), and a faction quest for the Merchant&apos;s Guild.</Prompt>
            <Prompt>The party just resolved &quot;Find the Missing Merchant.&quot; Mark it as resolved and create the follow-up main quest that leads into Part 2.</Prompt>

            <Sub title="Managing manually">
              <p className="text-slate-400 text-sm">
                On the <strong className="text-slate-200">Quests</strong> page, hit <strong className="text-slate-200">+ New</strong> to open the quest form — set the name, type, status, description, and reward.
                The detail panel has an <strong className="text-slate-200">→ Advance</strong> button to cycle the status in one click (Hidden → Active → Resolved → Abandoned).
              </p>
            </Sub>

            <Tip>
              Create quests as <strong className="text-indigo-300">unknown-to-party</strong> during prep.
              Advance them to <strong className="text-indigo-300">active</strong> when the players discover them at the table —
              use the advance button on the Quests page or ask Daneel to update the status in chat.
            </Tip>
          </Section>

          <Section id="tables" title="Random Tables">
            <p className="text-slate-300 leading-relaxed mb-4">
              Random tables add improvisation support — roll for a wandering encounter, a rumor, an NPC name, or the weather.
            </p>

            <Sub title="Creating tables">
              <Prompt>Create a d12 wilderness encounter table for the Ashwood forest. 12 entries ranging from benign (a deer with glowing eyes, a circle of mushrooms) to dangerous (a black bear, a shambling mound, a hag patrol) to mysterious (a crying child that vanishes when approached).</Prompt>
              <Prompt>Make a d6 rumor table for the Millhaven Inn. Mix true, false, and partially true rumors about the missing merchant and the dungeon.</Prompt>
            </Sub>

            <Sub title="Managing manually">
              <p className="text-slate-400 text-sm mb-2">
                On the <strong className="text-slate-200">Tables</strong> page, hit <strong className="text-slate-200">+ New</strong> to open the table form.
                Pick a die size (d6, d8, d10, d12, d20, d100) and use <strong className="text-slate-200">Fill N rows</strong> to auto-populate all die slots at once,
                then fill in each entry. You can also add rows individually or remove any row with the × button.
              </p>
            </Sub>

            <Sub title="Rolling">
              <p className="text-slate-400 text-sm">
                Open the <strong className="text-slate-200">Tables</strong> page, select a table, and hit the Roll button.
                The result is highlighted in the table so you can see adjacent entries for context.
                Daneel can also roll for you in chat:{' '}
                <em className="text-slate-300">@Daneel roll on the Ashwood Encounter Table.</em>
              </p>
            </Sub>
          </Section>

          <Section id="timeline" title="Timeline">
            <p className="text-slate-300 leading-relaxed mb-4">
              The timeline is the <strong className="text-slate-200">villain&apos;s advancing plan</strong> — a sequence of events that
              happen in the world on a day-by-day basis, independent of what the players do. This is what makes a campaign feel reactive
              and alive rather than static.
            </p>

            <Prompt>Add a timeline for the main villain. Day 0: the merchant goes missing (inciting incident). Day 3: the Red Hand moves stolen goods through the mine. Day 7: the hobgoblin boss reinforces the mine entrance. Day 14: if the mine isn&apos;t cleared, the Red Hand bribes the magistrate to ignore complaints. Day 21: the guild establishes a permanent operation.</Prompt>

            <Sub title="Conditional events">
              <p className="text-slate-400 text-sm mb-2">
                Use the trigger condition field for events that only happen if the players did (or didn&apos;t) act.
              </p>
              <Prompt>Add a timeline event on Day 10: &quot;The Merchant&apos;s Family Leaves Town&quot;. Trigger condition: only if the players haven&apos;t found evidence of the Red Hand yet. Consequence: the main quest loses its emotional anchor and the reward drops to 100gp.</Prompt>
            </Sub>

            <Sub title="Managing manually">
              <p className="text-slate-400 text-sm">
                On the <strong className="text-slate-200">Timeline</strong> page, hit <strong className="text-slate-200">+ New event</strong> to add an event directly.
                Set the in-world day number, what happens, an optional trigger condition, and an optional consequence.
                Events are always sorted by day — gaps larger than 3 days are shown as spacers so the pacing is easy to read.
              </p>
            </Sub>

            <Note>
              Days are relative to the start of the campaign. Day 0 is the inciting incident.
              You don&apos;t need a perfectly grained timeline — broad strokes work fine.
              3–8 key events is usually enough for a Part.
            </Note>
          </Section>

          <Section id="documents" title="Documents">
            <p className="text-slate-300 leading-relaxed mb-4">
              Documents hold the prose layer of your campaign — everything a GM reads rather than queries.
              New campaigns start with six documents:
            </p>

            <div className="space-y-2 mb-6">
              {[
                { key: 'campaign_overview', label: 'Campaign Overview', desc: 'High-level summary: premise, themes, tone, cast of factions. The first thing you\'d read in a published adventure.' },
                { key: 'running_this_campaign', label: 'Running This Campaign', desc: 'GM guidance: pacing notes, encounter philosophy, how to handle the main villain, what to do if the party goes off-script.' },
                { key: 'setting_guide', label: 'Setting Guide', desc: 'The world. Geography, history, factions, culture, any lore that\'s relevant to this adventure.' },
                { key: 'session_zero', label: 'Session Zero', desc: 'Topics to cover with your players before the campaign starts: safety tools, tone, character creation restrictions, campaign hooks.' },
                { key: 'house_rules', label: 'House Rules', desc: 'Any rule modifications or additions specific to this campaign.' },
                { key: 'wake_prompt', label: 'Wake Prompt', desc: 'What Daneel reads on every startup. Use this to give it standing instructions — tone, your shorthand, things it should always keep in mind.' },
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
              <Prompt>Write the Campaign Overview for this campaign. Use what we&apos;ve built so far — the premise, the villain, the factions, and the tone.</Prompt>
              <Prompt>Update the Running This Campaign document with a section on how to handle it if the party tries to ally with the Red Hand instead of fighting them.</Prompt>
            </Sub>

            <Tip>
              The <strong className="text-indigo-300">Wake Prompt</strong> is powerful.
              Use it to set Daneel&apos;s standing tone: <em className="text-indigo-200/70">&quot;This is a dark campaign — NPCs can die, consequences are real. Never soften the stakes. When in doubt, make it worse.&quot;</em>
            </Tip>
          </Section>

          <Section id="tips" title="Tips & Best Practices">
            <div className="space-y-4">
              {[
                {
                  title: 'Start with the spine, then fill in',
                  body: 'Create all your adventure parts first, then build locations and encounters. This gives Daneel structural context for everything it creates afterward.',
                },
                {
                  title: 'Give Daneel a creative brief, not a spec',
                  body: 'Don\'t say "create a location with 10 areas." Say "build a crashed airship dungeon where the crew went feral after a demonic possession. I want it to feel like Aliens meets D&D." Daneel will make better content with atmosphere and intent.',
                },
                {
                  title: 'Use the Wake Prompt to set tone',
                  body: 'If your campaign has a specific voice — grimdark, comedic, mythic — tell Daneel in the Wake Prompt. It carries that tone into every piece of content it writes.',
                },
                {
                  title: 'Build NPCs before encounters',
                  body: 'When Daneel creates encounters involving specific characters, it writes better tactics and read-aloud text if those NPCs already exist in the database.',
                },
                {
                  title: 'Use polls for major plot decisions',
                  body: 'When co-authoring with others, any meaningful fork — is the villain redeemable? does the merchant survive? — is worth a poll. @Daneel create a poll is a natural way to pause and build consensus.',
                },
                {
                  title: 'The timeline keeps the world honest',
                  body: 'Build the villain\'s timeline early. When you know what happens if the players do nothing, it\'s much easier to calibrate how much pressure to apply and when.',
                },
                {
                  title: 'Sync after big writing sessions',
                  body: 'If you write a lot of prose in a document (like a full NPC roster or location list), ask Daneel to sync the relevant records into the database. It reads the document and creates all the structured entries at once.',
                },
                {
                  title: 'Don\'t over-key your dungeons',
                  body: 'Published adventures typically have 8–15 keyed areas per dungeon floor. More than that gets overwhelming to run. When in doubt, merge two adjacent rooms into one interesting room.',
                },
                {
                  title: 'Use the pages directly when you know exactly what you want',
                  body: 'Daneel is great for generating bulk content from a brief. But if you just need to add one timeline event, tweak a quest reward, or swap a creature out of an encounter — the pages are faster. Every page has full create, edit, and delete without needing the agent.',
                },
              ].map(tip => (
                <div key={tip.title} className="flex gap-3 p-4 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="text-indigo-500 shrink-0 mt-0.5">→</div>
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
