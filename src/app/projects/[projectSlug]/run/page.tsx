'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpellSlot { max: number; used: number }
interface Combatant {
  id: number; name: string; type: 'pc' | 'monster' | 'npc'
  initiative: number; sortOrder: number
  currentHP: number; maxHP: number; tempHP: number; AC: number; speed: number
  conditions: string[]; spellSlots: Record<string, SpellSlot>
  inspiration: boolean; deathSaveSuccesses: number; deathSaveFailures: number
  notes: string
  characterSheetId?: string | null
  srdCreatureId?: number | null
  campaignCreatureId?: number | null
}
interface Session { id: number; name: string; roundNumber: number; activeIndex: number; isActive: boolean; combatants: Combatant[] }
interface EncounterCreatureRef { id: number; quantity: number; srdCreatureId?: number | null; campaignCreatureId?: number | null; notes: string; srdCreature?: { id: number; name: string; AC: number; HPAverage: number; CR: string } | null; campaignCreature?: { id: number; name: string; AC: number; HPAverage: number } | null }
interface Encounter { id: number; name: string; difficulty: string; encounterType: string; readAloud: string; creatures: EncounterCreatureRef[] }
interface PartyMemberSheet { username: string; role: string; characterSheet?: { id: string; characterName: string; className: string; level: number; maxHP: number; currentHP: number; AC: number; spellSlots: string; inspiration: boolean } | null }
interface StatBlock { name: string; AC: number; HPAverage: number; HPDice: string; speed: string; STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number; CR: string; actions: string; traits: string; reactions: string; legendaryActions: string; savingThrows: string; skills: string; damageResistances: string; damageImmunities: string; conditions: string; senses: string; languages: string; size: string; creatureType: string; alignment: string }

const CONDITIONS = ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious']
const CONDITION_COLORS: Record<string, string> = { Blinded:'bg-gray-500/20 border-gray-500/40 text-gray-300', Charmed:'bg-pink-500/20 border-pink-500/40 text-pink-300', Deafened:'bg-slate-500/20 border-slate-500/40 text-slate-300', Exhaustion:'bg-orange-500/20 border-orange-500/40 text-orange-300', Frightened:'bg-purple-500/20 border-purple-500/40 text-purple-300', Grappled:'bg-yellow-500/20 border-yellow-500/40 text-yellow-300', Incapacitated:'bg-red-600/20 border-red-600/40 text-red-300', Invisible:'bg-cyan-500/20 border-cyan-500/40 text-cyan-300', Paralyzed:'bg-red-500/20 border-red-500/40 text-red-300', Petrified:'bg-stone-500/20 border-stone-500/40 text-stone-300', Poisoned:'bg-green-600/20 border-green-600/40 text-green-300', Prone:'bg-amber-500/20 border-amber-500/40 text-amber-300', Restrained:'bg-yellow-600/20 border-yellow-600/40 text-yellow-300', Stunned:'bg-violet-500/20 border-violet-500/40 text-violet-300', Unconscious:'bg-slate-600/20 border-slate-600/40 text-slate-300' }

function mod(score: number) { return Math.floor((score - 10) / 2) }
function fmtMod(n: number) { return n >= 0 ? `+${n}` : `${n}` }
function rollDie(sides: number) { return Math.floor(Math.random() * sides) + 1 }

function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v === 'string') { try { return JSON.parse(v) as T } catch { return fallback } }
  if (v != null) return v as T
  return fallback
}

function parseCombatant(raw: Record<string, unknown>): Combatant {
  return {
    id: Number(raw.id), name: String(raw.name), type: (raw.type as Combatant['type']) ?? 'monster',
    initiative: Number(raw.initiative ?? 0), sortOrder: Number(raw.sortOrder ?? 0),
    currentHP: Number(raw.currentHP ?? 10), maxHP: Number(raw.maxHP ?? 10), tempHP: Number(raw.tempHP ?? 0),
    AC: Number(raw.AC ?? 10), speed: Number(raw.speed ?? 30),
    conditions: parseJson(raw.conditions, []),
    spellSlots: parseJson(raw.spellSlots, {}),
    inspiration: Boolean(raw.inspiration),
    deathSaveSuccesses: Number(raw.deathSaveSuccesses ?? 0),
    deathSaveFailures: Number(raw.deathSaveFailures ?? 0),
    notes: String(raw.notes ?? ''),
    characterSheetId: (raw.characterSheetId as string | null) ?? null,
    srdCreatureId: (raw.srdCreatureId as number | null) ?? null,
    campaignCreatureId: (raw.campaignCreatureId as number | null) ?? null,
  }
}

