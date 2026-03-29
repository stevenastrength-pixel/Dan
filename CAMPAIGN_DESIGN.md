# Campaign Mode — Design Document

## Core Concept
A second project type alongside Novels, purpose-built for building a complete,
published-quality 5e tabletop campaign book. Think "Curse of Strahd" or
"Lost Mine of Phandelver" — everything a purchased campaign book contains,
built collaboratively with Daneel as GM co-author.

Never says "D&D" — uses GM, Campaign, Session, Encounter, Creature, Player Character.

Primary target: campaign book authoring (everything in a published module).
Future phases: session prep tools, live play / table support. Doors left open, not built now.

DAN's edge over Roll20/Foundry: Daneel knows YOUR specific campaign.
Collaborative multi-author, chat-centric, AI co-author throughout.

---

## What a Published Campaign Book Actually Contains
(stress-tested against Lost Mine of Phandelver, Curse of Strahd, Tomb of Annihilation)

1. **Campaign Overview** — premise, themes, tone, level range, adventure background/history
2. **Running the Adventure** — GM guidance, adjusting difficulty, adventure hooks / ways in
3. **Adventure Parts / Chapters** — ordered sections of the story, each covering:
   - Introduction and overview of this part
   - Key NPCs featured here
   - Locations in this part (with keyed areas)
   - Encounters (keyed to locations or standalone)
   - Quests / plot hooks activated here
   - Conclusion / transition to next part
4. **Locations** — named areas with atmosphere, keyed areas, each area with read-aloud + DM notes
5. **NPC Roster** — personality (traits/ideals/bonds/flaws), roleplaying notes, what they know, secrets, stat block or reference
6. **Faction Guide** — who they are, goals, methods, relationships to other factions
7. **Encounter Appendix** — custom creature stat blocks, modified SRD creatures
8. **Magic Items Appendix** — unique items introduced in this adventure
9. **Random Tables** — encounter tables by region, names, rumors, weather, trinkets
10. **Timeline** — "if the party does nothing" — villain's plan advances on a schedule
11. **Handouts** — player-facing props (letters, maps, coded messages, wanted posters)
12. **Traps** — trigger, detection DC, disarm DC, effect, reset

---

## Complete Model Set

### Project (extended for campaigns)
```
type              String  @default("novel")   // 'novel' | 'campaign'
levelingMode      String?                      // 'xp' | 'milestone' — campaign only
partySize         Int?                         // default 4
minLevel          Int?
maxLevel          Int?
```
Existing fields (name, slug, description, documents, characters, worldEntries, etc.) all carry over.

---

### Session (new — NOT reusing Chapter)
Adventure parts/chapters of the written book. "Part 1: Goblin Arrows", "Chapter 3: Barovia."
```
id, projectId, title, summary, outline
intendedLevel     Int?       // what level party should be entering this part
order             Int
```
Junction relations (Phase 2+):
- Session ↔ Location (many-to-many)
- Session ↔ Encounter (many-to-many)
- Session ↔ Quest (many-to-many)

---

### Location (new dedicated model — NOT reusing WorldEntry)
WorldEntry works for factions/deities. Locations need more structure.
```
id, projectId
name, locationType   // dungeon / town / region / wilderness / building / plane
description          // GM overview
atmosphere           // mood, sensory details, weather norms
parentLocationId     // FK to self — region contains dungeon contains level
```
Relations: Location hasMany KeyedArea, Location hasMany Encounter

---

### KeyedArea (new)
The numbered/lettered rooms and areas within a location.
```
id, locationId
key              // "1", "2a", "B3", etc. — the label in the book
title            // "Entry Chamber", "Guard Room"
readAloud        // boxed text — what GM reads to players
dmNotes          // secret info, creature tactics, hidden details
connections      // JSON: [{to: "2", direction: "north", note: "locked door DC 15"}]
order            Int
```
Relations: KeyedArea hasOne Encounter (optional)

---

### Encounter (new)
Combat, social, exploration, and trap encounters.
```
id, projectId
name
encounterType    // 'combat' | 'social' | 'exploration' | 'trap' | 'hazard'
difficulty       // 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly'
readAloud        // opening boxed text
summary          // GM overview of the encounter
tactics          // how creatures/NPCs behave — retreat when wounded? negotiate?
dmNotes          // secret info, contingencies, what happens after
locationId       Int?   // FK to Location (optional — can be standalone)
keyedAreaId      Int?   // FK to KeyedArea (optional)
rewardText       // freetext loot description for authoring
status           // 'planned' | 'completed' (live play phase)
```
Relations: Encounter hasMany EncounterCreature

Trap-specific fields (when encounterType = 'trap'):
```
trapTrigger      // what activates it
detectionDC      // Perception or Investigation check DC
disarmDC         // Thieves' Tools or other DC
trapEffect       // damage, condition, etc.
trapReset        // how/whether it resets
```

---

