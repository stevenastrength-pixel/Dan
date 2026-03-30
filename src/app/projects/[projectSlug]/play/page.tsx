'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number
  type: 'narration' | 'combat' | 'loot' | 'skill' | 'death' | 'dialogue' | 'system' | 'levelup' | 'intro'
  content: string
  speakerName: string
  createdAt: string
}

interface RunPlayer {
  id: number
  username: string
  characterName: string
  currentHP: number
  maxHP: number
  tempHP: number
  level: number
  xp: number
  conditions: string
  spellSlots: string
  deathState: string
  initiative: number
}

interface RunCombatant {
  id: number
  name: string
  type: string
  initiative: number
  sortOrder: number
  currentHP: number
  maxHP: number
  AC: number
  conditions: string
  isDefeated: boolean
}

interface PlayRun {
  id: number
  name: string
  state: string
  currentLocationId: number | null
  currentKeyedAreaId: number | null
  inCombat: boolean
  roundNumber: number
  players: RunPlayer[]
  combatants: RunCombatant[]
  log: LogEntry[]
  explored: Array<{ id: number; keyedAreaId: number | null }>
}

// ─── Log Entry component ──────────────────────────────────────────────────────

function LogLine({ entry, projectName }: { entry: LogEntry; projectName?: string }) {
  const base = 'text-sm leading-relaxed'

  if (entry.type === 'intro') {
    return (
      <div className="my-4 rounded-2xl overflow-hidden border border-slate-700/60 bg-gradient-to-b from-slate-900 to-slate-950">
        {/* Title banner */}
        <div className="px-6 py-5 border-b border-slate-700/40 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-600" />
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-500">Campaign</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-600" />
          </div>
          {projectName && (
            <h1 className="text-xl font-bold text-slate-100 tracking-wide">{projectName}</h1>
          )}
        </div>
        {/* Intro text */}
        <div className="px-6 py-5 space-y-3">
          {entry.content.split('\n\n').map((para, i) => (
            <p key={i} className="text-sm leading-loose text-slate-300 italic">{para}</p>
          ))}
        </div>
        <div className="px-6 pb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-[10px] tracking-widest text-slate-600 uppercase">Begin</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>
      </div>
    )
  }

  if (entry.type === 'narration' && entry.speakerName === 'Daneel') {
    return <p className={`${base} text-slate-200 italic`}>{entry.content}</p>
  }
  if (entry.type === 'narration') {
    return <p className={`${base} text-slate-200`}>{entry.content}</p>
  }
  if (entry.type === 'dialogue') {
    return (
      <p className={`${base} text-amber-300`}>
        <span className="font-semibold not-italic">{entry.speakerName}: </span>
        <span className="italic">"{entry.content}"</span>
      </p>
    )
  }
  if (entry.type === 'combat') {
    return <p className={`${base} text-red-300`}><span className="mr-1">⚔</span>{entry.content}</p>
  }
  if (entry.type === 'loot') {
    return <p className={`${base} text-emerald-300`}><span className="mr-1">💰</span>{entry.content}</p>
  }
  if (entry.type === 'skill') {
    return <p className={`${base} text-sky-300`}><span className="mr-1">🎲</span>{entry.content}</p>
  }
  if (entry.type === 'death') {
    return <p className={`${base} text-red-400 font-semibold`}><span className="mr-1">💀</span>{entry.speakerName}: {entry.content}</p>
  }
  if (entry.type === 'system') {
    if (entry.speakerName && entry.speakerName !== 'Daneel') {
      return (
        <p className={`${base} text-slate-300`}>
          <span className="font-semibold text-violet-300">{entry.speakerName}: </span>
          {entry.content}
        </p>
      )
    }
    return <p className={`${base} text-slate-500 text-xs italic`}>{entry.content}</p>
  }
  return <p className={`${base} text-slate-400`}>{entry.content}</p>
}

// ─── Player Card ──────────────────────────────────────────────────────────────

