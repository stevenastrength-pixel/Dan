'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

// ─── D&D helpers ──────────────────────────────────────────────────────────────

const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
type Ability = typeof ABILITY_NAMES[number]

const ABILITY_LABELS: Record<Ability, string> = {
  STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
  INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
}

const SKILL_LIST: { name: string; ability: Ability }[] = [
  { name: 'Acrobatics', ability: 'DEX' },
  { name: 'Animal Handling', ability: 'WIS' },
  { name: 'Arcana', ability: 'INT' },
  { name: 'Athletics', ability: 'STR' },
  { name: 'Deception', ability: 'CHA' },
  { name: 'History', ability: 'INT' },
  { name: 'Insight', ability: 'WIS' },
  { name: 'Intimidation', ability: 'CHA' },
  { name: 'Investigation', ability: 'INT' },
  { name: 'Medicine', ability: 'WIS' },
  { name: 'Nature', ability: 'INT' },
  { name: 'Perception', ability: 'WIS' },
  { name: 'Performance', ability: 'CHA' },
  { name: 'Persuasion', ability: 'CHA' },
  { name: 'Religion', ability: 'INT' },
  { name: 'Sleight of Hand', ability: 'DEX' },
  { name: 'Stealth', ability: 'DEX' },
  { name: 'Survival', ability: 'WIS' },
]

const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
]

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned',
]

const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function mod(score: number): number { return Math.floor((score - 10) / 2) }
function fmtMod(n: number): string { return n >= 0 ? `+${n}` : `${n}` }
function profBonusForLevel(level: number): number {
  return Math.ceil(level / 4) + 1
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attack { name: string; attackBonus: number; damage: string; damageType: string; range: string; notes: string }
interface InventoryItem { name: string; quantity: number; weight: number; notes: string; isEquipped: boolean }
interface Feature { name: string; source: string; description: string }
interface SkillProf { prof: boolean; expertise: boolean }
interface SpellSlot { max: number; used: number }

interface SheetData {
  id?: string
  characterName: string; className: string; subclass: string; race: string
  background: string; alignment: string; level: number; xp: number
  STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number
  maxHP: number; currentHP: number; tempHP: number
  AC: number; speed: number; proficiencyBonus: number; initiative: number; inspiration: boolean
  savingThrowProfs: Record<Ability, boolean>
  skillProfs: Record<string, SkillProf>
  deathSaveSuccesses: number; deathSaveFailures: number
  attacks: Attack[]
  spellSlots: Record<string, SpellSlot>
  spellsPrepared: string[]
  inventory: InventoryItem[]
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number }
  features: Feature[]
  personalityTraits: string; ideals: string; bonds: string; flaws: string; backstory: string
  conditions: string[]
}

function defaultSheet(): SheetData {
  return {
    characterName: '', className: '', subclass: '', race: '',
    background: '', alignment: '', level: 1, xp: 0,
    STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10,
    maxHP: 10, currentHP: 10, tempHP: 0,
    AC: 10, speed: 30, proficiencyBonus: 2, initiative: 0, inspiration: false,
    savingThrowProfs: { STR: false, DEX: false, CON: false, INT: false, WIS: false, CHA: false },
    skillProfs: {},
    deathSaveSuccesses: 0, deathSaveFailures: 0,
    attacks: [],
    spellSlots: {},
    spellsPrepared: [],
    inventory: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    features: [],
    personalityTraits: '', ideals: '', bonds: '', flaws: '', backstory: '',
    conditions: [],
  }
}