### EncounterCreature (junction — critical for encounter math)
Links an Encounter to the creatures in it.
```
id, encounterId
quantity         Int
srdCreatureId    Int?   // FK to SrdCreature (for standard monsters)
campaignCreatureId Int? // FK to CampaignCreature (for custom monsters)
notes            // "uses hit points variant", "has been wounded already"
```
This powers: XP calculation, encounter difficulty rating, appendix listing.

---

### CampaignCreature (custom stat blocks)
Full stat blocks for custom/modified monsters unique to this campaign.
SRD monsters are NOT duplicated here — referenced via srdCreatureId.
```
id, projectId
name, size, creatureType, alignment, CR, xpValue
isHomebrew       Boolean @default(true)
AC, acType, HPDice, HPAverage
speed            // JSON: {walk, fly, swim, climb, burrow}
STR, DEX, CON, INT, WIS, CHA
savingThrows     // JSON: ["STR +4", "CON +6"]
skills           // JSON: ["Perception +5", "Stealth +7"]
damageResistances, damageImmunities, damageVulnerabilities  // JSON arrays
conditionImmunities  // JSON array
senses           // "darkvision 60 ft., passive Perception 15"
languages
legendaryResistances Int @default(0)
isLegendary      Boolean @default(false)
hasLairActions   Boolean @default(false)
traits           // JSON: [{name, description}]
actions          // JSON: [{name, description, attackBonus, damage, damageType}]
bonusActions     // JSON: [{name, description}]
reactions        // JSON: [{name, description}]
legendaryActions // JSON: [{name, description, cost}]
lairActions      // JSON: [{description}]
```

---

### Quest
```
id, projectId
name, description
status           // 'active' | 'resolved' | 'abandoned' | 'unknown-to-party'
questType        // 'main' | 'side' | 'faction' | 'personal'
giverCharacterId Int?   // FK to Character (NPC who gives it)
locationId       Int?   // FK to Location (where it leads)
rewardText       // freetext reward description
parentQuestId    Int?   // FK to self — sub-quests / quest chains
```

---

### RandomTable (new)
```
id, projectId
name
tableCategory    // 'encounter' | 'npc-names' | 'rumors' | 'weather' | 'trinkets' | 'custom'
dieSize          // 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'
description      // when/how to use this table
entries          // JSON: [{minRoll, maxRoll, result}] — supports ranges (1-3, 4-6 etc.)
```
Daneel tool: `roll_on_table(name)` → picks weighted random, returns result with narrative context.

---

### TimelineEvent (new)
```
id, projectId
name
inWorldDay       Int    // days from campaign start (day 0 = adventure begins)
description      // what happens
triggerCondition // what causes it: "if party hasn't stopped X by this day"
consequence      // what changes in the world if it fires
```
Daneel uses this to inject urgency: "the ritual completes in 18 days — the party is on day 12."

---

### CampaignMagicItem (new)
Unique magic items introduced in this campaign. SRD items referenced by name only.
```
id, projectId
name
rarity           // 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact'
itemType         // 'weapon' | 'armor' | 'wondrous' | 'ring' | 'staff' | 'wand' | 'rod' | 'potion' | 'scroll'
requiresAttunement Boolean @default(false)
attunementNotes  // "requires attunement by a cleric or paladin"
chargesMax       Int?
rechargeCondition // "regains 1d6+1 charges at dawn"
description      // full item description
properties       // mechanical properties, what it does
lore             // in-world history / flavor
```

---

### Character (extended for campaign NPCs)
Reusing the existing Character model, adding campaign-specific fields:
```
// NEW fields for campaign mode:
knownInfo        String @default("")   // what this NPC will share if asked
secrets          String @default("")   // what they're hiding
voiceNotes       String @default("")   // accent, speech patterns, mannerisms for GM
statBlockRef     String @default("")   // "Bandit Captain (SRD)" or campaignCreatureId
factionId        Int?                  // FK to WorldEntry (type=Faction)
currentLocationId Int?                 // FK to Location — where are they now
```

---

### WorldEntry (extended for Factions)
Factions need relationship data. Add to existing WorldEntry:
```
// NEW fields (nullable, only used for Factions):
factionGoals     String @default("")
factionMethods   String @default("")
factionRelations String @default("[]")  // JSON: [{factionName, relationship: 'ally'|'rival'|'enemy'|'neutral', notes}]
```

---

### ProjectDocument (extended)
```
// NEW field:
isHandout        Boolean @default(false)  // player-facing prop
```

---

## SRD Reference Tables (read-only, seeded at startup)

### SrdCreature
Full stat blocks for all ~400 SRD monsters.
Source: 5e-database (CC-BY 4.0). Seeded once, never modified by users.
```
id, name, size, creatureType, alignment, CR, xpValue
AC, acType, HPDice, HPAverage
speed, STR, DEX, CON, INT, WIS, CHA
savingThrows, skills, damageResistances, damageImmunities
damageVulnerabilities, conditionImmunities, senses, languages
traits, actions, bonusActions, reactions, legendaryActions
isLegendary, legendaryResistances, hasLairActions
```

### SrdSpell
All SRD spells (~300).
```
id, name, level, school
castingTime, range, components, duration
concentration, ritual
description, higherLevels
classes  // JSON array of class names
```