// ─── Dice Roller ──────────────────────────────────────────────────────────────

function DiceRoller() {
  const [rolls, setRolls] = useState<{ die: string; result: number }[]>([])
  const DICE = [4, 6, 8, 10, 12, 20, 100]

  const roll = (sides: number) => {
    const result = rollDie(sides)
    setRolls(prev => [{ die: `d${sides}`, result }, ...prev.slice(0, 19)])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {DICE.map(d => (
          <button key={d} onClick={() => roll(d)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 hover:border-slate-600 text-slate-300 text-xs font-bold rounded-lg transition-colors min-w-[2.5rem] text-center">
            d{d}
          </button>
        ))}
      </div>
      {rolls.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {rolls.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${i === 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : ''}`}>
              <span className="text-slate-600 w-6 text-right font-mono">{r.die}</span>
              <span className={`font-bold tabular-nums ${i === 0 ? 'text-emerald-300 text-base' : 'text-slate-400'}`}>{r.result}</span>
              {r.result === parseInt(r.die.slice(1)) && <span className="text-amber-400 text-[10px] font-bold">NAT!</span>}
              {r.result === 1 && <span className="text-red-400 text-[10px] font-bold">CRIT FAIL</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Spell Slot Pips ──────────────────────────────────────────────────────────

function SpellSlotRow({ slots, onChange }: { slots: Record<string, SpellSlot>; onChange: (slots: Record<string, SpellSlot>) => void }) {
  const levels = Object.entries(slots).filter(([, s]) => s.max > 0)
  if (levels.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {levels.map(([lvl, s]) => (
        <div key={lvl} className="flex items-center gap-1">
          <span className="text-[9px] text-slate-600 font-bold">{lvl}</span>
          {Array.from({ length: s.max }).map((_, i) => (
            <button key={i} title={i < s.used ? 'Restore slot' : 'Expend slot'}
              onClick={() => {
                const newUsed = i < s.used ? i : i + 1
                onChange({ ...slots, [lvl]: { ...s, used: Math.min(newUsed, s.max) } })
              }}
              className={`w-3 h-3 rounded-full border transition-colors ${i < s.used ? 'bg-slate-700 border-slate-600' : 'bg-violet-500 border-violet-400'}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Condition Picker ─────────────────────────────────────────────────────────

function ConditionPicker({ active, onChange }: { active: string[]; onChange: (c: string[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 items-center">
        {active.map(c => (
          <button key={c} onClick={() => onChange(active.filter(x => x !== c))}
            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium transition-colors ${CONDITION_COLORS[c] ?? 'bg-slate-700 border-slate-600 text-slate-300'}`}
            title="Click to remove">
            {c}
          </button>
        ))}
        <button onClick={() => setOpen(v => !v)}
          className="w-5 h-5 flex items-center justify-center rounded-full border border-dashed border-slate-600 text-slate-600 hover:text-slate-400 hover:border-slate-500 text-xs transition-colors leading-none">
          +
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-6 left-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 w-48">
          <div className="flex flex-wrap gap-1">
            {CONDITIONS.filter(c => !active.includes(c)).map(c => (
              <button key={c} onClick={() => { onChange([...active, c]); setOpen(false) }}
                className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
                {c}
              </button>
            ))}
          </div>
          <button onClick={() => setOpen(false)} className="mt-2 text-[10px] text-slate-600 hover:text-slate-400 w-full text-right">close</button>
        </div>
      )}
    </div>
  )
}

// ─── HP Bar ───────────────────────────────────────────────────────────────────

function HPBar({ current, max, temp }: { current: number; max: number; temp: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  const color = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="relative h-2 bg-slate-700/60 rounded-full overflow-visible">
      <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      {temp > 0 && (
        <div className="absolute inset-y-0 rounded-full bg-cyan-400/60" style={{ left: `${pct}%`, width: `${Math.min(100 - pct, (temp / max) * 100)}%` }} />
      )}
    </div>
  )
}

// ─── Death Save Tracker ───────────────────────────────────────────────────────

function DeathSaveTracker({ successes, failures, onChange }: { successes: number; failures: number; onChange: (s: number, f: number) => void }) {
  return (
    <div className="flex gap-4 text-[10px]">
      <div className="flex items-center gap-1">
        <span className="text-emerald-500 font-bold">✓</span>
        {[0,1,2].map(i => (
          <button key={i} onClick={() => onChange(i < successes ? i : i + 1, failures)}
            className={`w-3 h-3 rounded-full border ${i < successes ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-600'}`} />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-red-500 font-bold">✗</span>
        {[0,1,2].map(i => (
          <button key={i} onClick={() => onChange(successes, i < failures ? i : i + 1)}
            className={`w-3 h-3 rounded-full border ${i < failures ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-600'}`} />
        ))}
      </div>
    </div>
  )
}

// ─── Stat Block Modal ─────────────────────────────────────────────────────────

function StatBlockModal({ block, onClose }: { block: StatBlock; onClose: () => void }) {
  const actions = parseJson<Array<{ name: string; description: string; attackBonus?: number; damage?: string; damageType?: string }>>(block.actions as unknown, [])
  const traits = parseJson<Array<{ name: string; description: string }>>(block.traits as unknown, [])
  const reactions = parseJson<Array<{ name: string; description: string }>>(block.reactions as unknown, [])
  const legendaryActions = parseJson<Array<{ name: string; description: string }>>(block.legendaryActions as unknown, [])
  const saves = parseJson<string[]>(block.savingThrows as unknown, [])
  const skills = parseJson<string[]>(block.skills as unknown, [])
  const resistances = parseJson<string[]>(block.damageResistances as unknown, [])
  const immunities = parseJson<string[]>(block.damageImmunities as unknown, [])
  const STATS: Array<[string, keyof StatBlock]> = [['STR','STR'],['DEX','DEX'],['CON','CON'],['INT','INT'],['WIS','WIS'],['CHA','CHA']]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100">{block.name}</h2>
              <p className="text-xs text-slate-500">{block.size} {block.creatureType}{block.alignment ? `, ${block.alignment}` : ''}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
          </div>
          <div className="flex gap-4 text-xs">
            <span><span className="text-slate-500">AC</span> <strong className="text-slate-200">{block.AC}</strong></span>
            <span><span className="text-slate-500">HP</span> <strong className="text-slate-200">{block.HPAverage} ({block.HPDice})</strong></span>
            <span><span className="text-slate-500">Speed</span> <strong className="text-slate-200">{block.speed}</strong></span>
            <span><span className="text-slate-500">CR</span> <strong className="text-slate-200">{block.CR}</strong></span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {STATS.map(([label, key]) => {
              const score = Number(block[key] ?? 10)
              return (
                <div key={label} className="bg-slate-800/60 rounded-lg p-2 text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">{label}</div>
                  <div className="text-sm font-bold text-slate-200">{score}</div>
                  <div className="text-[10px] text-emerald-400">{fmtMod(mod(score))}</div>
                </div>
              )
            })}
          </div>
          {(saves.length > 0 || skills.length > 0) && (
            <div className="text-xs space-y-1">
              {saves.length > 0 && <p><span className="text-slate-500">Saves:</span> <span className="text-slate-300">{saves.join(', ')}</span></p>}
              {skills.length > 0 && <p><span className="text-slate-500">Skills:</span> <span className="text-slate-300">{skills.join(', ')}</span></p>}
              {resistances.length > 0 && <p><span className="text-slate-500">Resistances:</span> <span className="text-slate-300">{resistances.join(', ')}</span></p>}
              {immunities.length > 0 && <p><span className="text-slate-500">Immunities:</span> <span className="text-slate-300">{immunities.join(', ')}</span></p>}
              {block.senses && <p><span className="text-slate-500">Senses:</span> <span className="text-slate-300">{block.senses}</span></p>}
              {block.languages && <p><span className="text-slate-500">Languages:</span> <span className="text-slate-300">{block.languages}</span></p>}
            </div>
          )}
          {traits.length > 0 && (
            <div className="space-y-2">
              {traits.map((t, i) => <div key={i} className="text-xs"><strong className="text-slate-300">{t.name}.</strong> <span className="text-slate-400">{t.description}</span></div>)}
            </div>
          )}
          {actions.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-t border-slate-800 pt-2">Actions</h3>
              <div className="space-y-2">
                {actions.map((a, i) => (
                  <div key={i} className="text-xs">
                    <strong className="text-slate-300">{a.name}.</strong>
                    {a.attackBonus !== undefined && <span className="text-emerald-400 ml-1">{fmtMod(a.attackBonus)} to hit</span>}
                    {a.damage && <span className="text-amber-400 ml-1">({a.damage} {a.damageType})</span>}
                    {a.description && <span className="text-slate-400 ml-1">{a.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {reactions.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-t border-slate-800 pt-2">Reactions</h3>
              {reactions.map((r, i) => <div key={i} className="text-xs"><strong className="text-slate-300">{r.name}.</strong> <span className="text-slate-400">{r.description}</span></div>)}
            </div>
          )}
          {legendaryActions.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-t border-slate-800 pt-2">Legendary Actions</h3>
              {legendaryActions.map((la, i) => <div key={i} className="text-xs"><strong className="text-slate-300">{la.name}.</strong> <span className="text-slate-400">{la.description}</span></div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Combatant Card ───────────────────────────────────────────────────────────

function CombatantCard({ combatant, isActive, onUpdate, onRemove, slug }: {
  combatant: Combatant; isActive: boolean
  onUpdate: (id: number, patch: Partial<Combatant>) => void
  onRemove: (id: number) => void
  slug: string
}) {
  const [dmgInput, setDmgInput] = useState('')
  const [healInput, setHealInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [statBlock, setStatBlock] = useState<StatBlock | null>(null)
  const [loadingBlock, setLoadingBlock] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDead = combatant.currentHP <= 0

  const applyDamage = (rawInput: string) => {
    const val = parseInt(rawInput)
    if (isNaN(val) || val <= 0) return
    let newHP = combatant.currentHP
    let newTemp = combatant.tempHP
    if (newTemp > 0) {
      const absorbed = Math.min(newTemp, val)
      newTemp -= absorbed
      newHP = Math.max(0, newHP - (val - absorbed))
    } else {
      newHP = Math.max(0, newHP - val)
    }
    onUpdate(combatant.id, { currentHP: newHP, tempHP: newTemp })
    setDmgInput('')
  }

  const applyHeal = (rawInput: string) => {
    const val = parseInt(rawInput)
    if (isNaN(val) || val <= 0) return
    onUpdate(combatant.id, { currentHP: Math.min(combatant.maxHP, combatant.currentHP + val) })
    setHealInput('')
  }

  const loadStatBlock = async () => {
    if (statBlock || loadingBlock) { setExpanded(v => !v); return }
    setLoadingBlock(true)
    setExpanded(true)
    const url = combatant.srdCreatureId
      ? `/api/srd/creatures/${combatant.srdCreatureId}`
      : combatant.campaignCreatureId
        ? `/api/campaign-creatures/${combatant.campaignCreatureId}`
        : null
    if (url) {
      const res = await fetch(url)
      if (res.ok) setStatBlock(await res.json())
    }
    setLoadingBlock(false)
  }

  const typeIcon = combatant.type === 'pc' ? '👤' : combatant.type === 'npc' ? '🧑' : '💀'
  const hasSrc = combatant.srdCreatureId || combatant.campaignCreatureId

  return (
    <>
      {statBlock && expanded && <StatBlockModal block={statBlock} onClose={() => setExpanded(false)} />}
      <div className={`rounded-xl border transition-all ${isActive ? 'border-emerald-500/60 bg-emerald-500/5 shadow-[0_0_12px_0_rgba(16,185,129,0.1)]' : isDead ? 'border-slate-700/30 bg-slate-900/20 opacity-50' : 'border-slate-700/40 bg-slate-800/30'}`}>
        <div className="p-3 space-y-2">
          {/* Row 1: initiative | name | AC | turn indicator | stat block btn | remove */}
          <div className="flex items-center gap-2">
            {isActive && <span className="text-emerald-400 text-sm shrink-0">▶</span>}
            <input type="number" value={combatant.initiative}
              onChange={e => onUpdate(combatant.id, { initiative: Number(e.target.value) })}
              className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-center text-slate-300 font-mono focus:outline-none shrink-0"
              title="Initiative" />
            <span className="text-sm shrink-0">{typeIcon}</span>
            <span className={`text-sm font-semibold flex-1 truncate ${isDead ? 'line-through text-slate-600' : 'text-slate-100'}`}>
              {combatant.name}
            </span>
            <span className="text-xs text-slate-500 shrink-0">AC <strong className="text-slate-300">{combatant.AC}</strong></span>
            {hasSrc && (
              <button onClick={loadStatBlock} title="View stat block"
                className="text-[10px] px-1.5 py-0.5 border border-slate-700 rounded text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors shrink-0">
                {loadingBlock ? '…' : 'Stats'}
              </button>
            )}
            <button onClick={() => onRemove(combatant.id)}
              className="text-slate-700 hover:text-red-400 text-sm transition-colors shrink-0 leading-none">×</button>
          </div>

          {/* HP bar */}
          <HPBar current={combatant.currentHP} max={combatant.maxHP} temp={combatant.tempHP} />

          {/* Row 2: HP readout + damage/heal controls */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold tabular-nums ${isDead ? 'text-red-400' : combatant.currentHP / combatant.maxHP < 0.25 ? 'text-red-400' : combatant.currentHP / combatant.maxHP < 0.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {combatant.currentHP}/{combatant.maxHP}
            </span>
            {combatant.tempHP > 0 && (
              <span className="text-xs text-cyan-400 font-medium">+{combatant.tempHP} tmp</span>
            )}
            <div className="flex-1" />
            {/* Quick -1/-5/-10 */}
            {[-1,-5,-10].map(v => (
              <button key={v} onClick={() => onUpdate(combatant.id, { currentHP: Math.max(0, combatant.currentHP + v) })}
                className="text-[10px] px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded hover:bg-red-500/20 transition-colors tabular-nums font-mono">
                {v}
              </button>
            ))}
            <input ref={inputRef} type="number" min={0} placeholder="dmg"
              value={dmgInput} onChange={e => setDmgInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyDamage(dmgInput) }}
              className="w-14 bg-red-500/5 border border-red-500/20 rounded px-1 py-0.5 text-xs text-center text-red-300 focus:outline-none focus:ring-1 focus:ring-red-500/40" />
            <button onClick={() => applyDamage(dmgInput)}
              className="text-xs px-2 py-0.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded transition-colors font-medium">
              Hit
            </button>
            {[1,5,10].map(v => (
              <button key={v} onClick={() => onUpdate(combatant.id, { currentHP: Math.min(combatant.maxHP, combatant.currentHP + v) })}
                className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/20 transition-colors tabular-nums font-mono">
                +{v}
              </button>
            ))}
            <input type="number" min={0} placeholder="heal"
              value={healInput} onChange={e => setHealInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyHeal(healInput) }}
              className="w-14 bg-emerald-500/5 border border-emerald-500/20 rounded px-1 py-0.5 text-xs text-center text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
            <button onClick={() => applyHeal(healInput)}
              className="text-xs px-2 py-0.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded transition-colors font-medium">
              Heal
            </button>
          </div>

          {/* Temp HP + inspiration (inline) */}
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1 text-slate-500">
              <span>Tmp:</span>
              <input type="number" min={0} value={combatant.tempHP}
                onChange={e => onUpdate(combatant.id, { tempHP: Number(e.target.value) })}
                className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-center text-cyan-300 focus:outline-none" />
            </label>
            {combatant.type === 'pc' && (
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={combatant.inspiration}
                  onChange={e => onUpdate(combatant.id, { inspiration: e.target.checked })}
                  className="accent-amber-400" />
                <span className="text-amber-300 font-medium">Insp.</span>
              </label>
            )}
            {combatant.type === 'pc' && combatant.currentHP === 0 && (
              <DeathSaveTracker
                successes={combatant.deathSaveSuccesses}
                failures={combatant.deathSaveFailures}
                onChange={(s, f) => onUpdate(combatant.id, { deathSaveSuccesses: s, deathSaveFailures: f })}
              />
            )}
            <div className="ml-auto">
              <input value={combatant.notes} placeholder="notes…"
                onChange={e => onUpdate(combatant.id, { notes: e.target.value })}
                className="bg-transparent border-b border-slate-700/40 text-xs text-slate-500 focus:outline-none focus:border-slate-500 w-32" />
            </div>
          </div>

          {/* Conditions */}
          <ConditionPicker
            active={combatant.conditions}
            onChange={c => onUpdate(combatant.id, { conditions: c })}
          />

          {/* Spell slots (PC only) */}
          {combatant.type === 'pc' && (
            <SpellSlotRow
              slots={combatant.spellSlots}
              onChange={s => onUpdate(combatant.id, { spellSlots: s })}
            />
          )}
        </div>
      </div>
    </>
  )
}

// ─── Add Combatant Form ───────────────────────────────────────────────────────

function AddCombatantForm({ onAdd }: { onAdd: (data: Partial<Combatant>) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'pc' | 'monster' | 'npc'>('monster')
  const [hp, setHp] = useState('')
  const [ac, setAc] = useState('')
  const [init, setInit] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), type, maxHP: parseInt(hp) || 10, currentHP: parseInt(hp) || 10, AC: parseInt(ac) || 10, initiative: parseInt(init) || 0 })
    setName(''); setHp(''); setAc(''); setInit('')
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-1">
        {(['pc','monster','npc'] as const).map(t => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition-colors ${type === t ? 'bg-slate-700 text-slate-200' : 'text-slate-600 hover:text-slate-400'}`}>
            {t}
          </button>
        ))}
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Name *"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
      <div className="grid grid-cols-3 gap-1.5">
        <input value={hp} onChange={e => setHp(e.target.value)} placeholder="HP" type="number"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 text-center focus:outline-none" />
        <input value={ac} onChange={e => setAc(e.target.value)} placeholder="AC" type="number"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 text-center focus:outline-none" />
        <input value={init} onChange={e => setInit(e.target.value)} placeholder="Init" type="number"
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 text-center focus:outline-none" />
      </div>
      <button type="submit" disabled={!name.trim()}
        className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
        Add to Track
      </button>
    </form>
  )
}

// ─── Encounter Loader Modal ───────────────────────────────────────────────────

function EncounterLoader({ slug, onLoad, onClose }: { slug: string; onLoad: (enc: Encounter) => void; onClose: () => void }) {
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/encounters?projectSlug=${slug}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setEncounters(d); setLoading(false) })
  }, [slug])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Load Encounter</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? <p className="text-sm text-slate-500 text-center py-4">Loading…</p> : encounters.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-4">No encounters in this campaign.</p>
          ) : encounters.map(enc => (
            <button key={enc.id} onClick={() => { onLoad(enc); onClose() }}
              className="w-full text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/40 rounded-xl p-3 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-200">{enc.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  enc.difficulty === 'deadly' ? 'bg-red-500/20 text-red-400' :
                  enc.difficulty === 'hard' ? 'bg-orange-500/20 text-orange-400' :
                  enc.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>{enc.difficulty}</span>
              </div>
              {enc.creatures.length > 0 && (
                <p className="text-xs text-slate-500">
                  {enc.creatures.map(c => {
                    const name = c.srdCreature?.name ?? c.campaignCreature?.name ?? 'Unknown'
                    return c.quantity > 1 ? `${c.quantity}× ${name}` : name
                  }).join(', ')}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main DM Screen ───────────────────────────────────────────────────────────

export default function RunPage() {
  const params = useParams()
  const slug = params.projectSlug as string

  const [session, setSession] = useState<Session | null>(null)
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [loading, setLoading] = useState(true)
  const [showEncounterLoader, setShowEncounterLoader] = useState(false)
  const [sessionNameEdit, setSessionNameEdit] = useState(false)
  const [sessionNameVal, setSessionNameVal] = useState('')
  const [markPlaytestedId, setMarkPlaytestedId] = useState<number | null>(null)
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // Load current session
  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}/live-session`)
    if (res.ok) {
      const data = await res.json()
      if (data) {
        setSession(data)
        setCombatants((data.combatants as Record<string, unknown>[]).map(parseCombatant))
      }
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { loadSession() }, [loadSession])

  // Sorted combatants (by sortOrder, then initiative desc)
  const sorted = [...combatants].sort((a, b) => a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : b.initiative - a.initiative)
  const activeId = session && sorted[session.activeIndex]?.id

  // Start new session
  const startSession = async () => {
    const res = await fetch(`/api/projects/${slug}/live-session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Combat' }),
    })
    if (res.ok) {
      const data = await res.json()
      setSession(data); setCombatants([])
    }
  }

  // End session
  const endSession = async () => {
    if (markPlaytestedId) {
      await fetch(`/api/encounters/${markPlaytestedId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPlaytested: true, playtestedAt: new Date().toISOString() }),
      })
    }
    await fetch(`/api/projects/${slug}/live-session`, { method: 'DELETE' })
    setSession(null); setCombatants([])
  }

  // Advance turn
  const nextTurn = useCallback(async () => {
    if (!session) return
    const nextIndex = (session.activeIndex + 1) % Math.max(1, sorted.length)
    const newRound = nextIndex === 0 ? session.roundNumber + 1 : session.roundNumber
    const updated = { ...session, activeIndex: nextIndex, roundNumber: newRound }
    setSession(updated)
    await fetch(`/api/projects/${slug}/live-session`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeIndex: nextIndex, roundNumber: newRound }),
    })
  }, [session, sorted.length, slug])

  const prevTurn = useCallback(async () => {
    if (!session) return
    const len = Math.max(1, sorted.length)
    const prevIndex = (session.activeIndex - 1 + len) % len
    const newRound = session.activeIndex === 0 && session.roundNumber > 1 ? session.roundNumber - 1 : session.roundNumber
    const updated = { ...session, activeIndex: prevIndex, roundNumber: newRound }
    setSession(updated)
    await fetch(`/api/projects/${slug}/live-session`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeIndex: prevIndex, roundNumber: newRound }),
    })
  }, [session, sorted.length, slug])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!session) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'n' || e.key === 'ArrowRight') nextTurn()
      if (e.key === 'p' || e.key === 'ArrowLeft') prevTurn()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [session, nextTurn, prevTurn])

  // Sort by initiative
  const sortByInitiative = () => {
    const bySorted = [...combatants].sort((a, b) => b.initiative - a.initiative)
    const reordered = bySorted.map((c, i) => ({ ...c, sortOrder: i }))
    setCombatants(reordered)
    reordered.forEach(c => {
      fetch(`/api/projects/${slug}/live-session/combatants/${c.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: c.sortOrder }),
      })
    })
    setSession(s => s ? { ...s, activeIndex: 0 } : s)
  }

  // Roll initiative for all monsters
  const rollAllInitiative = () => {
    const updated = combatants.map(c => {
      if (c.type === 'pc') return c
      const dexMod = 0 // We don't store DEX mod for combatants; roll flat d20
      const newInit = rollDie(20) + dexMod
      return { ...c, initiative: newInit }
    })
    setCombatants(updated)
    updated.forEach(c => {
      if (c.type !== 'pc') {
        fetch(`/api/projects/${slug}/live-session/combatants/${c.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initiative: c.initiative }),
        })
      }
    })
  }

  // Add combatant
  const addCombatant = async (data: Partial<Combatant>) => {
    const res = await fetch(`/api/projects/${slug}/live-session/combatants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const newC = parseCombatant(await res.json())
      setCombatants(prev => [...prev, newC])
    }
  }

  // Update combatant — optimistic, debounced API save
  const updateCombatant = (id: number, patch: Partial<Combatant>) => {
    setCombatants(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id])
    saveTimers.current[id] = setTimeout(() => {
      const body: Record<string, unknown> = { ...patch }
      if (patch.conditions) body.conditions = JSON.stringify(patch.conditions)
      if (patch.spellSlots) body.spellSlots = JSON.stringify(patch.spellSlots)
      fetch(`/api/projects/${slug}/live-session/combatants/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }, 500)
  }

  // Remove combatant
  const removeCombatant = async (id: number) => {
    setCombatants(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/projects/${slug}/live-session/combatants/${id}`, { method: 'DELETE' })
  }

  // Load encounter into initiative track
  const loadEncounter = async (enc: Encounter) => {
    setMarkPlaytestedId(enc.id)
    for (const ec of enc.creatures) {
      const src = ec.srdCreature ?? ec.campaignCreature
      const name = src?.name ?? 'Creature'
      const maxHP = src?.HPAverage ?? 10
      const AC = src?.AC ?? 10
      for (let i = 0; i < (ec.quantity ?? 1); i++) {
        const suffix = (ec.quantity ?? 1) > 1 ? ` ${i + 1}` : ''
        await addCombatant({
          name: name + suffix,
          type: 'monster',
          maxHP,
          currentHP: maxHP,
          AC,
          srdCreatureId: ec.srdCreatureId ?? undefined,
          campaignCreatureId: ec.campaignCreatureId ?? undefined,
        })
      }
    }
  }

  // Load party as PCs
  const loadParty = async () => {
    const res = await fetch(`/api/projects/${slug}/party`)
    if (!res.ok) return
    const members: PartyMemberSheet[] = await res.json()
    for (const m of members) {
      if (m.role !== 'player' || !m.characterSheet) continue
      const sheet = m.characterSheet
      const slots = parseJson<Record<string, SpellSlot>>(sheet.spellSlots, {})
      await addCombatant({
        name: sheet.characterName || m.username,
        type: 'pc',
        maxHP: sheet.maxHP,
        currentHP: sheet.currentHP,
        AC: sheet.AC,
        spellSlots: slots,
        inspiration: sheet.inspiration,
        characterSheetId: sheet.id,
      })
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-slate-950"><p className="text-slate-500 text-sm">Loading…</p></div>
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 gap-6 px-8 text-center">
        <div className="text-5xl">🎯</div>
        <div>
          <h1 className="text-xl font-bold text-slate-200 mb-2">DM Screen</h1>
          <p className="text-sm text-slate-500 max-w-sm">
            Start a live session to track initiative, HP, conditions, and spell slots for your whole table.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={startSession}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors">
            Start Session
          </button>
        </div>
        <p className="text-xs text-slate-600">Keyboard shortcuts: N / → = next turn, P / ← = previous turn</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden">
      {showEncounterLoader && <EncounterLoader slug={slug} onLoad={loadEncounter} onClose={() => setShowEncounterLoader(false)} />}

      {/* Header */}
      <div className="px-4 h-14 border-b border-slate-800/60 shrink-0 flex items-center gap-3">
        {sessionNameEdit ? (
          <input autoFocus value={sessionNameVal}
            onChange={e => setSessionNameVal(e.target.value)}
            onBlur={async () => {
              setSessionNameEdit(false)
              if (sessionNameVal.trim()) {
                setSession(s => s ? { ...s, name: sessionNameVal } : s)
                await fetch(`/api/projects/${slug}/live-session`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: sessionNameVal }),
                })
              }
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="bg-transparent text-slate-200 text-sm font-semibold focus:outline-none border-b border-emerald-500 w-40" />
        ) : (
          <button onClick={() => { setSessionNameVal(session.name); setSessionNameEdit(true) }}
            className="text-sm font-semibold text-slate-200 hover:text-emerald-300 transition-colors">
            {session.name}
          </button>
        )}

        <div className="h-5 w-px bg-slate-800" />
        <span className="text-xs text-slate-500">Round <strong className="text-slate-300 text-sm">{session.roundNumber}</strong></span>
        {sorted.length > 0 && <span className="text-xs text-slate-600">{session.activeIndex + 1}/{sorted.length}</span>}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={prevTurn} title="Previous turn (P / ←)"
            className="w-8 h-8 flex items-center justify-center border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors text-base">◀</button>
          <button onClick={nextTurn} title="Next turn (N / →)"
            className="px-4 h-8 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors">
            Next Turn ▶
          </button>
          <button onClick={sortByInitiative}
            className="h-8 px-3 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
            Sort Init
          </button>
          <button onClick={rollAllInitiative}
            className="h-8 px-3 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
            Roll Monsters
          </button>
          <button onClick={() => setShowEncounterLoader(true)}
            className="h-8 px-3 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
            Load Enc.
          </button>
          <button onClick={loadParty}
            className="h-8 px-3 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors">
            Load Party
          </button>
          <button onClick={endSession}
            className="h-8 px-3 border border-red-500/30 bg-red-500/5 rounded-lg text-xs text-red-400 hover:bg-red-500/15 transition-colors">
            End Session
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Initiative Track */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-0">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
              <p className="text-sm text-slate-600">Initiative track is empty.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowEncounterLoader(true)}
                  className="px-4 py-2 border border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-medium rounded-lg transition-colors">
                  Load Encounter
                </button>
                <button onClick={loadParty}
                  className="px-4 py-2 border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 text-xs font-medium rounded-lg transition-colors">
                  Load Party
                </button>
              </div>
            </div>
          ) : sorted.map((c) => (
            <CombatantCard key={c.id} combatant={c} isActive={c.id === activeId}
              onUpdate={updateCombatant} onRemove={removeCombatant} slug={slug} />
          ))}
        </div>

        {/* Right panel: dice + add */}
        <div className="w-72 border-l border-slate-800/60 flex flex-col shrink-0 overflow-y-auto">
          {/* Dice roller */}
          <div className="p-4 border-b border-slate-800/40">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Dice Roller</h3>
            <DiceRoller />
          </div>

          {/* Add combatant */}
          <div className="p-4 border-b border-slate-800/40">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Add Combatant</h3>
            <AddCombatantForm onAdd={addCombatant} />
          </div>

          {/* Session info */}
          <div className="p-4 text-xs text-slate-600 space-y-1">
            <p>N / → = Next turn</p>
            <p>P / ← = Previous turn</p>
            <p>Click Init # to edit manually</p>
            <p>Sort Init = sort by initiative</p>
            <p>Roll Monsters = randomise monster rolls</p>
          </div>

          {/* Mark playtested */}
          {markPlaytestedId && (
            <div className="p-4 border-t border-slate-800/40 mt-auto">
              <p className="text-[10px] text-slate-500 mb-2">Loaded from encounter</p>
              <button onClick={async () => {
                await fetch(`/api/encounters/${markPlaytestedId}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isPlaytested: true, playtestedAt: new Date().toISOString() }),
                })
                setMarkPlaytestedId(null)
              }}
                className="w-full py-1.5 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-500/10 transition-colors">
                ✓ Mark as Playtested
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