function PlayerCard({ player, isCurrentUser }: { player: RunPlayer; isCurrentUser: boolean }) {
  const hpPct = player.maxHP > 0 ? Math.max(0, Math.min(100, (player.currentHP / player.maxHP) * 100)) : 0
  const hpColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500'
  let conditions: string[] = []
  try { conditions = JSON.parse(player.conditions) } catch {}

  return (
    <div className={`rounded-xl border p-3 ${isCurrentUser ? 'border-violet-500/50 bg-violet-900/10' : 'border-slate-700/40 bg-slate-800/40'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-slate-200">{player.characterName}</span>
        <span className="text-[10px] text-slate-500">{player.username}</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${hpColor} rounded-full transition-all`} style={{ width: `${hpPct}%` }} />
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{player.currentHP}/{player.maxHP}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span>Lv {player.level}</span>
        <span>{player.xp} XP</span>
        {player.deathState !== 'alive' && <span className="text-red-400 font-bold uppercase">{player.deathState}</span>}
      </div>
      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {conditions.map(c => <span key={c} className="text-[9px] bg-amber-900/40 text-amber-300 border border-amber-700/30 rounded px-1">{c}</span>)}
        </div>
      )}
    </div>
  )
}

// ─── Combatant Row ────────────────────────────────────────────────────────────

