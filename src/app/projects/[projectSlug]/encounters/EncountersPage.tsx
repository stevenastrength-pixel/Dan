'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SrdCreature = {
  id: number; name: string; CR: string; AC: number; HPAverage: number
  creatureType: string; size: string
}

type FullCampaignCreature = {
  id: number; name: string; size: string; creatureType: string; alignment: string
  CR: string; xpValue: number; AC: number; acType: string; HPDice: string; HPAverage: number
  speed: string; STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number
  savingThrows: string; skills: string; damageResistances: string; damageImmunities: string
  damageVulnerabilities: string; conditionImmunities: string; senses: string; languages: string
  legendaryResistances: number; isLegendary: boolean; hasLairActions: boolean
  traits: string; actions: string; bonusActions: string; reactions: string
  legendaryActions: string; lairActions: string
}

type FullSrdCreature = FullCampaignCreature

type EncounterCreature = {
  id: number; quantity: number; notes: string
  srdCreatureId: number | null; campaignCreatureId: number | null
  srdCreature?: SrdCreature | null
  campaignCreature?: { id: number; name: string; CR: string; AC: number; HPAverage: number; xpValue: number } | null
}

type Encounter = {
  id: number; name: string; encounterType: string; difficulty: string
  summary: string; readAloud: string; tactics: string; dmNotes: string; rewardText: string; status: string
  creatures: EncounterCreature[]
}

type ActionEntry = { name: string; desc: string }

type CreatureFormData = {
  name: string; size: string; creatureType: string; alignment: string
  CR: string; xpValue: number; AC: number; acType: string; HPDice: string; HPAverage: number
  speed: string; STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number
  savingThrows: string; skills: string; damageResistances: string; damageImmunities: string
  damageVulnerabilities: string; conditionImmunities: string; senses: string; languages: string
  legendaryResistances: number; isLegendary: boolean; hasLairActions: boolean
  traits: ActionEntry[]; actions: ActionEntry[]; bonusActions: ActionEntry[]
  reactions: ActionEntry[]; legendaryActions: ActionEntry[]; lairActions: ActionEntry[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  combat: 'bg-red-500/20 text-red-400 border-red-500/30',
  social: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  exploration: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  trap: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hazard: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}
const DIFFICULTY_COLORS: Record<string, string> = {
  trivial: 'text-slate-400', easy: 'text-emerald-400', medium: 'text-amber-400',
  hard: 'text-orange-400', deadly: 'text-red-400',
}
const DIFFICULTY_PILL: Record<string, string> = {
  trivial: 'bg-slate-700/60 text-slate-300 border-slate-600',
  easy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  hard: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  deadly: 'bg-red-500/20 text-red-300 border-red-500/30',
}
const TYPE_ORDER = ['combat', 'social', 'exploration', 'trap', 'hazard']
const CR_ORDER = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','30']
const SIZE_OPTIONS = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

const ENC_BLANK = { name: '', encounterType: 'combat', difficulty: 'medium', summary: '', readAloud: '', tactics: '', dmNotes: '', rewardText: '' }

const XP_TABLE: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100,
  '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400,
  '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '30': 155000,
}

// XP thresholds per character per level: [easy, medium, hard, deadly]
const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400],
  4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
}

const xpFromCR = (cr: string) => XP_TABLE[cr] ?? 0
const xpMult = (n: number) => n <= 1 ? 1 : n === 2 ? 1.5 : n <= 6 ? 2 : n <= 10 ? 2.5 : n <= 14 ? 3 : 4
const modOf = (s: number) => Math.floor((s - 10) / 2)
const signedMod = (s: number) => { const m = modOf(s); return m >= 0 ? `+${m}` : `${m}` }

