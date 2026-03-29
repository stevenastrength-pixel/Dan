# Campaign Play Modes — Design Document

Two distinct modes for running a campaign in DAN. Both build on the same
foundation: full D&D 5e character sheets and a party roster tied to DAN users.

---

## Foundation: Character Sheets & Party

### PlayerCharacter (model)
A full D&D 5e character sheet, owned by a DAN user, scoped to a campaign project.
A user can have one character per campaign (or potentially multiple, e.g. backup chars).

Key principle: the sheet is canonical. Both play modes read from it.
The DM Screen and Crawler write runtime state (currentHP, conditions) to
LiveSession/PlayRun — they do not mutate the sheet during play.

**Fields:**
- Identity: characterName, class, subclass, race, background, alignment, level, xp
- Ability scores: STR, DEX, CON, INT, WIS, CHA (stores raw score; mod is derived)
- Combat: maxHP, currentHP, tempHP, AC, speed, initiative, proficiencyBonus, inspiration
- Saves: savingThrowProfs JSON — {STR: bool, DEX: bool, ...}
- Skills: skillProfs JSON — {Acrobatics: {prof: bool, expertise: bool}, ...}
- Attacks: JSON array — {name, bonus, damage, damageType, range, notes}
- Spell slots: JSON — {1: {max: 4, used: 0}, 2: {max: 3, used: 1}, ...}
- Spells prepared: JSON array of spell names/SRD ids
- Inventory: JSON array — {name, quantity, weight, notes, isEquipped}
- Currency: JSON — {cp, sp, ep, gp, pp}
- Features & traits: JSON arrays
- Personality: ideals, bonds, flaws, backstory (text fields)
- Death saves: successes (0-3), failures (0-3)
- Conditions: JSON array of active condition strings

**UI: `/projects/[slug]/sheet`**
Full-page character sheet. Tabs:
  - Abilities & Saves (6 scores, derived mods, proficiency checkboxes, death saves)
  - Combat & Skills (HP, AC, speed, conditions, all skills with checkboxes)
  - Attacks & Spells (attack list, spell slots tracker, prepared spells)
  - Equipment (inventory table, currency, weight)
  - Features & Background (class features, racial traits, background, personality)

Auto-calculates: ability modifiers, save bonuses, skill bonuses, initiative, passive perception.
Proficiency bonus auto-derived from level.
"HP" section has current/max/temp with quick +/- buttons.

### PartyMember (model)
Links a DAN user to a campaign, with a role (dm or player) and an optional
character sheet. Separate from ProjectContributor (which is for authoring).

Fields: projectId, username, role (dm/player), characterSheetId?, joinedAt

**UI: `/projects/[slug]/party`**
- Party roster: all members with their character names, class, level, HP
- DM can invite DAN users (same flow as project invite), assign role
- Players can link their character sheet here
- DM is shown with a crown icon

---

## Mode 1: DM Live Tools

URL: `/projects/[slug]/run`

The DM runs this on their screen (tablet or desktop) while friends sit at the
physical table. No AI. Pure real-time tools.

### What it contains

**Top bar:** Campaign name, session name, round counter, "End Session" button

**Initiative Track (left column, full height)**
Ordered list of combatants. Each card shows:
- Name + type icon (skull for monster, person for PC/NPC)
- HP bar (visual) + current/max HP + quick damage and heal buttons (click to input number)
- Temp HP field
- AC badge
- Condition chips (click to add/remove from SRD condition list)
- Spell slot pips for PCs (dots: filled = used, empty = available) — one row per level
- Expand/collapse for full stat block (SRD or homebrew creature, or full PC sheet)
- Drag to reorder (overrides initiative if needed)
- "Next Turn" advances the highlight; end of round increments round counter

**Encounter Panel (center)**
- "Load Encounter" — browse campaign encounters, populates initiative track with creatures
- Manual "Add Combatant" — name, HP, AC, initiative, type
- "Roll Initiative" — rolls for all monsters at once (or set manually)
- Current combatant highlighted with pulsing border
- Round tracker