function parseSheet(raw: Record<string, unknown>): SheetData {
  const parse = <T,>(v: unknown, fallback: T): T => {
    if (typeof v === 'string') { try { return JSON.parse(v) as T } catch { return fallback } }
    if (v != null) return v as T
    return fallback
  }
  return {
    id: raw.id as string | undefined,
    characterName: String(raw.characterName ?? ''),
    className: String(raw.className ?? ''),
    subclass: String(raw.subclass ?? ''),
    race: String(raw.race ?? ''),
    background: String(raw.background ?? ''),
    alignment: String(raw.alignment ?? ''),
    level: Number(raw.level ?? 1),
    xp: Number(raw.xp ?? 0),
    STR: Number(raw.STR ?? 10), DEX: Number(raw.DEX ?? 10),
    CON: Number(raw.CON ?? 10), INT: Number(raw.INT ?? 10),
    WIS: Number(raw.WIS ?? 10), CHA: Number(raw.CHA ?? 10),
    maxHP: Number(raw.maxHP ?? 10), currentHP: Number(raw.currentHP ?? 10), tempHP: Number(raw.tempHP ?? 0),
    AC: Number(raw.AC ?? 10), speed: Number(raw.speed ?? 30),
    proficiencyBonus: Number(raw.proficiencyBonus ?? 2),
    initiative: Number(raw.initiative ?? 0), inspiration: Boolean(raw.inspiration),
    savingThrowProfs: parse(raw.savingThrowProfs, { STR: false, DEX: false, CON: false, INT: false, WIS: false, CHA: false }),
    skillProfs: parse(raw.skillProfs, {}),
    deathSaveSuccesses: Number(raw.deathSaveSuccesses ?? 0),
    deathSaveFailures: Number(raw.deathSaveFailures ?? 0),
    attacks: parse(raw.attacks, []),
    spellSlots: parse(raw.spellSlots, {}),
    spellsPrepared: parse(raw.spellsPrepared, []),
    inventory: parse(raw.inventory, []),
    currency: parse(raw.currency, { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
    features: parse(raw.features, []),
    personalityTraits: String(raw.personalityTraits ?? ''),
    ideals: String(raw.ideals ?? ''),
    bonds: String(raw.bonds ?? ''),
    flaws: String(raw.flaws ?? ''),
    backstory: String(raw.backstory ?? ''),
    conditions: parse(raw.conditions, []),
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, score, onChange }: { label: string; score: number; onChange: (v: number) => void }) {
  const m = mod(score)
  return (
    <div className="flex flex-col items-center gap-1 bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 min-w-[80px]">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <input
        type="number" min={1} max={30} value={score}
        onChange={e => onChange(Number(e.target.value))}
        className="w-14 text-center bg-slate-900 border border-slate-700 rounded-lg py-1 text-lg font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />
      <span className="text-base font-semibold text-emerald-400">{fmtMod(m)}</span>
    </div>
  )
}

function PipTrack({ count, max, onToggle }: { count: number; max: number; onToggle: (i: number) => void }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <button key={i} onClick={() => onToggle(i)}
          className={`w-4 h-4 rounded-full border transition-colors ${i < count ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-600'}`}
        />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CharacterSheetPage() {
  const params = useParams()
  const slug = params.projectSlug as string

  const [sheet, setSheet] = useState<SheetData>(defaultSheet())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'abilities' | 'combat' | 'spells' | 'equipment' | 'features'>('abilities')
  const [generateModal, setGenerateModal] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // Derived values
  const pb = profBonusForLevel(sheet.level)
  const abilityMod = (a: Ability) => mod(sheet[a])
  const saveBonus = (a: Ability) => abilityMod(a) + (sheet.savingThrowProfs[a] ? pb : 0)
  const skillBonus = (skill: string, ability: Ability) => {
    const sp = sheet.skillProfs[skill] ?? { prof: false, expertise: false }
    return abilityMod(ability) + (sp.expertise ? pb * 2 : sp.prof ? pb : 0)
  }
  const passivePerception = 10 + skillBonus('Perception', 'WIS')
  const initiativeDisplay = abilityMod('DEX') + sheet.initiative

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}/character-sheet`)
    if (res.ok) {
      const data = await res.json()
      if (data) setSheet(parseSheet(data))
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/projects/${slug}/character-sheet`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sheet, proficiencyBonus: pb }),
    })
    if (res.ok) {
      const data = await res.json()
      setSheet(parseSheet(data))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  const upd = <K extends keyof SheetData,>(key: K, value: SheetData[K]) =>
    setSheet(s => ({ ...s, [key]: value }))

  const generateCharacter = async () => {
    setGenerating(true)
    setGenerateError('')
    const res = await fetch(`/api/projects/${slug}/character-sheet/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: generatePrompt }),
    })
    const data = await res.json()
    if (!res.ok) {
      setGenerateError(data.error ?? 'Generation failed.')
      setGenerating(false)
      return
    }
    setSheet(s => ({ ...s, ...data }))
    setGenerateModal(false)
    setGeneratePrompt('')
    setGenerating(false)
  }

  const tabs = [
    { id: 'abilities' as const, label: 'Abilities' },
    { id: 'combat' as const, label: 'Combat & Skills' },
    { id: 'spells' as const, label: 'Spells' },
    { id: 'equipment' as const, label: 'Equipment' },
    { id: 'features' as const, label: 'Features' },
  ]

  if (loading) {
    return <div className="flex-1 flex items-center justify-center bg-slate-950"><p className="text-slate-500 text-sm">Loading…</p></div>
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden">

      {/* Auto-generate modal */}
      {generateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-sm font-semibold text-slate-200 mb-1">Auto-Generate Character</h2>
            <p className="text-xs text-slate-500 mb-4">
              Daneel will create a full character based on this campaign&apos;s setting and documents.
              Optionally describe what you&apos;re looking for — class, personality, concept, etc.
            </p>
            <textarea
              autoFocus
              value={generatePrompt}
              onChange={e => setGeneratePrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generateCharacter() }}
              placeholder="e.g. A sneaky halfling rogue with a dark past, or leave blank for a random character"
              rows={3}
              className="w-full resize-none bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 transition-colors"
            />
            {generateError && <p className="text-xs text-red-400 mt-2">{generateError}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={generateCharacter} disabled={generating}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors">
                {generating ? 'Generating…' : '✦ Generate'}
              </button>
              <button onClick={() => { setGenerateModal(false); setGenerateError('') }}
                className="px-4 py-2 border border-slate-700 text-slate-400 hover:text-slate-200 text-sm rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 h-16 border-b border-slate-800/60 shrink-0 flex items-center gap-4">
        <h1 className="text-sm font-semibold text-slate-200">Character Sheet</h1>
        <span className="text-xs text-slate-600">—</span>
        <input
          value={sheet.characterName}
          onChange={e => upd('characterName', e.target.value)}
          placeholder="Character Name"
          className="bg-transparent text-slate-200 text-sm font-medium focus:outline-none placeholder:text-slate-600 w-48"
        />
        <div className="ml-auto flex items-center gap-3">
          <span className={`text-xs transition-colors ${saved ? 'text-emerald-400' : 'text-slate-600'}`}>
            {saved ? 'Saved' : ''}
          </span>
          <button onClick={() => { setGenerateModal(true); setGenerateError('') }}
            className="px-4 py-1.5 border border-violet-500/40 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 text-xs font-medium rounded-lg transition-colors">
            ✦ Auto-Generate
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
            {saving ? 'Saving…' : 'Save Sheet'}
          </button>
        </div>
      </div>

      {/* Identity row */}
      <div className="px-6 py-3 border-b border-slate-800/40 shrink-0 flex flex-wrap gap-3">
        {[
          { label: 'Class', key: 'className' as const, placeholder: 'Fighter' },
          { label: 'Subclass', key: 'subclass' as const, placeholder: 'Champion' },
          { label: 'Race', key: 'race' as const, placeholder: 'Human' },
          { label: 'Background', key: 'background' as const, placeholder: 'Soldier' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
            <input value={sheet[key]} onChange={e => upd(key, e.target.value)} placeholder={placeholder}
              className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs text-slate-200 w-28 focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
          </div>
        ))}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Alignment</span>
          <select value={sheet.alignment} onChange={e => upd('alignment', e.target.value)}
            className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs text-slate-200 w-36 focus:outline-none">
            <option value="">— select —</option>
            {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Level</span>
          <input type="number" min={1} max={20} value={sheet.level}
            onChange={e => upd('level', Number(e.target.value))}
            className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs text-slate-200 w-16 text-center focus:outline-none" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">XP</span>
          <input type="number" min={0} value={sheet.xp}
            onChange={e => upd('xp', Number(e.target.value))}
            className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs text-slate-200 w-20 focus:outline-none" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Prof Bonus</span>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-xs text-emerald-400 font-semibold w-16 text-center">
            {fmtMod(pb)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-slate-800/40 shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === t.id
                ? 'text-emerald-300 border-emerald-500'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Abilities & Saves ── */}
        {activeTab === 'abilities' && (
          <div className="space-y-8 max-w-3xl">
            {/* Ability scores */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Ability Scores</h2>
              <div className="flex flex-wrap gap-3">
                {ABILITY_NAMES.map(a => (
                  <StatBox key={a} label={a} score={sheet[a]} onChange={v => upd(a, v)} />
                ))}
              </div>
            </div>

            {/* Saving Throws */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Saving Throws</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ABILITY_NAMES.map(a => {
                  const bonus = saveBonus(a)
                  const prof = sheet.savingThrowProfs[a]
                  return (
                    <label key={a} className="flex items-center gap-2 bg-slate-800/40 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-800/60">
                      <input type="checkbox" checked={prof}
                        onChange={e => upd('savingThrowProfs', { ...sheet.savingThrowProfs, [a]: e.target.checked })}
                        className="accent-emerald-500" />
                      <span className="text-xs text-slate-400 flex-1">{ABILITY_LABELS[a]}</span>
                      <span className="text-xs font-semibold text-emerald-400 tabular-nums">{fmtMod(bonus)}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Death Saves */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Death Saves</h2>
              <div className="flex gap-8">
                <div className="space-y-1.5">
                  <span className="text-xs text-emerald-400 font-medium">Successes</span>
                  <PipTrack count={sheet.deathSaveSuccesses} max={3}
                    onToggle={i => upd('deathSaveSuccesses', i < sheet.deathSaveSuccesses ? i : i + 1)} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-red-400 font-medium">Failures</span>
                  <PipTrack count={sheet.deathSaveFailures} max={3}
                    onToggle={i => upd('deathSaveFailures', i < sheet.deathSaveFailures ? i : i + 1)} />
                </div>
              </div>
            </div>

            {/* Passive Perception */}
            <div className="flex items-center gap-4">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Passive Perception</span>
                <span className="text-2xl font-bold text-slate-100">{passivePerception}</span>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Initiative</span>
                <span className="text-2xl font-bold text-slate-100">{fmtMod(initiativeDisplay)}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Initiative Bonus</span>
                <input type="number" value={sheet.initiative}
                  onChange={e => upd('initiative', Number(e.target.value))}
                  className="w-20 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-sm text-center text-slate-200 focus:outline-none"
                  placeholder="+0" />
              </div>
            </div>
          </div>
        )}

        {/* ── Combat & Skills ── */}
        {activeTab === 'combat' && (
          <div className="space-y-8 max-w-3xl">
            {/* HP row */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Hit Points</h2>
              <div className="flex flex-wrap gap-4 items-end">
                {[
                  { label: 'Max HP', key: 'maxHP' as const },
                  { label: 'Current HP', key: 'currentHP' as const },
                  { label: 'Temp HP', key: 'tempHP' as const },
                ].map(({ label, key }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                    <input type="number" min={0} value={sheet[key]}
                      onChange={e => upd(key, Number(e.target.value))}
                      className="w-20 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-2 text-base font-bold text-center text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">AC</span>
                  <input type="number" min={0} value={sheet.AC}
                    onChange={e => upd('AC', Number(e.target.value))}
                    className="w-16 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-2 text-base font-bold text-center text-slate-100 focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Speed</span>
                  <input type="number" min={0} value={sheet.speed}
                    onChange={e => upd('speed', Number(e.target.value))}
                    className="w-20 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-2 text-base font-bold text-center text-slate-100 focus:outline-none" />
                </div>
                <label className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={sheet.inspiration}
                    onChange={e => upd('inspiration', e.target.checked)}
                    className="accent-amber-400" />
                  <span className="text-xs text-amber-300 font-medium">Inspiration</span>
                </label>
              </div>
            </div>

            {/* Conditions */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Conditions</h2>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map(c => {
                  const active = sheet.conditions.includes(c)
                  return (
                    <button key={c} onClick={() => upd('conditions', active ? sheet.conditions.filter(x => x !== c) : [...sheet.conditions, c])}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                        active ? 'bg-red-500/20 border-red-500/50 text-red-300' : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300'
                      }`}>
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Skills */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Skills</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SKILL_LIST.map(({ name, ability }) => {
                  const sp = sheet.skillProfs[name] ?? { prof: false, expertise: false }
                  const bonus = skillBonus(name, ability)
                  return (
                    <div key={name} className="flex items-center gap-2 bg-slate-800/30 rounded-lg px-3 py-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={sp.prof}
                          onChange={e => upd('skillProfs', { ...sheet.skillProfs, [name]: { ...sp, prof: e.target.checked } })}
                          className="accent-emerald-500" />
                        <span className="text-[9px] font-bold text-slate-600 uppercase w-4">E</span>
                        <input type="checkbox" checked={sp.expertise}
                          onChange={e => upd('skillProfs', { ...sheet.skillProfs, [name]: { ...sp, expertise: e.target.checked } })}
                          className="accent-purple-500"
                          title="Expertise" />
                      </label>
                      <span className="text-xs text-slate-300 flex-1">{name}</span>
                      <span className="text-[10px] text-slate-600">{ability}</span>
                      <span className="text-xs font-semibold text-emerald-400 tabular-nums w-8 text-right">{fmtMod(bonus)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Spells ── */}
        {activeTab === 'spells' && (
          <div className="space-y-8 max-w-3xl">
            {/* Attacks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attacks</h2>
                <button onClick={() => upd('attacks', [...sheet.attacks, { name: '', attackBonus: 0, damage: '', damageType: '', range: '', notes: '' }])}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">+ Add</button>
              </div>
              <div className="space-y-2">
                {sheet.attacks.map((atk, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 bg-slate-800/40 rounded-lg p-3">
                    <input value={atk.name} placeholder="Name"
                      onChange={e => upd('attacks', sheet.attacks.map((a, j) => j === i ? { ...a, name: e.target.value } : a))}
                      className="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none" />
                    <input value={atk.attackBonus} type="number" placeholder="+5"
                      onChange={e => upd('attacks', sheet.attacks.map((a, j) => j === i ? { ...a, attackBonus: Number(e.target.value) } : a))}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none" />
                    <input value={atk.damage} placeholder="2d6+3"
                      onChange={e => upd('attacks', sheet.attacks.map((a, j) => j === i ? { ...a, damage: e.target.value } : a))}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none" />
                    <input value={atk.damageType} placeholder="Slashing"
                      onChange={e => upd('attacks', sheet.attacks.map((a, j) => j === i ? { ...a, damageType: e.target.value } : a))}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none" />
                    <button onClick={() => upd('attacks', sheet.attacks.filter((_, j) => j !== i))}
                      className="text-slate-600 hover:text-red-400 text-sm transition-colors">×</button>
                  </div>
                ))}
                {sheet.attacks.length === 0 && <p className="text-xs text-slate-600 italic">No attacks yet.</p>}
              </div>
            </div>

            {/* Spell Slots */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Spell Slots</h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {SPELL_SLOT_LEVELS.map(lvl => {
                  const slot = sheet.spellSlots[String(lvl)] ?? { max: 0, used: 0 }
                  return (
                    <div key={lvl} className="bg-slate-800/40 rounded-lg p-3 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Level {lvl}</span>
                      <div className="flex gap-1 justify-center mb-2">
                        <input type="number" min={0} max={9} value={slot.used}
                          onChange={e => upd('spellSlots', { ...sheet.spellSlots, [lvl]: { ...slot, used: Number(e.target.value) } })}
                          className="w-8 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-center text-slate-200 focus:outline-none" />
                        <span className="text-slate-600 text-xs">/</span>
                        <input type="number" min={0} max={9} value={slot.max}
                          onChange={e => upd('spellSlots', { ...sheet.spellSlots, [lvl]: { ...slot, max: Number(e.target.value) } })}
                          className="w-8 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-center text-slate-200 focus:outline-none" />
                      </div>
                      <span className="text-[10px] text-slate-600">used / max</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Spells Prepared */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spells Prepared</h2>
                <button onClick={() => {
                  const name = prompt('Spell name?')
                  if (name?.trim()) upd('spellsPrepared', [...sheet.spellsPrepared, name.trim()])
                }} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">+ Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {sheet.spellsPrepared.map((s, i) => (
                  <span key={i} className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs px-2.5 py-1 rounded-full">
                    {s}
                    <button onClick={() => upd('spellsPrepared', sheet.spellsPrepared.filter((_, j) => j !== i))}
                      className="text-violet-500 hover:text-red-400 leading-none">×</button>
                  </span>
                ))}
                {sheet.spellsPrepared.length === 0 && <p className="text-xs text-slate-600 italic">No spells prepared.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Equipment ── */}
        {activeTab === 'equipment' && (
          <div className="space-y-8 max-w-3xl">
            {/* Currency */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Currency</h2>
              <div className="flex flex-wrap gap-3">
                {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map(coin => (
                  <div key={coin} className="flex flex-col gap-1 items-center">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      coin === 'gp' ? 'text-amber-400' : coin === 'pp' ? 'text-purple-400' : coin === 'ep' ? 'text-cyan-400' : 'text-slate-500'
                    }`}>{coin}</span>
                    <input type="number" min={0} value={sheet.currency[coin]}
                      onChange={e => upd('currency', { ...sheet.currency, [coin]: Number(e.target.value) })}
                      className="w-20 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-2 text-sm font-bold text-center text-slate-100 focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* Inventory */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory</h2>
                <button onClick={() => upd('inventory', [...sheet.inventory, { name: '', quantity: 1, weight: 0, notes: '', isEquipped: false }])}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">+ Add Item</button>
              </div>
              <div className="space-y-2">
                {sheet.inventory.map((item, i) => (
                  <div key={i} className={`grid grid-cols-6 gap-2 rounded-lg p-3 border transition-colors ${item.isEquipped ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/40 border-transparent'}`}>
                    <input value={item.name} placeholder="Item name"
                      onChange={e => upd('inventory', sheet.inventory.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      className="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none" />
                    <input value={item.quantity} type="number" min={0} placeholder="Qty"
                      onChange={e => upd('inventory', sheet.inventory.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-slate-200 focus:outline-none" />
                    <input value={item.notes} placeholder="Notes"
                      onChange={e => upd('inventory', sheet.inventory.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))}
                      className="col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none" />
                    <div className="flex items-center justify-end gap-2">
                      <label className="flex items-center gap-1 cursor-pointer" title="Equipped">
                        <input type="checkbox" checked={item.isEquipped}
                          onChange={e => upd('inventory', sheet.inventory.map((x, j) => j === i ? { ...x, isEquipped: e.target.checked } : x))}
                          className="accent-emerald-500" />
                        <span className="text-[10px] text-slate-600">Eq.</span>
                      </label>
                      <button onClick={() => upd('inventory', sheet.inventory.filter((_, j) => j !== i))}
                        className="text-slate-600 hover:text-red-400 text-sm transition-colors">×</button>
                    </div>
                  </div>
                ))}
                {sheet.inventory.length === 0 && <p className="text-xs text-slate-600 italic">No items.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Features & Background ── */}
        {activeTab === 'features' && (
          <div className="space-y-8 max-w-3xl">
            {/* Features */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Features & Traits</h2>
                <button onClick={() => upd('features', [...sheet.features, { name: '', source: '', description: '' }])}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">+ Add</button>
              </div>
              <div className="space-y-3">
                {sheet.features.map((f, i) => (
                  <div key={i} className="bg-slate-800/40 rounded-lg p-4 space-y-2">
                    <div className="flex gap-2">
                      <input value={f.name} placeholder="Feature name"
                        onChange={e => upd('features', sheet.features.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-medium text-slate-200 focus:outline-none" />
                      <input value={f.source} placeholder="Source (class, race…)"
                        onChange={e => upd('features', sheet.features.map((x, j) => j === i ? { ...x, source: e.target.value } : x))}
                        className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-400 focus:outline-none" />
                      <button onClick={() => upd('features', sheet.features.filter((_, j) => j !== i))}
                        className="text-slate-600 hover:text-red-400 text-sm transition-colors">×</button>
                    </div>
                    <textarea value={f.description} placeholder="Description…" rows={2}
                      onChange={e => upd('features', sheet.features.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 resize-none focus:outline-none" />
                  </div>
                ))}
                {sheet.features.length === 0 && <p className="text-xs text-slate-600 italic">No features added.</p>}
              </div>
            </div>

            {/* Personality */}
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Personality</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Personality Traits', key: 'personalityTraits' as const },
                  { label: 'Ideals', key: 'ideals' as const },
                  { label: 'Bonds', key: 'bonds' as const },
                  { label: 'Flaws', key: 'flaws' as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{label}</label>
                    <textarea value={sheet[key]} rows={3} onChange={e => upd(key, e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-300 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
                  </div>
                ))}
              </div>
            </div>

            {/* Backstory */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Backstory</label>
              <textarea value={sheet.backstory} rows={6} onChange={e => upd('backstory', e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-300 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                placeholder="Write your character's backstory…" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