const CREATURE_BLANK: CreatureFormData = {
  name: '', size: 'Medium', creatureType: 'humanoid', alignment: 'neutral',
  CR: '1', xpValue: 200, AC: 12, acType: '', HPDice: '2d8+2', HPAverage: 11,
  speed: '30 ft.', STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10,
  savingThrows: '', skills: '', damageResistances: '', damageImmunities: '',
  damageVulnerabilities: '', conditionImmunities: '',
  senses: 'passive Perception 10', languages: 'Common',
  legendaryResistances: 0, isLegendary: false, hasLairActions: false,
  traits: [], actions: [{ name: '', desc: '' }], bonusActions: [], reactions: [],
  legendaryActions: [], lairActions: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSpeed(s: string): string {
  try {
    const p = JSON.parse(s)
    if (typeof p === 'string') return p
    if (typeof p === 'object' && p !== null) {
      return Object.entries(p as Record<string, number>)
        .map(([k, v]) => k === 'walk' ? `${v} ft.` : `${k} ${v} ft.`)
        .join(', ')
    }
  } catch { /* */ }
  return s
}

function parseActions(s: string): ActionEntry[] {
  try {
    const p = JSON.parse(s)
    if (Array.isArray(p)) return p.map((x: { name?: string; desc?: string }) => ({ name: x.name ?? '', desc: x.desc ?? '' }))
  } catch { /* */ }
  return []
}

function parseStringArr(s: string): string {
  try {
    const p = JSON.parse(s)
    if (Array.isArray(p)) return p.join(', ')
  } catch { /* */ }
  return s
}

function creatureToForm(c: FullCampaignCreature): CreatureFormData {
  return {
    name: c.name, size: c.size, creatureType: c.creatureType, alignment: c.alignment,
    CR: c.CR, xpValue: c.xpValue, AC: c.AC, acType: c.acType, HPDice: c.HPDice, HPAverage: c.HPAverage,
    speed: parseSpeed(c.speed),
    STR: c.STR, DEX: c.DEX, CON: c.CON, INT: c.INT, WIS: c.WIS, CHA: c.CHA,
    savingThrows: parseStringArr(c.savingThrows), skills: parseStringArr(c.skills),
    damageResistances: parseStringArr(c.damageResistances), damageImmunities: parseStringArr(c.damageImmunities),
    damageVulnerabilities: parseStringArr(c.damageVulnerabilities), conditionImmunities: parseStringArr(c.conditionImmunities),
    senses: c.senses, languages: c.languages,
    legendaryResistances: c.legendaryResistances, isLegendary: c.isLegendary, hasLairActions: c.hasLairActions,
    traits: parseActions(c.traits), actions: parseActions(c.actions),
    bonusActions: parseActions(c.bonusActions), reactions: parseActions(c.reactions),
    legendaryActions: parseActions(c.legendaryActions), lairActions: parseActions(c.lairActions),
  }
}

function formToPayload(f: CreatureFormData): Record<string, unknown> {
  const toArr = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
  return {
    name: f.name, size: f.size, creatureType: f.creatureType, alignment: f.alignment,
    CR: f.CR, xpValue: f.xpValue, AC: f.AC, acType: f.acType, HPDice: f.HPDice, HPAverage: f.HPAverage,
    speed: f.speed,
    STR: f.STR, DEX: f.DEX, CON: f.CON, INT: f.INT, WIS: f.WIS, CHA: f.CHA,
    savingThrows: toArr(f.savingThrows), skills: toArr(f.skills),
    damageResistances: toArr(f.damageResistances), damageImmunities: toArr(f.damageImmunities),
    damageVulnerabilities: toArr(f.damageVulnerabilities), conditionImmunities: toArr(f.conditionImmunities),
    senses: f.senses, languages: f.languages,
    legendaryResistances: f.legendaryResistances, isLegendary: f.isLegendary, hasLairActions: f.hasLairActions,
    traits: f.traits, actions: f.actions, bonusActions: f.bonusActions, reactions: f.reactions,
    legendaryActions: f.legendaryActions, lairActions: f.lairActions,
  }
}

// ─── Action list editor ───────────────────────────────────────────────────────

function ActionList({ label, value, onChange }: {
  label: string; value: ActionEntry[]; onChange: (v: ActionEntry[]) => void
}) {
  const add = () => onChange([...value, { name: '', desc: '' }])
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const update = (i: number, k: keyof ActionEntry, v: string) =>
    onChange(value.map((e, idx) => idx === i ? { ...e, [k]: v } : e))

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-400">{label}</label>
        <button type="button" onClick={add} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add</button>
      </div>
      {value.length === 0
        ? <div className="text-xs text-slate-600 italic py-1">None — click + Add</div>
        : (
          <div className="space-y-2">
            {value.map((entry, i) => (
              <div key={i} className="p-2 rounded bg-slate-800 border border-slate-700/60 space-y-1.5">
                <div className="flex gap-2 items-center">
                  <input value={entry.name} onChange={e => update(i, 'name', e.target.value)}
                    placeholder="Name…"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                  <button type="button" onClick={() => remove(i)} className="text-slate-600 hover:text-red-400 text-xs shrink-0 transition-colors">✕</button>
                </div>
                <textarea value={entry.desc} onChange={e => update(i, 'desc', e.target.value)}
                  placeholder="Full description…" rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

// ─── Creature (stat block) form ───────────────────────────────────────────────

function CreatureForm({ initial, projectSlug, onSave, onClose, onDelete }: {
  initial: CreatureFormData & { id?: number }
  projectSlug: string
  onSave: (creature: FullCampaignCreature) => void
  onClose: () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState<CreatureFormData>({ ...CREATURE_BLANK, ...initial })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof CreatureFormData>(k: K, v: CreatureFormData[K]) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = formToPayload(form)
    const res = initial.id
      ? await fetch(`/api/campaign-creatures/${initial.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/campaign-creatures', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, projectSlug }),
        })
    if (res.ok) onSave(await res.json())
    setSaving(false)
    onClose()
  }

  const numInput = (label: string, k: keyof CreatureFormData, opts?: { min?: number; max?: number; className?: string }) => (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <input type="number" value={form[k] as number} min={opts?.min} max={opts?.max}
        onChange={e => set(k, (parseInt(e.target.value) || 0) as never)}
        className={`w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 ${opts?.className ?? ''}`} />
    </div>
  )

  const textInput = (label: string, k: keyof CreatureFormData, placeholder?: string) => (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <input type="text" value={form[k] as string}
        onChange={e => set(k, e.target.value as never)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
    </div>
  )

  const statBlock = (label: string, k: keyof CreatureFormData) => (
    <div className="text-center">
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <input type="number" value={form[k] as number}
        onChange={e => set(k, (parseInt(e.target.value) || 10) as never)}
        className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1.5 text-sm text-slate-200 text-center focus:outline-none focus:border-indigo-500" />
      <div className="text-xs text-slate-500 mt-0.5">{signedMod(form[k] as number)}</div>
    </div>
  )

  const divider = (title: string) => (
    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2 pb-1 border-t border-slate-800 mt-1">{title}</div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="w-full max-w-2xl h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h2 className="font-semibold text-slate-100">{initial.id ? 'Edit Homebrew Creature' : 'New Homebrew Creature'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {divider('Identity')}
          {textInput('Name *', 'name', 'Corrupted Dwarven Guardian')}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Size</label>
              <select value={form.size} onChange={e => set('size', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {textInput('Type', 'creatureType', 'humanoid, undead, construct…')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {textInput('Alignment', 'alignment', 'neutral evil')}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">CR</label>
              <select value={form.CR} onChange={e => {
                const cr = e.target.value
                set('CR', cr)
                set('xpValue', xpFromCR(cr))
              }} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {CR_ORDER.map(cr => <option key={cr} value={cr}>{cr}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 shrink-0">XP value:</label>
            <input type="number" value={form.xpValue} onChange={e => set('xpValue', parseInt(e.target.value) || 0)}
              className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
            <span className="text-xs text-slate-600">auto-set from CR, override if needed</span>
          </div>

          {divider('Defense')}
          <div className="grid grid-cols-2 gap-3">
            {numInput('AC', 'AC', { min: 0 })}
            {textInput('AC type', 'acType', 'natural armor, chain mail…')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {textInput('HP Dice', 'HPDice', '5d8+10')}
            {numInput('HP Average', 'HPAverage', { min: 1 })}
          </div>
          {textInput('Speed', 'speed', '30 ft., fly 60 ft.')}

          {divider('Ability Scores')}
          <div className="grid grid-cols-6 gap-2">
            {statBlock('STR', 'STR')}
            {statBlock('DEX', 'DEX')}
            {statBlock('CON', 'CON')}
            {statBlock('INT', 'INT')}
            {statBlock('WIS', 'WIS')}
            {statBlock('CHA', 'CHA')}
          </div>

          {divider('Proficiencies')}
          {textInput('Saving Throws', 'savingThrows', 'STR, CON (comma-separated)')}
          <div className="mt-1">{textInput('Skills', 'skills', 'Athletics +5, Perception +3 (comma-separated)')}</div>

          {divider('Resistances & Immunities')}
          {textInput('Damage Resistances', 'damageResistances', 'fire, cold, bludgeoning')}
          <div className="mt-1">{textInput('Damage Immunities', 'damageImmunities', 'poison, necrotic')}</div>
          <div className="mt-1">{textInput('Damage Vulnerabilities', 'damageVulnerabilities', 'radiant')}</div>
          <div className="mt-1">{textInput('Condition Immunities', 'conditionImmunities', 'frightened, charmed')}</div>

          {divider('Senses & Languages')}
          {textInput('Senses', 'senses', 'darkvision 60 ft., passive Perception 12')}
          <div className="mt-1">{textInput('Languages', 'languages', 'Common, Dwarvish')}</div>

          {divider('Legendary')}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isLegendary} onChange={e => set('isLegendary', e.target.checked)}
                className="rounded border-slate-600 bg-slate-800" />
              <span className="text-sm text-slate-300">Legendary creature</span>
            </label>
            {form.isLegendary && (
              <div className="flex items-center gap-3 pl-5">
                <label className="text-xs text-slate-400">Legendary Resistances:</label>
                <input type="number" value={form.legendaryResistances} min={0} max={5}
                  onChange={e => set('legendaryResistances', parseInt(e.target.value) || 0)}
                  className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 text-center focus:outline-none focus:border-indigo-500" />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.hasLairActions} onChange={e => set('hasLairActions', e.target.checked)}
                className="rounded border-slate-600 bg-slate-800" />
              <span className="text-sm text-slate-300">Has lair actions</span>
            </label>
          </div>

          {divider('Abilities')}
          <div className="space-y-5">
            <ActionList label="Traits" value={form.traits} onChange={v => set('traits', v)} />
            <ActionList label="Actions" value={form.actions} onChange={v => set('actions', v)} />
            <ActionList label="Bonus Actions" value={form.bonusActions} onChange={v => set('bonusActions', v)} />
            <ActionList label="Reactions" value={form.reactions} onChange={v => set('reactions', v)} />
            {form.isLegendary && (
              <ActionList label="Legendary Actions" value={form.legendaryActions} onChange={v => set('legendaryActions', v)} />
            )}
            {form.hasLairActions && (
              <ActionList label="Lair Actions" value={form.lairActions} onChange={v => set('lairActions', v)} />
            )}
          </div>

        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          {onDelete ? (confirmDelete ? (
            <div className="flex gap-2">
              <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white">Confirm delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 rounded text-slate-400 hover:text-slate-200">Cancel</button>
            </div>
          ) : <button onClick={() => setConfirmDelete(true)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Delete creature</button>) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-slate-200">Cancel</button>
            <button onClick={save} disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium">
              {saving ? 'Saving…' : 'Save Creature'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Encounter form ───────────────────────────────────────────────────────────

function EncounterForm({ initial, onSave, onClose, onDelete }: {
  initial: typeof ENC_BLANK & { id?: number }
  onSave: (data: typeof ENC_BLANK) => Promise<void>
  onClose: () => void
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...ENC_BLANK, ...initial })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k: keyof typeof ENC_BLANK, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true); await onSave(form); setSaving(false); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-100">{initial.id ? 'Edit Encounter' : 'New Encounter'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Goblin Ambush on the East Road"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
              <select value={form.encounterType} onChange={e => set('encounterType', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {TYPE_ORDER.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Difficulty</label>
              <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                {['trivial', 'easy', 'medium', 'hard', 'deadly'].map(d => <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Summary</label>
            <textarea value={form.summary} onChange={e => set('summary', e.target.value)} rows={2} placeholder="What is this encounter about?"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Read Aloud <span className="text-slate-600 font-normal">(optional)</span></label>
            <textarea value={form.readAloud} onChange={e => set('readAloud', e.target.value)} rows={3} placeholder="Boxed text read to players…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Tactics <span className="text-slate-600 font-normal">(optional)</span></label>
            <textarea value={form.tactics} onChange={e => set('tactics', e.target.value)} rows={3} placeholder="How enemies behave, morale breaks, goals…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">DM Notes <span className="text-slate-600 font-normal">(optional)</span></label>
            <textarea value={form.dmNotes} onChange={e => set('dmNotes', e.target.value)} rows={2} placeholder="Variants, adjustments, context…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Reward <span className="text-slate-600 font-normal">(optional)</span></label>
            <input value={form.rewardText} onChange={e => set('rewardText', e.target.value)} placeholder="Treasure, XP notes, story reward…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          {onDelete ? (confirmDelete ? (
            <div className="flex gap-2">
              <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white">Confirm delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 rounded text-slate-400 hover:text-slate-200">Cancel</button>
            </div>
          ) : <button onClick={() => setConfirmDelete(true)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">Delete encounter</button>) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm text-slate-400 hover:text-slate-200">Cancel</button>
            <button onClick={save} disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Difficulty calculator ────────────────────────────────────────────────────

function DifficultyCalc({ enc, partySize, partyLevel }: {
  enc: Encounter; partySize: number; partyLevel: number
}) {
  const rawXP = enc.creatures.reduce((sum, c) => {
    const xp = c.campaignCreature?.xpValue ?? xpFromCR(c.srdCreature?.CR ?? c.campaignCreature?.CR ?? '0')
    return sum + xp * c.quantity
  }, 0)
  const monsterCount = enc.creatures.reduce((s, c) => s + c.quantity, 0)
  const mult = xpMult(monsterCount)
  const adjXP = Math.floor(rawXP * mult)

  const level = Math.min(Math.max(partyLevel, 1), 20)
  const per = XP_THRESHOLDS[level]
  const [easy, medium, hard, deadly] = per.map(t => t * partySize)

  const tier = adjXP < easy ? 'trivial' : adjXP < medium ? 'easy' : adjXP < hard ? 'medium' : adjXP < deadly ? 'hard' : 'deadly'

  const tiers: { label: string; tier: string }[] = [
    { label: 'Trivial', tier: 'trivial' },
    { label: 'Easy', tier: 'easy' },
    { label: 'Medium', tier: 'medium' },
    { label: 'Hard', tier: 'hard' },
    { label: 'Deadly', tier: 'deadly' },
  ]

  return (
    <div className="mb-6 p-4 rounded-lg bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Difficulty Calculator</div>
        <div className="text-xs text-slate-500">{partySize} players · Level {partyLevel}</div>
      </div>
      <div className="flex gap-1 mb-3">
        {tiers.map(t => (
          <div key={t.tier} className={`flex-1 text-center py-1.5 rounded text-xs font-medium border transition-colors ${
            tier === t.tier ? DIFFICULTY_PILL[t.tier] : 'bg-slate-800/50 text-slate-600 border-slate-700/50'
          }`}>
            {t.label}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="text-slate-500">Raw XP: <span className="text-slate-300">{rawXP.toLocaleString()}</span></span>
        {mult > 1 && (
          <span className="text-slate-500">×{mult} ({monsterCount} monsters) = <span className="text-slate-300">{adjXP.toLocaleString()} adjusted</span></span>
        )}
        <span className="text-slate-600">
          Easy ≥{easy.toLocaleString()} · Med ≥{medium.toLocaleString()} · Hard ≥{hard.toLocaleString()} · Deadly ≥{deadly.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

// ─── Add creature panel ───────────────────────────────────────────────────────

function AddCreaturePanel({ encounterId, projectSlug, onAdd, onClose }: {
  encounterId: number; projectSlug: string
  onAdd: (creature: EncounterCreature) => void; onClose: () => void
}) {
  const [tab, setTab] = useState<'srd' | 'homebrew'>('srd')

  // SRD state
  const [query, setQuery] = useState('')
  const [crMax, setCrMax] = useState('')
  const [srdResults, setSrdResults] = useState<SrdCreature[]>([])
  const [searching, setSearching] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState<string | null>(null) // `srd-${id}` or `camp-${id}`

  // Homebrew state
  const [homebrewList, setHomebrewList] = useState<FullCampaignCreature[]>([])
  const [homebrewLoading, setHomebrewLoading] = useState(false)
  const [homebrewQuery, setHomebrewQuery] = useState('')
  const [creatureForm, setCreatureForm] = useState<(CreatureFormData & { id?: number }) | 'new' | null>(null)

  // Load SRD on search changes
  const searchSrd = useCallback(async () => {
    setSearching(true)
    const params = new URLSearchParams()
    if (query.trim()) params.set('name', query.trim())
    if (crMax) params.set('crMax', crMax)
    const res = await fetch(`/api/srd/creatures?${params}`)
    if (res.ok) setSrdResults(await res.json())
    setSearching(false)
  }, [query, crMax])

  useEffect(() => {
    if (tab !== 'srd') return
    const t = setTimeout(searchSrd, 300)
    return () => clearTimeout(t)
  }, [searchSrd, tab])

  // Load homebrew creatures when tab switches
  useEffect(() => {
    if (tab !== 'homebrew') return
    setHomebrewLoading(true)
    fetch(`/api/campaign-creatures?projectSlug=${projectSlug}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setHomebrewList(data); setHomebrewLoading(false) })
  }, [tab, projectSlug])

  const filteredHomebrew = homebrewQuery.trim()
    ? homebrewList.filter(c => c.name.toLowerCase().includes(homebrewQuery.toLowerCase()))
    : homebrewList

  const addSrd = async (creature: SrdCreature) => {
    setAdding(`srd-${creature.id}`)
    const res = await fetch(`/api/encounters/${encounterId}/creatures`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ srdCreatureId: creature.id, quantity, notes }),
    })
    if (res.ok) {
      const ec = await res.json()
      onAdd({ ...ec, srdCreature: creature })
    }
    setAdding(null)
  }

  const addHomebrew = async (creature: FullCampaignCreature) => {
    setAdding(`camp-${creature.id}`)
    const res = await fetch(`/api/encounters/${encounterId}/creatures`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignCreatureId: creature.id, quantity, notes }),
    })
    if (res.ok) {
      const ec = await res.json()
      onAdd({ ...ec, campaignCreature: { id: creature.id, name: creature.name, CR: creature.CR, AC: creature.AC, HPAverage: creature.HPAverage, xpValue: creature.xpValue } })
    }
    setAdding(null)
  }

  const deleteCreature = async (id: number) => {
    await fetch(`/api/campaign-creatures/${id}`, { method: 'DELETE' })
    setHomebrewList(prev => prev.filter(c => c.id !== id))
    setCreatureForm(null)
  }

  const onCreatureSaved = (saved: FullCampaignCreature) => {
    setHomebrewList(prev => {
      const idx = prev.findIndex(c => c.id === saved.id)
      return idx >= 0 ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved]
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-100">Add Creature</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800">
          {(['srd', 'homebrew'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'text-slate-100 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}>
              {t === 'srd' ? 'SRD Library' : 'Homebrew'}
            </button>
          ))}
        </div>

        {/* Shared qty/notes bar */}
        <div className="px-5 py-3 border-b border-slate-800 flex gap-2 items-center">
          <label className="text-xs text-slate-500 shrink-0">Qty</label>
          <input type="number" value={quantity} min={1} max={20} onChange={e => setQuantity(parseInt(e.target.value) || 1)}
            className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 text-center focus:outline-none focus:border-indigo-500" />
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (variant, special role)…"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
        </div>

        {tab === 'srd' && (
          <>
            <div className="px-5 py-3 border-b border-slate-800 space-y-2">
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or type…"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
              <div className="flex gap-2 items-center">
                <label className="text-xs text-slate-500 shrink-0">Max CR</label>
                <select value={crMax} onChange={e => setCrMax(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500">
                  <option value="">any</option>
                  {CR_ORDER.map(cr => <option key={cr} value={cr}>{cr}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {searching ? <div className="p-4 text-slate-500 text-sm">Searching…</div>
                : srdResults.length === 0 ? <div className="p-4 text-slate-600 text-sm">No results.</div>
                : srdResults.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30">
                    <div>
                      <div className="text-sm text-slate-200 font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500">CR {c.CR} · {c.size} {c.creatureType} · AC {c.AC}, {c.HPAverage} HP</div>
                    </div>
                    <button onClick={() => addSrd(c)} disabled={adding === `srd-${c.id}`}
                      className="shrink-0 text-xs px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors">
                      {adding === `srd-${c.id}` ? '…' : `Add ×${quantity}`}
                    </button>
                  </div>
                ))}
            </div>
          </>
        )}

        {tab === 'homebrew' && (
          <>
            <div className="px-5 py-3 border-b border-slate-800 flex gap-2">
              <input value={homebrewQuery} onChange={e => setHomebrewQuery(e.target.value)} placeholder="Filter by name…"
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
              <button onClick={() => setCreatureForm('new')}
                className="shrink-0 text-xs px-2.5 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
                + New
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {homebrewLoading ? <div className="p-4 text-slate-500 text-sm">Loading…</div>
                : filteredHomebrew.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-slate-500 text-sm">{homebrewList.length === 0 ? 'No homebrew creatures yet.' : 'No matches.'}</p>
                    {homebrewList.length === 0 && (
                      <button onClick={() => setCreatureForm('new')} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">Create your first →</button>
                    )}
                  </div>
                ) : filteredHomebrew.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 group">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-200 font-medium truncate">{c.name}</div>
                      <div className="text-xs text-slate-500">CR {c.CR} · {c.size} {c.creatureType} · AC {c.AC}, {c.HPAverage} HP</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button onClick={() => setCreatureForm({ ...creatureToForm(c), id: c.id })}
                        className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all">
                        Edit
                      </button>
                      <button onClick={() => addHomebrew(c)} disabled={adding === `camp-${c.id}`}
                        className="text-xs px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors">
                        {adding === `camp-${c.id}` ? '…' : `Add ×${quantity}`}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      {/* Creature form slides in above the panel */}
      {creatureForm && (
        <CreatureForm
          initial={(creatureForm as unknown) === 'new' ? CREATURE_BLANK : (creatureForm as CreatureFormData & { id: number })}
          projectSlug={projectSlug}
          onSave={onCreatureSaved}
          onClose={() => setCreatureForm(null)}
          onDelete={(creatureForm as unknown) !== 'new' ? async () => { await deleteCreature((creatureForm as CreatureFormData & { id: number }).id) } : undefined}
        />
      )}
    </div>
  )
}

// ─── Stat block panel ────────────────────────────────────────────────────────

function StatBlockPanel({ creature, onEdit, onClose }: {
  creature: FullCampaignCreature | FullSrdCreature
  onEdit?: () => void
  onClose: () => void
}) {
  const f = creatureToForm(creature)

  const section = (title: string) => (
    <h4 className="text-xs font-black uppercase tracking-wider text-amber-300/80 border-b border-amber-900/40 pb-1 mb-2 mt-4">{title}</h4>
  )

  const actionList = (entries: ActionEntry[]) => entries.length > 0 ? (
    <div className="space-y-2.5">
      {entries.map((a, i) => (
        <p key={i} className="text-sm text-slate-300 leading-relaxed">
          {a.name && <><span className="font-bold italic text-slate-100">{a.name}.</span>{' '}</>}
          {a.desc}
        </p>
      ))}
    </div>
  ) : null

  const prop = (label: string, value: string | number | undefined) =>
    value ? (
      <p className="text-sm text-slate-300 leading-relaxed">
        <span className="font-semibold text-slate-100">{label}</span> {value}
      </p>
    ) : null

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-slate-950 border-l border-slate-700 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-amber-900/40 bg-slate-900 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-amber-100">{creature.name}</h2>
              <p className="text-sm text-slate-400 italic mt-0.5">
                {creature.size} {creature.creatureType}{creature.alignment ? `, ${creature.alignment}` : ''}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {onEdit && <button onClick={onEdit} className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors">Edit</button>}
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Core stats */}
          <div className="space-y-1 pb-3 border-b border-amber-900/30">
            {prop('Armor Class', `${creature.AC}${creature.acType ? ` (${creature.acType})` : ''}`)}
            {prop('Hit Points', `${creature.HPAverage} (${creature.HPDice})`)}
            {prop('Speed', f.speed)}
          </div>

          {/* Ability scores */}
          <div className="grid grid-cols-6 gap-2 text-center py-3 border-b border-amber-900/30">
            {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map(s => (
              <div key={s}>
                <div className="text-[10px] font-bold text-amber-300/70 uppercase tracking-wider">{s}</div>
                <div className="text-sm text-slate-100 font-bold">{creature[s]}</div>
                <div className="text-xs text-slate-500">({signedMod(creature[s])})</div>
              </div>
            ))}
          </div>

          {/* Properties */}
          <div className="space-y-1 py-3 border-b border-amber-900/30">
            {prop('Saving Throws', f.savingThrows)}
            {prop('Skills', f.skills)}
            {prop('Damage Resistances', f.damageResistances)}
            {prop('Damage Immunities', f.damageImmunities)}
            {prop('Damage Vulnerabilities', f.damageVulnerabilities)}
            {prop('Condition Immunities', f.conditionImmunities)}
            {prop('Senses', creature.senses)}
            {prop('Languages', creature.languages)}
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-slate-100">Challenge</span>{' '}
              {creature.CR} ({creature.xpValue.toLocaleString()} XP)
              {creature.isLegendary && creature.legendaryResistances > 0 && (
                <span className="text-slate-500"> · Legendary Resistances {creature.legendaryResistances}/Day</span>
              )}
            </p>
          </div>

          {/* Traits */}
          {f.traits.length > 0 && (
            <div className="pt-3">
              {actionList(f.traits)}
            </div>
          )}

          {/* Actions */}
          {f.actions.length > 0 && (
            <div>{section('Actions')}{actionList(f.actions)}</div>
          )}

          {/* Bonus Actions */}
          {f.bonusActions.length > 0 && (
            <div>{section('Bonus Actions')}{actionList(f.bonusActions)}</div>
          )}

          {/* Reactions */}
          {f.reactions.length > 0 && (
            <div>{section('Reactions')}{actionList(f.reactions)}</div>
          )}

          {/* Legendary Actions */}
          {creature.isLegendary && f.legendaryActions.length > 0 && (
            <div>{section('Legendary Actions')}{actionList(f.legendaryActions)}</div>
          )}

          {/* Lair Actions */}
          {creature.hasLairActions && f.lairActions.length > 0 && (
            <div>{section('Lair Actions')}{actionList(f.lairActions)}</div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EncountersPage({ project }: {
  project: { name: string; slug: string; partySize?: number; minLevel?: number; maxLevel?: number }
}) {
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Encounter | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [encForm, setEncForm] = useState<(typeof ENC_BLANK & { id?: number }) | 'new' | null>(null)
  const [addingCreature, setAddingCreature] = useState(false)
  const [viewingCreature, setViewingCreature] = useState<FullCampaignCreature | null>(null)
  const [viewingSrdCreature, setViewingSrdCreature] = useState<FullSrdCreature | null>(null)
  const [editingCreature, setEditingCreature] = useState<(CreatureFormData & { id: number }) | null>(null)

  const partySize = project.partySize && project.partySize > 0 ? project.partySize : undefined
  const partyLevel = project.minLevel && project.maxLevel
    ? Math.floor((project.minLevel + project.maxLevel) / 2)
    : project.minLevel ?? undefined

  const load = useCallback(async () => {
    const res = await fetch(`/api/encounters?projectSlug=${project.slug}`)
    if (res.ok) setEncounters(await res.json())
    setLoading(false)
  }, [project.slug])

  useEffect(() => { load() }, [load])

  const saveEncounter = async (data: typeof ENC_BLANK) => {
    if ((encForm as unknown) === 'new') {
      const res = await fetch('/api/encounters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectSlug: project.slug }),
      })
      if (res.ok) {
        const enc = await res.json()
        const full = { ...enc, creatures: [] }
        setEncounters(prev => [...prev, full])
        setSelected(full)
      }
    } else if (encForm && (encForm as unknown) !== 'new') {
      const res = await fetch(`/api/encounters/${(encForm as Encounter).id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        const full = { ...updated, creatures: (encForm as Encounter).creatures ?? [] }
        setEncounters(prev => prev.map(e => e.id === full.id ? full : e))
        if (selected?.id === full.id) setSelected(full)
      }
    }
  }

  const deleteEncounter = async () => {
    if (!encForm || (encForm as unknown) === 'new') return
    await fetch(`/api/encounters/${(encForm as Encounter).id}`, { method: 'DELETE' })
    setEncounters(prev => prev.filter(e => e.id !== (encForm as Encounter).id))
    if (selected?.id === (encForm as Encounter).id) setSelected(null)
    setEncForm(null)
  }

  const removeCreature = async (ec: EncounterCreature) => {
    if (!selected) return
    await fetch(`/api/encounters/${selected.id}/creatures?entryId=${ec.id}`, { method: 'DELETE' })
    const updated = { ...selected, creatures: selected.creatures.filter(c => c.id !== ec.id) }
    setEncounters(prev => prev.map(e => e.id === updated.id ? updated : e))
    setSelected(updated)
  }

  const onCreatureAdded = (ec: EncounterCreature) => {
    if (!selected) return
    const updated = { ...selected, creatures: [...selected.creatures, ec] }
    setEncounters(prev => prev.map(e => e.id === updated.id ? updated : e))
    setSelected(updated)
  }

  const loadStatBlock = async (id: number) => {
    const res = await fetch(`/api/campaign-creatures/${id}`)
    if (res.ok) setViewingCreature(await res.json())
  }

  const loadSrdStatBlock = async (id: number) => {
    const res = await fetch(`/api/srd/creatures/${id}`)
    if (res.ok) setViewingSrdCreature(await res.json())
  }

  const onStatBlockCreatureSaved = (saved: FullCampaignCreature) => {
    // Update any encounter creature rows referencing this creature
    const patch = (enc: Encounter): Encounter => ({
      ...enc,
      creatures: enc.creatures.map(c =>
        c.campaignCreatureId === saved.id
          ? { ...c, campaignCreature: { id: saved.id, name: saved.name, CR: saved.CR, AC: saved.AC, HPAverage: saved.HPAverage, xpValue: saved.xpValue } }
          : c
      ),
    })
    setEncounters(prev => prev.map(patch))
    setSelected(prev => prev ? patch(prev) : prev)
  }

  const totalXP = (enc: Encounter) => enc.creatures.reduce((sum, c) => {
    const xp = c.campaignCreature?.xpValue ?? xpFromCR(c.srdCreature?.CR ?? c.campaignCreature?.CR ?? '0')
    return sum + xp * c.quantity
  }, 0)

  const filtered = typeFilter === 'all' ? encounters : encounters.filter(e => e.encounterType === typeFilter)
  const grouped = TYPE_ORDER.reduce<Record<string, Encounter[]>>((acc, type) => {
    const items = filtered.filter(e => e.encounterType === type)
    if (items.length > 0) acc[type] = items
    return acc
  }, {})

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Left list */}
      <div className="flex flex-col w-80 border-r border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Encounters</h1>
            <p className="text-xs text-slate-500 mt-0.5">{project.name}</p>
          </div>
          <button onClick={() => setEncForm('new')}
            className="text-xs px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
            + New
          </button>
        </div>
        <div className="flex gap-1 p-2 border-b border-slate-800 flex-wrap">
          {['all', ...TYPE_ORDER].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2 py-0.5 rounded text-xs font-medium capitalize transition-colors ${typeFilter === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-4 text-slate-500 text-sm">Loading…</div>
            : Object.keys(grouped).length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-slate-500 text-sm">No encounters yet.</p>
                <button onClick={() => setEncForm('new')} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">Create your first encounter →</button>
              </div>
            ) : Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-950 capitalize">{type}</div>
                {items.map(enc => (
                  <button key={enc.id} onClick={() => setSelected(enc)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${selected?.id === enc.id ? 'bg-slate-800/50 border-l-2 border-l-indigo-500' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-slate-200 font-medium leading-snug">{enc.name}</span>
                      <span className={`text-xs font-medium capitalize shrink-0 ${DIFFICULTY_COLORS[enc.difficulty] ?? 'text-slate-400'}`}>{enc.difficulty}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${TYPE_COLORS[enc.encounterType] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>{enc.encounterType}</span>
                      {enc.creatures.length > 0 && (
                        <span className="text-xs text-slate-500">{enc.creatures.reduce((s, c) => s + c.quantity, 0)} creature{enc.creatures.reduce((s, c) => s + c.quantity, 0) !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {enc.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{enc.summary}</p>}
                  </button>
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="max-w-3xl mx-auto p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded border capitalize ${TYPE_COLORS[selected.encounterType] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>{selected.encounterType}</span>
                  <span className={`text-xs font-semibold capitalize ${DIFFICULTY_COLORS[selected.difficulty] ?? 'text-slate-400'}`}>{selected.difficulty}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-100">{selected.name}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selected.creatures.length > 0 && (
                  <div className="text-right mr-1">
                    <div className="text-2xl font-bold text-amber-400">{totalXP(selected).toLocaleString()}</div>
                    <div className="text-xs text-slate-500">XP</div>
                  </div>
                )}
                <button onClick={() => setEncForm({ ...ENC_BLANK, ...selected })}
                  className="px-3 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors">
                  Edit
                </button>
                <button onClick={() => setAddingCreature(true)}
                  className="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
                  + Creature
                </button>
              </div>
            </div>

            {selected.summary && <div className="mb-6"><p className="text-slate-300">{selected.summary}</p></div>}

            {selected.readAloud && (
              <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700 border-l-4 border-l-indigo-500">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Read Aloud</div>
                <p className="text-slate-200 italic leading-relaxed">{selected.readAloud}</p>
              </div>
            )}

            {selected.creatures.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Creatures</h3>
                <div className="space-y-2">
                  {selected.creatures.map(c => {
                    const creature = c.srdCreature ?? c.campaignCreature
                    const name = creature?.name ?? `Creature #${c.srdCreatureId ?? c.campaignCreatureId}`
                    const cr = creature?.CR ?? '?'
                    const ac = creature?.AC ?? '?'
                    const hp = creature?.HPAverage ?? '?'
                    const type = c.srdCreature?.creatureType ?? (c.campaignCreature ? 'homebrew' : '')
                    const xp = c.campaignCreature?.xpValue ?? xpFromCR(typeof cr === 'string' ? cr : '0')
                    return (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700 group">
                        <div>
                          <div className="flex items-center gap-2">
                            {c.campaignCreatureId ? (
                              <button
                                onClick={() => loadStatBlock(c.campaignCreatureId!)}
                                className="text-slate-200 font-medium hover:text-indigo-300 transition-colors text-left"
                              >
                                {c.quantity > 1 ? `${c.quantity}× ` : ''}{name}
                              </button>
                            ) : c.srdCreatureId ? (
                              <button
                                onClick={() => loadSrdStatBlock(c.srdCreatureId!)}
                                className="text-slate-200 font-medium hover:text-indigo-300 transition-colors text-left"
                              >
                                {c.quantity > 1 ? `${c.quantity}× ` : ''}{name}
                              </button>
                            ) : (
                              <span className="text-slate-200 font-medium">{c.quantity > 1 ? `${c.quantity}× ` : ''}{name}</span>
                            )}
                            {type && <span className="text-slate-600 text-xs capitalize">{type}</span>}
                          </div>
                          {c.notes && <p className="text-xs text-slate-500 mt-0.5">{c.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-xs text-slate-400">CR {cr} · AC {ac} · {hp} HP</div>
                            <div className="text-xs text-slate-600">{(xp * c.quantity).toLocaleString()} XP</div>
                          </div>
                          {c.campaignCreatureId && (
                            <button
                              onClick={() => loadStatBlock(c.campaignCreatureId!)}
                              className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded text-slate-500 hover:text-indigo-300 hover:bg-slate-700/60 transition-all"
                              title="View stat block"
                            >
                              Stats
                            </button>
                          )}
                          {c.srdCreatureId && (
                            <button
                              onClick={() => loadSrdStatBlock(c.srdCreatureId!)}
                              className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded text-slate-500 hover:text-indigo-300 hover:bg-slate-700/60 transition-all"
                              title="View stat block"
                            >
                              Stats
                            </button>
                          )}
                          <button onClick={() => removeCreature(c)}
                            className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 text-xs transition-all">✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Difficulty calculator — only shown when there are creatures and party info is set */}
            {selected.creatures.length > 0 && partySize && partyLevel && (
              <DifficultyCalc enc={selected} partySize={partySize} partyLevel={partyLevel} />
            )}

            {selected.tactics && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tactics</h3>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{selected.tactics}</p>
              </div>
            )}
            {selected.dmNotes && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">DM Notes</h3>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{selected.dmNotes}</p>
              </div>
            )}
            {selected.rewardText && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Reward</h3>
                <p className="text-slate-300 text-sm">{selected.rewardText}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select an encounter to view details</div>
        )}
      </div>

      {encForm && (
        <EncounterForm
          initial={(encForm as unknown) === 'new' ? ENC_BLANK : (encForm as typeof ENC_BLANK & { id: number })}
          onSave={saveEncounter}
          onClose={() => setEncForm(null)}
          onDelete={(encForm as unknown) !== 'new' ? deleteEncounter : undefined}
        />
      )}

      {addingCreature && selected && (
        <AddCreaturePanel
          encounterId={selected.id}
          projectSlug={project.slug}
          onAdd={onCreatureAdded}
          onClose={() => setAddingCreature(false)}
        />
      )}

      {viewingCreature && (
        <StatBlockPanel
          creature={viewingCreature}
          onEdit={() => {
            setEditingCreature({ ...creatureToForm(viewingCreature), id: viewingCreature.id })
            setViewingCreature(null)
          }}
          onClose={() => setViewingCreature(null)}
        />
      )}

      {viewingSrdCreature && (
        <StatBlockPanel
          creature={viewingSrdCreature}
          onClose={() => setViewingSrdCreature(null)}
        />
      )}

      {editingCreature && (
        <CreatureForm
          initial={editingCreature}
          projectSlug={project.slug}
          onSave={saved => { onStatBlockCreatureSaved(saved); setEditingCreature(null) }}
          onClose={() => setEditingCreature(null)}
        />
      )}
    </div>
  )
}