**DM Notes (center, below encounter)**
- Free-text scratchpad for this session (not saved to DB — ephemeral)
- Quick dice roller: click d4/d6/d8/d10/d12/d20/d100 → result displayed with roll log

**PC Panel (right column)**
- Cards for each party member's character
- Current HP bar + damage/heal
- Spell slots per level (click to expend/restore)
- Active conditions
- Passive Perception badge
- "Inspiration" toggle
- Quick "Death Saves" tracker (3 success/fail pips)

**Encounter Completion**
When DM clicks "End Encounter":
- Prompt: "Mark this encounter as playtested?" → Yes → sets `isPlaytested = true` + `playtestedAt`
- Option to award XP to all party members (split or individual)
- HP of all party members saved to their sheets (or just persisted in session)

### Models

```
LiveSession
  id, projectId, encounterId?, name, roundNumber, activeIndex, isActive
  createdAt, updatedAt

Combatant
  id, sessionId, name, type(pc/monster/npc)
  initiative, sortOrder
  currentHP, maxHP, tempHP, AC
  conditions JSON
  spellSlots JSON (for PCs)
  inspiration Boolean
  deathSaveSuccesses, deathSaveFailures
  notes
  characterSheetId?, srdCreatureId?, campaignCreatureId?
```

### Route: `/projects/[slug]/run`
Full-screen layout. Escape key closes; no sidebar. Dark theme, high contrast.
Keyboard shortcuts: N = next turn, D = damage input, H = heal input.

---

## Mode 2: AI Dungeon Crawler

URL: `/projects/[slug]/play`

One or more DAN users play the campaign together, with Daneel acting as DM.
Daneel has full access to all campaign content (locations, keyed areas, encounters,
NPCs, quests, random tables, documents) and narrates/rules the session.

Co-op: each signed-in user controls their own character. All players see the
same narrative log. Combat is turn-based with a visible initiative order.

### Architecture

**PlayRun** — a single playthrough of the campaign. Persists between sessions.
State machine: `active` → `complete` / `dead` (whole party wiped, player chose reset)

**PlayRunPlayer** — per-user runtime state within a run. Mirrors CharacterSheet
but tracks changes during the run without mutating the canonical sheet.

**PlayRunLog** — the full narrative history. Every event: narration, dialogue,
combat action, loot, skill check, death, system message.

**PlayRunExplored** — which keyed areas have been visited, which encounters cleared.
When an encounter is cleared: marks PlayRunExplored + optionally tags Encounter.isPlaytested.

### Player experience

**Left panel: Map / Exploration Tree**
Shows the campaign's Location hierarchy as a tree. Explored areas shown normally;
unexplored areas shown as "???" until the party enters.
Current location highlighted.

**Center panel: Narrative Log**
Scrolling log of all events. Each entry styled by type:
- Narration: normal text, Daneel's voice
- Dialogue: NPC name in color, quoted speech
- Combat action: indented, dice icon
- Loot: green, item icon
- Skill check: blue, d20 icon
- System: gray, italic

Action input bar at the bottom: free text or quick-action buttons.

Quick actions (context-sensitive):
- In a room: [Move →] [Examine] [Search (Perception)] [Talk to NPC] [Rest]
- In combat: [Attack] [Cast Spell] [Use Item] [Dash] [Disengage] [Hide] [Help] [Flee]

**Right panel: Party**
Each character card: name, class, level, HP bar, conditions, spell slots.
Active combatant highlighted in combat.

### Combat flow

1. Daneel announces combat, describes the enemy
2. Each player and Daneel (for monsters) rolls initiative — shown in order
3. On a player's turn: action buttons become available
4. Player selects attack → chooses target → Daneel resolves (rolls attack + damage vs AC)
5. Monster turn: Daneel picks action based on creature's stat block tactics field
6. Loot + XP awarded on encounter end; level-up prompt if XP threshold crossed