### SrdMagicItem
SRD magic items.
```
id, name, rarity, itemType, requiresAttunement
description
```

---

## Campaign Document Templates
Auto-created when a new campaign project is made:
- **Campaign Overview** — premise, background history, themes, tone, intended level range, adventure synopsis
- **Running This Campaign** — GM guidance notes, adjusting difficulty, content warnings
- **Setting Guide** — world overview, geography, cosmology, calendar, factions summary
- **Session Zero / Safety Notes** — lines, veils, table norms, X-card usage, content flags
- **House Rules** — any rules modifications for this campaign
- **Wake Prompt** — Daneel's campaign-specific personality and GM assistant instructions

---

## Campaign Creation Flow
1. Campaign name
2. Premise (one-liner — seeds Campaign Overview doc)
3. Level range (1–5 / 1–10 / 1–16 / 1–20 / custom)
4. Party size (default 4)
5. Tone (multi-select: dark, heroic, comedic, mystery, horror, sandbox, political, intrigue)
6. Setting (custom name — seeds the Setting Guide doc)

---

## Navigation

### Top-Level Nav
```
◫  Novels      → /novels
⚔  Campaigns   → /campaigns
⬡  Chat        → /agent
⚙  Settings   → /settings
```

### Campaign Sidebar (when inside a campaign project)
```
← Campaigns
────────────
⬡  Agent
⚔  Encounters
📜  Quests
🎲  Tables          ← random tables
◎  Polls
✓  Tasks
────────────
⚙  Settings
```
Sessions, Locations, NPCs, Timeline live inside the Agent side panel.
Encounters, Quests, and Tables get top-level tabs (browsed across the full campaign).

---

## Daneel in Campaign Mode

### System Prompt Includes (every call)
- Campaign name, premise, tone, level range, party size
- Session spine (all session titles + intended levels) — for pacing awareness
- Active quests list
- Timeline events (upcoming, within next 10 in-world days)
- NPC roster summary (name, role, location)
- Faction list with goals and key relationships

### Daneel's Tool Set (campaign book authoring)

**Sessions:**
- `create_session`, `update_session`, `get_session`

**Locations:**
- `create_location`, `update_location`
- `create_keyed_area`, `update_keyed_area`

**Encounters:**
- `create_encounter`, `update_encounter`, `get_encounter`
- `add_creature_to_encounter` — links SRD or custom creature with quantity

**Creatures:**
- `create_campaign_creature`, `update_campaign_creature`
- `search_creature(name?, crMin?, crMax?, type?, legendary?)` — SRD library query
- `get_creature(id)` — full stat block

**Quests:**
- `create_quest`, `update_quest`, `advance_quest`

**Tables:**
- `create_random_table`
- `roll_on_table(name)` — returns weighted random result with narrative

**Timeline:**
- `create_timeline_event`, `update_timeline_event`

**Magic Items:**
- `create_campaign_magic_item`
- `search_magic_item(name?, rarity?)` — SRD item lookup

**NPCs:**
- `create_npc` (wraps create_character with campaign fields)
- `update_npc`

**Spells:**
- `search_spell(name?, level?, school?, class?)` — SRD spell lookup

**Existing tools carried over unchanged:**
- `create_poll`, `assign_task`
- `patch_document`, `update_document`, `get_document`

---

## Phasing

### Phase 1 — Foundation
Nav split, type field on Project, /novels and /campaigns list pages,
campaign creation flow, SRD seed script (data in DB from day 1).

### Phase 2 — Campaign Book Core
Session, Location, KeyedArea, Encounter, EncounterCreature, Quest, Character extensions,
WorldEntry faction extensions, Daneel campaign system prompt, all campaign tools above.
RandomTable, TimelineEvent, CampaignMagicItem.
Session ↔ Location/Encounter/Quest junction tables.

### Phase 3 — Encounter Builder UI
Dedicated Encounters tab with difficulty calculator, creature picker from SRD library,
XP math display, CR range suggestions from Daneel.
CampaignCreature full stat block editor.

### Phase 4 — Full Campaign Book View
Assembled book view: all parts/sessions with their locations, encounters, quests.
Handouts section. Appendix (custom creatures + magic items).
Tables browser. Timeline view.

### Phase 5 — Session Prep Tools
PC sheets (party template → real characters), party state, encounter balancing vs actual PCs.
Pre-session checklist generation by Daneel.

### Phase 6 — Live Play
Initiative tracker, HP/condition management, rest processing, real-time sync.

---

## What Needs Resolving Before Coding Phase 2

1. **Location as dedicated model vs extended WorldEntry** — settled above as dedicated model.
   Does this mean migrating existing worldEntries for campaigns, or starting fresh?
   Recommendation: WorldEntry stays for Factions/Deities/Concepts. Location is new.

2. **Session ↔ Location/Encounter/Quest links** — Phase 1 or Phase 2?
   Recommendation: Phase 2 (Phase 1 is just the nav split and type field).

3. **Per-session intended level** — on Session model (above). Settled.

4. **Read-aloud on Encounters** — yes, included above.