function CombatantRow({ c }: { c: RunCombatant }) {
  const pct = c.maxHP > 0 ? Math.max(0, Math.min(100, (c.currentHP / c.maxHP) * 100)) : 0
  const color = c.type === 'monster' ? 'bg-red-500' : 'bg-emerald-500'
  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${c.isDefeated ? 'opacity-40' : ''} bg-slate-800/40`}>
      <span className="text-xs w-5 text-center text-slate-500">{c.initiative}</span>
      <span className="flex-1 text-xs text-slate-200 truncate">{c.name}</span>
      <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 tabular-nums w-12 text-right">{c.currentHP}/{c.maxHP}</span>
    </div>
  )
}

// ─── Player Drawer ────────────────────────────────────────────────────────────

interface SheetData {
  characterName: string; className: string; subclass: string; race: string; background: string
  level: number; xp: number; alignment: string
  STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number
  maxHP: number; currentHP: number; tempHP: number; AC: number; speed: number; proficiencyBonus: number
  savingThrowProfs: string; skillProfs: string; attacks: string; spellSlots: string
  inventory: string; currency: string
  features: string; personalityTraits: string; ideals: string; bonds: string; flaws: string; backstory: string
  passivePerception: number; initiative: number; inspiration: boolean
}

interface QuestData { id: number; name: string; questType: string; status: string; description: string }
interface ExploredArea { id: number; keyedAreaId: number | null }

const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
const ALL_SKILLS: { name: string; ability: string }[] = [
  { name: 'Acrobatics', ability: 'DEX' }, { name: 'Animal Handling', ability: 'WIS' },
  { name: 'Arcana', ability: 'INT' }, { name: 'Athletics', ability: 'STR' },
  { name: 'Deception', ability: 'CHA' }, { name: 'History', ability: 'INT' },
  { name: 'Insight', ability: 'WIS' }, { name: 'Intimidation', ability: 'CHA' },
  { name: 'Investigation', ability: 'INT' }, { name: 'Medicine', ability: 'WIS' },
  { name: 'Nature', ability: 'INT' }, { name: 'Perception', ability: 'WIS' },
  { name: 'Performance', ability: 'CHA' }, { name: 'Persuasion', ability: 'CHA' },
  { name: 'Religion', ability: 'INT' }, { name: 'Sleight of Hand', ability: 'DEX' },
  { name: 'Stealth', ability: 'DEX' }, { name: 'Survival', ability: 'WIS' },
]

function mod(score: number) { return Math.floor((score - 10) / 2) }
function fmtMod(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function PlayerDrawer({ slug, player, run, onClose }: {
  slug: string
  player: RunPlayer
  run: PlayRun
  onClose: () => void
}) {
  const [tab, setTab] = useState<'sheet' | 'equipment' | 'journal'>('sheet')
  const [sheet, setSheet] = useState<SheetData | null>(null)
  const [quests, setQuests] = useState<QuestData[]>([])
  const [exploredAreas, setExploredAreas] = useState<string[]>([])
  const [loadingSheet, setLoadingSheet] = useState(true)
  const [loadingJournal, setLoadingJournal] = useState(true)

  useEffect(() => {
    fetch(`/api/projects/${slug}/character-sheet`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSheet(d); setLoadingSheet(false) })
  }, [slug])

  useEffect(() => {
    fetch(`/api/quests?projectSlug=${slug}`)
      .then(r => r.ok ? r.json() : [])
      .then(async (qs: QuestData[]) => {
        setQuests(qs)
        // Resolve explored keyed area names
        const explored: ExploredArea[] = run.explored ?? []
        const ids = explored.map(e => e.keyedAreaId).filter(Boolean) as number[]
        if (ids.length > 0) {
          const res = await fetch(`/api/keyed-areas?ids=${ids.join(',')}`)
          if (res.ok) {
            const areas: Array<{ id: number; key: string; title: string; location: { name: string } }> = await res.json()
            setExploredAreas(areas.map(a => `${a.key} — ${a.title} (${a.location.name})`))
          }
        }
        setLoadingJournal(false)
      })
  }, [slug, run.explored])

  let saves: Record<string, boolean> = {}
  let skills: Record<string, { prof: boolean; expertise: boolean }> = {}
  let spellSlots: Record<string, { max: number; used: number }> = {}
  let attacks: Array<{ name: string; attackBonus: number; damage: string; damageType: string; range: string; notes: string }> = []
  let inventory: Array<{ name: string; quantity: number; notes: string; isEquipped: boolean }> = []
  let currency: { cp: number; sp: number; ep: number; gp: number; pp: number } = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }
  if (sheet) {
    try { saves = JSON.parse(sheet.savingThrowProfs) } catch {}
    try { skills = JSON.parse(sheet.skillProfs) } catch {}
    try { spellSlots = JSON.parse(sheet.spellSlots) } catch {}
    try { attacks = JSON.parse(sheet.attacks) } catch {}
    try { inventory = JSON.parse(sheet.inventory) } catch {}
    try { currency = JSON.parse(sheet.currency) } catch {}
  }

  return (
    <div className="w-64 h-full bg-slate-950 border-l border-slate-800/60 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-1 px-3 py-3 border-b border-slate-800/60">
          {([['sheet', 'Character'], ['equipment', 'Equipment'], ['journal', 'Journal']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* ── Character Sheet tab ── */}
          {tab === 'sheet' && (
            loadingSheet ? <p className="text-sm text-slate-500">Loading…</p> : !sheet ? <p className="text-sm text-slate-500">No character sheet found.</p> : (
              <div className="space-y-4">
                {/* Identity */}
                <div>
                  <p className="text-base font-bold text-slate-200">{sheet.characterName}</p>
                  <p className="text-xs text-slate-500">{sheet.race} {sheet.className}{sheet.subclass ? ` (${sheet.subclass})` : ''} · Level {player.level} · {sheet.background}</p>
                  {sheet.alignment && <p className="text-xs text-slate-600">{sheet.alignment}</p>}
                </div>

                {/* HP / AC / Speed — use runtime HP from PlayRunPlayer */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'HP', value: `${player.currentHP}/${player.maxHP}${player.tempHP > 0 ? `+${player.tempHP}` : ''}` },
                    { label: 'AC', value: sheet.AC },
                    { label: 'Speed', value: `${sheet.speed}ft` },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/60 rounded-xl p-2 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">{s.label}</p>
                      <p className="text-sm font-bold text-slate-200">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Ability scores */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Abilities</p>
                  <div className="grid grid-cols-6 gap-1">
                    {ABILITY_NAMES.map(ab => (
                      <div key={ab} className="bg-slate-800/60 rounded-lg p-1.5 text-center">
                        <p className="text-[9px] text-slate-500 uppercase">{ab}</p>
                        <p className="text-sm font-bold text-slate-200">{sheet[ab]}</p>
                        <p className="text-[10px] text-slate-400">{fmtMod(mod(sheet[ab]))}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Saving throws */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Saving Throws</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {ABILITY_NAMES.map(ab => {
                      const prof = saves[ab] ?? false
                      const bonus = mod(sheet[ab]) + (prof ? sheet.proficiencyBonus : 0)
                      return (
                        <div key={ab} className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${prof ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                          <span>{fmtMod(bonus)} {ab}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Skills</p>
                  <div className="space-y-0.5">
                    {ALL_SKILLS.map(sk => {
                      const entry = skills[sk.name] ?? { prof: false, expertise: false }
                      const abilityScore = sheet[sk.ability as keyof SheetData] as number
                      const bonus = mod(abilityScore) + (entry.expertise ? sheet.proficiencyBonus * 2 : entry.prof ? sheet.proficiencyBonus : 0)
                      return (
                        <div key={sk.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.expertise ? 'bg-amber-400' : entry.prof ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                          <span className="w-4 text-[9px] text-slate-600">{sk.ability}</span>
                          <span className="flex-1">{sk.name}</span>
                          <span className="text-slate-300">{fmtMod(bonus)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Spell slots */}
                {Object.keys(spellSlots).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Spell Slots</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(spellSlots).map(([lvl, slot]) => (
                        <div key={lvl} className="text-center">
                          <p className="text-[9px] text-slate-500">Lv{lvl}</p>
                          <div className="flex gap-0.5 mt-0.5">
                            {Array.from({ length: slot.max }).map((_, i) => (
                              <span key={i} className={`w-2 h-2 rounded-full ${i < slot.max - slot.used ? 'bg-violet-400' : 'bg-slate-700'}`} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personality */}
                {(sheet.personalityTraits || sheet.ideals || sheet.bonds || sheet.flaws) && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Personality</p>
                    {[
                      { label: 'Traits', val: sheet.personalityTraits },
                      { label: 'Ideals', val: sheet.ideals },
                      { label: 'Bonds', val: sheet.bonds },
                      { label: 'Flaws', val: sheet.flaws },
                    ].filter(x => x.val).map(x => (
                      <div key={x.label}>
                        <p className="text-[9px] text-slate-600 uppercase">{x.label}</p>
                        <p className="text-xs text-slate-400">{x.val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* ── Equipment tab ── */}
          {tab === 'equipment' && (
            loadingSheet ? <p className="text-sm text-slate-500">Loading…</p> : !sheet ? <p className="text-sm text-slate-500">No character sheet found.</p> : (
              <div className="space-y-5">
                {/* Attacks */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Attacks</p>
                  {attacks.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No attacks.</p>
                  ) : (
                    <div className="space-y-2">
                      {attacks.map((a, i) => (
                        <div key={i} className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/40">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-200">{a.name}</span>
                            <span className="text-xs text-emerald-400 font-mono">{a.attackBonus >= 0 ? `+${a.attackBonus}` : a.attackBonus}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="text-amber-300 font-mono">{a.damage}</span>
                            <span>{a.damageType}</span>
                            <span className="ml-auto">{a.range}</span>
                          </div>
                          {a.notes && <p className="text-[10px] text-slate-600 mt-1">{a.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inventory */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Inventory</p>
                  {inventory.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No items.</p>
                  ) : (
                    <div className="space-y-1">
                      {inventory.map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${item.isEquipped ? 'bg-emerald-500/10 border border-emerald-500/20 text-slate-200' : 'text-slate-400'}`}>
                          {item.isEquipped && <span className="text-emerald-400 text-[9px] font-bold uppercase shrink-0">Eq</span>}
                          <span className="flex-1 truncate">{item.name}</span>
                          {item.quantity > 1 && <span className="text-slate-500 shrink-0">×{item.quantity}</span>}
                          {item.notes && <span className="text-slate-600 text-[9px] shrink-0 truncate max-w-[60px]">{item.notes}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Currency */}
                {(currency.gp > 0 || currency.sp > 0 || currency.cp > 0 || currency.ep > 0 || currency.pp > 0) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Currency</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'PP', val: currency.pp, color: 'text-violet-300' },
                        { label: 'GP', val: currency.gp, color: 'text-amber-300' },
                        { label: 'EP', val: currency.ep, color: 'text-slate-300' },
                        { label: 'SP', val: currency.sp, color: 'text-slate-400' },
                        { label: 'CP', val: currency.cp, color: 'text-orange-400' },
                      ].filter(c => c.val > 0).map(c => (
                        <div key={c.label} className="bg-slate-800/60 rounded-lg px-2.5 py-1.5 text-center">
                          <p className="text-[9px] text-slate-600 uppercase">{c.label}</p>
                          <p className={`text-xs font-bold ${c.color}`}>{c.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* ── Journal tab ── */}
          {tab === 'journal' && (
            loadingJournal ? <p className="text-sm text-slate-500">Loading…</p> : (
              <div className="space-y-5">
                {/* Quests */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Quests</p>
                  {quests.length === 0 ? (
                    <p className="text-xs text-slate-600">No quests yet.</p>
                  ) : quests.map(q => (
                    <div key={q.id} className="mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          q.status === 'complete' ? 'bg-emerald-500/20 text-emerald-400' :
                          q.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'}`}>{q.status}</span>
                        <span className="text-xs font-medium text-slate-300">{q.name}</span>
                        <span className="text-[9px] text-slate-600">{q.questType}</span>
                      </div>
                      {q.description && <p className="text-xs text-slate-500 mt-0.5 ml-4 line-clamp-2">{q.description}</p>}
                    </div>
                  ))}
                </div>

                {/* Explored areas */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Explored Areas</p>
                  {exploredAreas.length === 0 ? (
                    <p className="text-xs text-slate-600">Nowhere explored yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {exploredAreas.map((a, i) => (
                        <li key={i} className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="text-emerald-500 text-[10px]">✓</span>{a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          )}
        </div>
    </div>
  )
}

// ─── Death Modal ──────────────────────────────────────────────────────────────

function DeathModal({ playerName, onChoice }: { playerName: string; onChoice: (choice: 'carry_on' | 'respawn' | 'true_death') => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-red-800/60 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="text-4xl mb-3">💀</div>
        <h2 className="text-lg font-bold text-red-300 mb-1">{playerName} has fallen.</h2>
        <p className="text-sm text-slate-400 mb-6">What would you like to do?</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => onChoice('carry_on')}
            className="w-full py-3 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors text-sm">
            <div className="font-semibold">Carry On</div>
            <div className="text-xs text-slate-500 mt-0.5">Continue as a ghost — your allies can revive you</div>
          </button>
          <button onClick={() => onChoice('respawn')}
            className="w-full py-3 rounded-xl border border-amber-600/40 text-amber-300 hover:bg-amber-900/20 transition-colors text-sm">
            <div className="font-semibold">Respawn</div>
            <div className="text-xs text-amber-500/70 mt-0.5">Restart at last rest point — lose XP since last rest, keep gear</div>
          </button>
          <button onClick={() => onChoice('true_death')}
            className="w-full py-3 rounded-xl border border-red-700/40 text-red-300 hover:bg-red-900/20 transition-colors text-sm">
            <div className="font-semibold">True Death</div>
            <div className="text-xs text-red-500/70 mt-0.5">Character is gone — roll a new one and rejoin</div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Join screen ──────────────────────────────────────────────────────────────

function JoinScreen({ slug, onJoined }: { slug: string; onJoined: (run: PlayRun) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const join = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${slug}/play-run`, { method: 'POST' })
      const text = await res.text()
      if (!res.ok) {
        let msg = 'Failed to join.'
        try { msg = JSON.parse(text).error ?? msg } catch {}
        setError(msg)
        setLoading(false)
        return
      }
      onJoined(JSON.parse(text))
    } catch (e) {
      setError(`Server error: ${e instanceof Error ? e.message : String(e)}`)
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 gap-6 px-8 text-center">
      <div className="text-5xl">▶</div>
      <div>
        <h1 className="text-xl font-bold text-slate-200 mb-2">AI Dungeon Crawler</h1>
        <p className="text-sm text-slate-500 max-w-md">
          Daneel will DM the campaign for you and your party. Your character sheet stats carry over automatically.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-col gap-3 items-center">
        <button onClick={join} disabled={loading}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm">
          {loading ? 'Joining…' : 'Enter the Adventure'}
        </button>
        <div className="flex gap-3">
          <Link href={`/projects/${slug}/party`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Set up party first →</Link>
          <Link href={`/projects/${slug}/sheet`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Character sheet →</Link>
        </div>
      </div>
    </div>
  )
}

// ─── Main crawler ─────────────────────────────────────────────────────────────

export default function PlayPage() {
  const params = useParams()
  const slug = params.projectSlug as string

  const [run, setRun] = useState<PlayRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [joined, setJoined] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUser, setCurrentUser] = useState<string>('')
  const [deathModal, setDeathModal] = useState<{ playerId: number; playerName: string } | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [talkToDaneel, setTalkToDaneel] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(u => { if (u) setCurrentUser(u.username) })
  }, [])

  const fetchRun = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}/play-run`)
    if (res.ok) {
      const data = await res.json()
      if (data) { setRun(data); setJoined(true) }
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { fetchRun() }, [fetchRun])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [run?.log.length])

  // Watch for player death
  useEffect(() => {
    if (!run || !currentUser) return
    const me = run.players.find(p => p.username === currentUser)
    if (me && me.deathState === 'unconscious' && !deathModal) {
      setDeathModal({ playerId: me.id, playerName: me.characterName })
    }
  }, [run, currentUser, deathModal])

  const handleJoined = (newRun: PlayRun) => {
    setRun(newRun)
    setJoined(true)
  }

  const sendAction = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    const speakerName = run?.players.find(p => p.username === currentUser)?.characterName ?? currentUser

    // Optimistic: add message to log immediately
    const tempEntry: LogEntry = {
      id: Date.now(),
      type: talkToDaneel ? 'system' : 'dialogue',
      content: text,
      speakerName,
      createdAt: new Date().toISOString(),
    }
    setRun(prev => prev ? { ...prev, log: [...prev.log, tempEntry] } : prev)

    if (talkToDaneel) {
      // Send to Daneel — full AI DM loop
      try {
        const res = await fetch(`/api/projects/${slug}/play-run/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const resText = await res.text()
        if (res.ok && resText) {
          try { setRun(JSON.parse(resText)) } catch {}
        }
      } catch {}
    } else {
      // Party chat only — log the message without calling Daneel
      try {
        const res = await fetch(`/api/projects/${slug}/play-run/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, partyOnly: true }),
        })
        const resText = await res.text()
        if (res.ok && resText) {
          try { setRun(JSON.parse(resText)) } catch {}
        }
      } catch {}
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendAction()
    }
  }

  const handleDeathChoice = async (choice: 'carry_on' | 'respawn' | 'true_death') => {
    if (!deathModal) return
    setDeathModal(null)
    // Update player death state
    await fetch(`/api/projects/${slug}/play-run/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[Death choice: ${choice.replace('_', ' ')}]` }),
    }).then(r => r.ok ? r.json() : null).then(updated => { if (updated) setRun(updated) })
  }

  const wipeRun = async () => {
    if (!confirm('Are you sure you want to wipe this run? All progress will be lost.')) return
    await fetch(`/api/projects/${slug}/play-run`, { method: 'DELETE' })
    setRun(null)
    setJoined(false)
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500 text-sm">Loading…</div>
  }

  if (!joined || !run) {
    return <JoinScreen slug={slug} onJoined={handleJoined} />
  }

  const me = run.players.find(p => p.username === currentUser)
  const sortedCombatants = [...run.combatants].sort((a, b) => b.initiative - a.initiative)

  return (
    <div className="flex-1 flex min-h-0 bg-slate-950 overflow-hidden">
      {deathModal && <DeathModal playerName={deathModal.playerName} onChoice={handleDeathChoice} />}

      {/* ── Main area — shifts left on mobile when sidebar opens ────── */}
      <div className={`flex flex-col flex-1 min-h-0 overflow-hidden transition-transform duration-200 ease-in-out ${showDrawer ? '-translate-x-64 lg:translate-x-0' : 'translate-x-0'}`}>

        {/* Header */}
        <div className="px-4 h-12 border-b border-slate-800/60 shrink-0 flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-200 truncate">{run.name}</span>
          {run.inCombat && (
            <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">
              Combat · Round {run.roundNumber}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {me && <span className="text-[10px] text-slate-500 hidden sm:inline">{me.characterName} · {me.currentHP}/{me.maxHP} HP</span>}
            <button onClick={() => setShowDrawer(v => !v)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors text-base ${showDrawer ? 'border-violet-500/40 text-violet-400 bg-violet-500/10' : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
              title="Character & Journal">
              📋
            </button>
          </div>
        </div>

        {/* Log */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {run.log.map(entry => <LogLine key={entry.id} entry={entry} projectName={run.name.replace(/ — Adventure$/, '')} />)}
          {sending && <p className="text-xs text-slate-600 italic animate-pulse">Daneel is thinking…</p>}
          <div ref={logEndRef} />
        </div>

        {/* Quick actions in combat */}
        {run.inCombat && (
          <div className="px-4 py-2 border-t border-slate-800/40 flex flex-wrap gap-1.5">
            {['I attack!', 'I cast a spell', 'I dash', 'I hide', 'I help an ally', 'I disengage'].map(action => (
              <button key={action} onClick={() => { setInput(action); inputRef.current?.focus() }}
                className="text-[10px] px-2 py-1 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors">
                {action}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800/60 shrink-0">
          <div className="flex gap-2 items-end">
            {/* Daneel / Party toggle — left of textarea */}
            <button onClick={() => setTalkToDaneel(v => !v)} title={talkToDaneel ? 'Switch to party-only chat' : 'Switch to Daneel DM mode'}
              className={`shrink-0 flex flex-col items-center justify-center gap-1 h-[60px] w-14 rounded-xl border text-[9px] font-bold uppercase tracking-wide transition-colors ${talkToDaneel ? 'border-violet-500/50 bg-violet-500/10 text-violet-300' : 'border-amber-600/40 bg-amber-500/10 text-amber-400'}`}>
              <span className={`w-3 h-3 rounded-full ${talkToDaneel ? 'bg-violet-400' : 'bg-amber-400'}`} />
              {talkToDaneel ? 'Daneel' : 'Party'}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={talkToDaneel ? (run.inCombat ? 'Declare your action…' : 'What do you do?') : 'Say something to the party…'}
              rows={2}
              className={`flex-1 resize-none border rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors bg-slate-800/60 ${talkToDaneel ? 'border-slate-700 focus:border-violet-500/60' : 'border-slate-700 focus:border-amber-500/60'}`}
              disabled={sending}
            />
            <button onClick={sendAction} disabled={sending || !input.trim()}
              className={`h-10 px-4 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors ${talkToDaneel ? 'bg-violet-600 hover:bg-violet-500' : 'bg-amber-600 hover:bg-amber-500'}`}>
              →
            </button>
          </div>
          <p className="text-[10px] text-slate-700 mt-1 ml-16">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      {/* ── Right sidebar: Character & Journal — same pattern as doc sidebar ── */}
      <div className={`
        fixed lg:static inset-y-0 right-0 z-40 shrink-0 lg:h-full w-64
        transition-transform duration-200 ease-in-out
        ${showDrawer ? 'translate-x-0' : 'translate-x-full lg:hidden'}
      `}>
        {me && <PlayerDrawer slug={slug} player={me} run={run} onClose={() => setShowDrawer(false)} />}
      </div>
    </div>
  )
}