**Level up:** Daneel presents 3 options (stat increase or class feature), player chooses.
Malevolent-crawler style: 2 rerolls allowed.

### Death handling (player choice on death)

When a player's HP hits 0:
- They roll death saves (d20, Daneel calls success/fail)
- At 3 failures: character dies

Modal prompt:
  > "[Character name] has fallen. What would you like to do?"
  > [Carry On] — continue as a ghost observer; other party members can revive you
  > [Respawn] — restart your character at the campaign start location, lose Xp gained since last rest, keep gear
  > [True Death / Roguelite] — character is gone; roll a new one and rejoin at current party location

If entire party is wiped:
  > [Retry from last rest point] — full party HP restored to last rest state
  > [Reset Run] — wipe the run, start fresh (keep party membership)

### AI DM system prompt (crawler)

Daneel in play mode gets:
- Full campaign documents (Wake Prompt, Campaign Overview, etc.)
- Current location and its keyed areas (read aloud + DM notes)
- Connected locations (for Move actions)
- Active quests and their status
- All NPCs in scope (current location + nearby)
- Party state (each character's HP, conditions, inventory, spells)
- Explored areas log

Daneel's instructions in crawler mode:
- Narrate in second person ("You enter the chamber...")
- Use readAloud text as the basis but adapt for party composition and prior events
- Never reveal dmNotes to players — use only for internal reasoning
- Call tools to update game state: award_xp, award_loot, mark_explored, advance_quest,
  trigger_combat, resolve_skill_check
- In combat, call resolve_attack and resolve_monster_action tools
- When the party moves to a new area, call move_party tool
- Keep responses concise in combat; more descriptive in exploration

### Tools available to Daneel in crawler mode

```
move_party(keyedAreaId)           — move party to a new area, triggers readAloud narration
trigger_combat(encounterId)       — start combat, set initiative
resolve_attack(attackerId, targetId, roll, damage)
resolve_monster_action(monsterId, action)
resolve_skill_check(playerId, skill, dc, roll) → success/fail
award_xp(amount, playerIds)
award_loot(items, currency)
mark_explored(keyedAreaId, encounterId?)  — marks cleared, optionally tags playtested
advance_quest(questId, newStatus)
heal_player(playerId, amount)
damage_player(playerId, amount)
apply_condition(targetId, condition)
remove_condition(targetId, condition)
expend_spell_slot(playerId, level)
restore_spell_slots(playerId)     — short or long rest
level_up_player(playerId, choice)
```

---

## Build Order

### Phase A (Character Sheets + Party) — Foundation
1. Add CharacterSheet + PartyMember models to schema
2. Add `isPlaytested` + `playtestedAt` to Encounter
3. Character sheet UI: `/projects/[slug]/sheet`
4. Party management UI: `/projects/[slug]/party`
5. Party invite (extend existing project invite flow or new role-aware invite)

### Phase B (DM Live Tools)
1. Add LiveSession + Combatant models
2. DM Screen UI: `/projects/[slug]/run`
3. Initiative tracker component
4. HP/condition board
5. Encounter launcher (load from existing encounters)
6. Dice roller
7. "Mark playtested" on encounter end

### Phase C (AI Crawler)
1. Add PlayRun + PlayRunPlayer + PlayRunLog + PlayRunExplored models
2. Crawler UI: `/projects/[slug]/play`
3. Play run creation (party joins, chars confirmed)
4. Narration loop (AI DM, exploration mode)
5. Combat system (initiative, turns, resolution)
6. Death handling UI
7. Level up flow
8. Loot + quest tracking

---

## Navigation additions

Campaign sidebar gets two new entries:
  ⚔ Run (DM Screen) — `/projects/[slug]/run`
  ▶ Play (Crawler) — `/projects/[slug]/play`

Both hidden for novel projects.
Character sheet accessible from `/projects/[slug]/sheet` and from the party page.
