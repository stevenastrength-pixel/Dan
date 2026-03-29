const { PrismaClient } = require('@prisma/client')
const https = require('https')

const prisma = new PrismaClient()

// ─── Fetch helpers ────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, { headers: { 'User-Agent': 'DAN-seed/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location)
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`))
        }
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch (e) { reject(new Error(`JSON parse failed for ${u}: ${e.message}`)) }
        })
      }).on('error', reject)
    }
    get(url)
  })
}

// Fetch with simple retry
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await fetchJson(url) }
    catch (e) {
      if (i === retries - 1) throw e
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// ─── CR → XP table ────────────────────────────────────────────────────────────

const CR_TO_XP = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 23000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '30': 155000,
}

// ─── Transformers ─────────────────────────────────────────────────────────────

function safe(v) { return (v ?? '').toString() }

function transformCreature(m) {
  const cr = safe(m.challenge_rating)
  const stProfs = (m.proficiencies || [])
    .filter(p => p.proficiency?.index?.startsWith('saving-throw-'))
    .map(p => `${p.proficiency.index.replace('saving-throw-', '').toUpperCase()} +${p.value}`)
  const skillProfs = (m.proficiencies || [])
    .filter(p => p.proficiency?.index?.startsWith('skill-'))
    .map(p => `${p.proficiency.name.replace('Skill: ', '')} +${p.value}`)

  return {
    name: m.name,
    size: safe(m.size),
    creatureType: safe(m.type),
    alignment: safe(m.alignment),
    CR: cr,
    xpValue: CR_TO_XP[cr] ?? 0,
    AC: m.armor_class?.[0]?.value ?? (typeof m.armor_class === 'number' ? m.armor_class : 10),
    acType: m.armor_class?.[0]?.type ?? '',
    HPDice: safe(m.hit_dice),
    HPAverage: m.hit_points ?? 1,
    speed: JSON.stringify(m.speed ?? {}),
    STR: m.strength ?? 10,
    DEX: m.dexterity ?? 10,
    CON: m.constitution ?? 10,
    INT: m.intelligence ?? 10,
    WIS: m.wisdom ?? 10,
    CHA: m.charisma ?? 10,
    savingThrows: JSON.stringify(stProfs),
    skills: JSON.stringify(skillProfs),
    damageResistances: JSON.stringify(m.damage_resistances ?? []),
    damageImmunities: JSON.stringify(m.damage_immunities ?? []),
    damageVulnerabilities: JSON.stringify(m.damage_vulnerabilities ?? []),
    conditionImmunities: JSON.stringify((m.condition_immunities ?? []).map(c => c.name ?? c)),
    senses: m.senses ? Object.entries(m.senses).map(([k, v]) => `${k} ${v}`).join(', ') : '',
    languages: safe(m.languages),
    traits: JSON.stringify((m.special_abilities ?? []).map(t => ({ name: t.name, description: t.desc }))),
    actions: JSON.stringify((m.actions ?? []).map(a => ({
      name: a.name, description: a.desc,
      attackBonus: a.attack_bonus,
      damage: a.damage?.[0]?.damage_dice,
      damageType: a.damage?.[0]?.damage_type?.name,
    }))),
    bonusActions: '[]',
    reactions: JSON.stringify((m.reactions ?? []).map(r => ({ name: r.name, description: r.desc }))),
    legendaryActions: JSON.stringify((m.legendary_actions ?? []).map(la => ({ name: la.name, description: la.desc }))),
    lairActions: '[]',
    isLegendary: (m.legendary_actions?.length ?? 0) > 0,
    legendaryResistances: (m.special_abilities ?? []).filter(a => a.name?.startsWith('Legendary Resistance')).length,
    hasLairActions: false,
  }
}

function transformSpell(s) {
  return {
    name: s.name,
    level: s.level ?? 0,
    school: s.school?.name ?? '',
    castingTime: safe(s.casting_time),
    range: safe(s.range),
    components: (s.components ?? []).join(', '),
    duration: safe(s.duration),
    concentration: s.concentration ?? false,
    ritual: s.ritual ?? false,
    description: (s.desc ?? []).join('\n'),
    higherLevels: (s.higher_level ?? []).join('\n'),
    classes: JSON.stringify((s.classes ?? []).map(c => c.name)),
  }
}

const RARITY_MAP = {
  'common': 'common', 'uncommon': 'uncommon', 'rare': 'rare',
  'very rare': 'very rare', 'legendary': 'legendary', 'artifact': 'artifact',
}

function transformMagicItem(item) {
  return {
    name: item.name,
    rarity: RARITY_MAP[item.rarity?.name?.toLowerCase()] ?? 'uncommon',
    itemType: item.equipment_category?.index ?? 'wondrous',
    requiresAttunement: typeof item.requires_attunement === 'string'
      ? item.requires_attunement.toLowerCase().includes('require') || item.requires_attunement === 'yes'
      : false,
    description: (item.desc ?? []).join('\n'),
  }
}

// ─── Batch fetcher ────────────────────────────────────────────────────────────

const API = 'https://www.dnd5eapi.co/api/2014'
const CONCURRENCY = 5

async function fetchAllDetails(urls) {
  const results = []
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      batch.map(url => fetchWithRetry(`https://www.dnd5eapi.co${url}`))
    )
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value)
    }
    if ((i + CONCURRENCY) % 50 === 0) {
      process.stdout.write(`  ${i + CONCURRENCY}/${urls.length}...\r`)
    }
  }
  return results
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [existingCreatures, existingSpells, existingItems] = await Promise.all([
    prisma.srdCreature.count(),
    prisma.srdSpell.count(),
    prisma.srdMagicItem.count(),
  ])

  if (existingCreatures === 0) {
    console.log('Seeding SRD creatures…')
    try {
      const list = await fetchWithRetry(`${API}/monsters`)
      const urls = list.results.map(r => r.url)
      console.log(`  Fetching ${urls.length} monsters…`)
      const monsters = await fetchAllDetails(urls)
      let count = 0
      for (const m of monsters) {
        try {
          await prisma.srdCreature.create({ data: transformCreature(m) })
          count++
        } catch (e) {
          console.warn(`\n  Skipped ${m.name}: ${e.message}`)
        }
      }
      console.log(`\n  ✓ ${count}/${urls.length} creatures seeded`)
    } catch (e) {
      console.error('  ✗ Failed to seed creatures:', e.message)
    }
  } else {
    console.log(`SRD creatures: already seeded (${existingCreatures} records)`)
  }

  if (existingSpells === 0) {
    console.log('Seeding SRD spells…')
    try {
      const list = await fetchWithRetry(`${API}/spells`)
      const urls = list.results.map(r => r.url)
      console.log(`  Fetching ${urls.length} spells…`)
      const spells = await fetchAllDetails(urls)
      let count = 0
      for (const s of spells) {
        try {
          await prisma.srdSpell.create({ data: transformSpell(s) })
          count++
        } catch (e) {
          console.warn(`\n  Skipped ${s.name}: ${e.message}`)
        }
      }
      console.log(`\n  ✓ ${count}/${urls.length} spells seeded`)
    } catch (e) {
      console.error('  ✗ Failed to seed spells:', e.message)
    }
  } else {
    console.log(`SRD spells: already seeded (${existingSpells} records)`)
  }

  if (existingItems === 0) {
    console.log('Seeding SRD magic items…')
    try {
      const list = await fetchWithRetry(`${API}/magic-items`)
      const urls = list.results.map(r => r.url)
      console.log(`  Fetching ${urls.length} magic items…`)
      const items = await fetchAllDetails(urls)
      let count = 0
      for (const item of items) {
        try {
          await prisma.srdMagicItem.create({ data: transformMagicItem(item) })
          count++
        } catch (e) {
          console.warn(`\n  Skipped ${item.name}: ${e.message}`)
        }
      }
      console.log(`\n  ✓ ${count}/${urls.length} magic items seeded`)
    } catch (e) {
      console.error('  ✗ Failed to seed magic items:', e.message)
    }
  } else {
    console.log(`SRD magic items: already seeded (${existingItems} records)`)
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
