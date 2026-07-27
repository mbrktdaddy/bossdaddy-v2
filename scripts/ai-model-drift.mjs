// Model-registry drift check — `npm run ai:drift`.
//
// WHY THIS EXISTS: the AI Gateway has no floating "latest" alias, so every slug in
// lib/ai/models.ts is pinned by hand. Pinning is the right call (the moderation
// bucket is a compliance gate, 19 surfaces depend on schema adherence, and the
// content bucket's brand voice is tuned per model) — but a hand-pinned registry
// rots silently. This script makes the ROT VISIBLE without ever auto-upgrading:
// the decision stays human, the detection is automated.
//
// It reports two things, both actionable:
//   1. RETIRED  — a slug we pin is no longer served. This is a real defect: the
//                 surface pointing at it will 400 at runtime. Fix immediately.
//   2. DRIFT    — a newer version exists in a family we pin. Advisory: go look,
//                 eval, and bump deliberately.
//
// Exits non-zero on either so a scheduled CI job surfaces it. Makes NO paid model
// call — it only lists models (unlike `npm run ai:smoke`, which does one tiny call).

import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { gateway } from 'ai'

const REGISTRY_PATH = new URL('../lib/ai/models.ts', import.meta.url)

// Pull the pinned slugs straight out of the registry so this script can never
// disagree with the app about what is pinned.
async function pinnedSlugs() {
  const src = await readFile(REGISTRY_PATH, 'utf8')
  // Only the MODELS object literal — ignore slugs mentioned in the header comment.
  const body = src.slice(src.indexOf('export const MODELS'))
  const found = [...body.matchAll(/'([a-z0-9-]+\/[a-z0-9.:-]+)'/gi)].map((m) => m[1])
  return [...new Set(found)]
}

// Split `anthropic/claude-sonnet-4.6` into { family: 'anthropic/claude-sonnet||',
// version: [4,6] }. The family key keeps the prefix AND the suffix so variants
// stay in separate lanes: `grok-4.1-fast-non-reasoning` never compares against
// `grok-4.1-fast-reasoning`, and `claude-3-haiku` never against `claude-haiku-4.5`.
export function parseSlug(slug) {
  const slash = slug.indexOf('/')
  if (slash < 0) return null
  const provider = slug.slice(0, slash)
  const name = slug.slice(slash + 1)
  // Non-greedy prefix: shortest prefix followed by -<digits>.
  const m = name.match(/^(.*?)-(\d+(?:\.\d+)*)(.*)$/)
  if (!m) return null
  return {
    family: `${provider}/${m[1]}||${m[3]}`,
    version: m[2].split('.').map(Number),
    raw: slug,
  }
}

// Numeric segment compare. NOTE this is a HEURISTIC across xAI's scheme, where
// `4.20` sorts above `4.5` (20 > 5). That may or may not match xAI's intent — which
// is exactly why this script only advises and never rewrites the registry.
export function cmpVersion(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

async function main() {
  const pins = await pinnedSlugs()
  if (!pins.length) {
    console.error('FAIL: could not parse any slugs out of lib/ai/models.ts')
    process.exit(1)
  }

  let available
  try {
    const res = await gateway.getAvailableModels()
    const arr = Array.isArray(res) ? res : (res.models ?? res.data ?? [])
    available = arr.map((m) => String(m.id ?? m.modelId ?? m)).filter(Boolean)
  } catch (err) {
    console.error('FAIL: getAvailableModels threw —', err?.message ?? err)
    process.exit(1)
  }

  console.log(`registry pins ${pins.length} slugs; gateway serves ${available.length} models\n`)

  const availableSet = new Set(available)
  const parsedAvailable = available.map(parseSlug).filter(Boolean)

  const retired = []
  const drifted = []

  for (const pin of pins) {
    if (!availableSet.has(pin)) {
      retired.push(pin)
      continue
    }
    const p = parseSlug(pin)
    if (!p) {
      console.log(`  ?  ${pin} — unversioned slug, cannot check for drift`)
      continue
    }
    const newer = parsedAvailable
      .filter((c) => c.family === p.family && cmpVersion(c.version, p.version) > 0)
      .sort((a, b) => cmpVersion(b.version, a.version))
    if (newer.length) {
      drifted.push({ pin, newer: newer.map((n) => n.raw) })
    } else {
      console.log(`  ok ${pin}`)
    }
  }

  if (retired.length) {
    console.error('\nRETIRED — pinned but no longer served (these will 400 at runtime):')
    for (const r of retired) console.error(`  ✗ ${r}`)
  }

  if (drifted.length) {
    console.warn('\nDRIFT — a newer generation is available for a family we pin:')
    for (const d of drifted) {
      console.warn(`  ↑ ${d.pin}  →  ${d.newer.join(', ')}`)
    }
    console.warn(
      '\nThis is ADVISORY, not a to-do. Bumping the registry moves the moderation\n' +
        'compliance gate and the content bucket\'s brand voice — eval before you bump.\n' +
        'See the header comment in lib/ai/models.ts.',
    )
  }

  if (retired.length || drifted.length) {
    console.log(`\nDRIFT CHECK: ${retired.length} retired, ${drifted.length} behind`)
    process.exit(1)
  }
  console.log('\nDRIFT CHECK PASS — registry is current')
}

// Only run when invoked directly — the parse/compare helpers above are imported
// by tests/unit/ai-model-drift.test.ts, which must not trigger a gateway call.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
