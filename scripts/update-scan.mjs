#!/usr/bin/env node
/**
 * update-scan — one-shot inventory for the `/update` skill.
 *
 * Gathers everything mechanical about "what could be updated" into ONE markdown
 * report so the skill spends its tool calls on judgment, not collection:
 *
 *   - npm outdated  (classified patch / minor / major, load-bearing flagged)
 *   - npm audit     (prod vs dev reachability, counts by severity)
 *   - pinned platform facts: Node (local + CI), Stripe apiVersion, AI model
 *     registry slugs, Supabase CLI, GitHub Actions `uses:` versions
 *
 * Read-only. Never installs, never writes. Network: npm registry only.
 *
 *   node scripts/update-scan.mjs            # markdown to stdout
 *   node scripts/update-scan.mjs --json     # raw JSON instead
 */
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const JSON_OUT = process.argv.includes('--json')

/** Packages where a bump touches more than one file or a runtime contract. */
const LOAD_BEARING = {
  next: 'framework — use the vercel:next-upgrade skill; proxy.ts convention; run full prebuild',
  react: 'exact-pinned with react-dom; move both together',
  'react-dom': 'exact-pinned with react; move both together',
  ai: 'AI SDK — v7 is a MAJOR held on purpose; whole lib/ai layer is v6',
  '@ai-sdk/anthropic': 'moves with `ai`',
  '@ai-sdk/xai': 'moves with `ai`',
  '@supabase/ssr': 'auth cookie contract; test login + proxy.ts session refresh',
  '@supabase/supabase-js': 'DB client; regenerate types after',
  stripe: 'check lib/stripe.ts apiVersion + webhook payload shape',
  zod: 'v4 .partial()+.refine() gotcha; schemas across lib/',
  tailwindcss: 'design tokens in app/globals.css',
  '@tailwindcss/postcss': 'moves with tailwindcss',
  '@sentry/nextjs': 'tunnelRoute + proxy.ts interplay; major = config migration',
  resend: 'email send contract',
  'sanitize-html': 'security-relevant; keep floor >= 2.18.1',
  eslint: 'v10 migration is its own deferred task',
  'eslint-config-next': 'moves with next + eslint',
  typescript: 'majors can break strict mode across the tree',
  supabase: 'CLI — keep in step with db:types + CI setup-cli',
}

function sh(cmd, { ok = [0] } = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    // npm outdated / audit exit non-zero when they find something — that's data, not failure
    if (ok.includes(e.status) || (e.stdout && e.stdout.trim().startsWith('{'))) return e.stdout ?? ''
    return ''
  }
}
const parse = (s) => { try { return JSON.parse(s) } catch { return null } }
const semverKind = (from, to) => {
  const a = from.replace(/^[^\d]*/, '').split('.').map(Number)
  const b = to.replace(/^[^\d]*/, '').split('.').map(Number)
  if (a[0] !== b[0]) return 'major'
  if (a[1] !== b[1]) return 'minor'
  return 'patch'
}

// ---------- collect ----------
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const prodDeps = new Set(Object.keys(pkg.dependencies ?? {}))

const outdatedRaw = parse(sh('npm outdated --json', { ok: [0, 1] })) ?? {}
const outdated = Object.entries(outdatedRaw).map(([name, v]) => ({
  name,
  current: v.current ?? '—',
  wanted: v.wanted,
  latest: v.latest,
  kind: v.current ? semverKind(v.current, v.latest) : 'unknown',
  prod: prodDeps.has(name),
  note: LOAD_BEARING[name] ?? '',
}))

const audit = parse(sh('npm audit --json', { ok: [0, 1] }))
const vulns = audit?.vulnerabilities ?? {}
const auditRows = Object.values(vulns)
  .filter((v) => ['critical', 'high', 'moderate', 'low'].includes(v.severity))
  .map((v) => ({
    name: v.name,
    severity: v.severity,
    prod: prodDeps.has(v.name) || (v.effects ?? []).some((e) => prodDeps.has(e)),
    direct: v.isDirect,
    fixAvailable: v.fixAvailable === true ? 'yes' : v.fixAvailable ? `${v.fixAvailable.name}@${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? ' (MAJOR)' : ''}` : 'no',
    via: (v.via ?? []).map((x) => (typeof x === 'string' ? x : x.title)).slice(0, 2).join('; '),
  }))
const auditCounts = audit?.metadata?.vulnerabilities ?? {}

const workflows = []
const wfDir = join(ROOT, '.github', 'workflows')
if (existsSync(wfDir)) {
  for (const f of readdirSync(wfDir)) {
    const src = readFileSync(join(wfDir, f), 'utf8')
    for (const m of src.matchAll(/uses:\s*([^\s@]+)@([^\s#]+)/g)) workflows.push({ file: f, action: m[1], ref: m[2] })
    const nv = src.match(/node-version:\s*["']?([\w.]+)/)
    if (nv) workflows.push({ file: f, action: 'node-version', ref: nv[1] })
  }
}
const actionsDedup = [...new Map(workflows.map((w) => [`${w.action}@${w.ref}`, w])).values()]

const stripeSrc = existsSync(join(ROOT, 'lib/stripe.ts')) ? readFileSync(join(ROOT, 'lib/stripe.ts'), 'utf8') : ''
const stripeApi = stripeSrc.match(/apiVersion:\s*'([^']+)'/)?.[1] ?? '(not pinned)'

const modelsSrc = existsSync(join(ROOT, 'lib/ai/models.ts')) ? readFileSync(join(ROOT, 'lib/ai/models.ts'), 'utf8') : ''
const modelSlugs = [...new Set([...modelsSrc.matchAll(/'([a-z0-9-]+\/[a-z0-9.:-]+)'/gi)].map((m) => m[1]))]

const nodeLocal = process.version
const npmLocal = sh('npm --version').trim()
const supabaseCli = pkg.devDependencies?.supabase ?? '(not in devDeps)'
const dependabot = existsSync(join(ROOT, '.github', 'dependabot.yml'))

const report = {
  generated: new Date().toISOString().slice(0, 10),
  node: { local: nodeLocal, npm: npmLocal, ci: [...new Set(workflows.filter((w) => w.action === 'node-version').map((w) => `${w.ref} (${w.file})`))].join(', ') || '?', engines: pkg.engines ?? null },
  outdated,
  audit: { counts: auditCounts, rows: auditRows },
  actions: actionsDedup,
  pins: { stripeApiVersion: stripeApi, modelSlugs, supabaseCli, dependabot },
}

if (JSON_OUT) { console.log(JSON.stringify(report, null, 2)); process.exit(0) }

// ---------- markdown ----------
const L = []
L.push(`# update-scan ${report.generated}`)
L.push('')
L.push(`Node local ${nodeLocal} · npm ${npmLocal} · CI node-version ${report.node.ci} · engines ${pkg.engines ? JSON.stringify(pkg.engines) : 'unset'} · dependabot ${dependabot ? 'yes' : 'no'}`)
L.push('')

L.push(`## npm outdated (${outdated.length})`)
if (!outdated.length) L.push('_clean_')
else {
  L.push('| package | current | wanted | latest | kind | prod | load-bearing |')
  L.push('|---|---|---|---|---|---|---|')
  const order = { major: 0, minor: 1, patch: 2, unknown: 3 }
  for (const o of [...outdated].sort((a, b) => order[a.kind] - order[b.kind] || (b.prod - a.prod) || a.name.localeCompare(b.name)))
    L.push(`| ${o.name} | ${o.current} | ${o.wanted} | ${o.latest} | ${o.kind} | ${o.prod ? 'prod' : 'dev'} | ${o.note} |`)
}
L.push('')

const c = auditCounts
L.push(`## npm audit — critical ${c.critical ?? 0} · high ${c.high ?? 0} · moderate ${c.moderate ?? 0} · low ${c.low ?? 0}`)
L.push('Baseline: memory `project_npm_audit_triage_2026_10_31` (26 accepted, all dev/build-only). Only NEW or newly prod-reachable rows matter.')
if (!auditRows.length) L.push('_clean_')
else {
  L.push('| package | severity | reach | direct | fix | via |')
  L.push('|---|---|---|---|---|---|')
  const sev = { critical: 0, high: 1, moderate: 2, low: 3 }
  for (const r of [...auditRows].sort((a, b) => sev[a.severity] - sev[b.severity] || (b.prod - a.prod)))
    L.push(`| ${r.name} | ${r.severity} | ${r.prod ? '**prod**' : 'dev'} | ${r.direct ? 'yes' : 'transitive'} | ${r.fixAvailable} | ${r.via.replace(/\|/g, '/')} |`)
}
L.push('')

L.push('## Pinned platform facts (verify against vendor changelogs)')
L.push(`- Stripe apiVersion: \`${stripeApi}\` (lib/stripe.ts) — stripe pkg ${pkg.dependencies?.stripe}`)
L.push(`- AI model slugs (lib/ai/models.ts): ${modelSlugs.map((s) => `\`${s}\``).join(', ') || '(none found)'} — run \`npm run ai:drift\` for retirement/generation checks`)
L.push(`- Supabase CLI (devDeps): ${supabaseCli}`)
L.push(`- GitHub Actions:`)
for (const a of actionsDedup) L.push(`  - ${a.action}@${a.ref}  (${a.file})`)
L.push('')
L.push('_Not covered here (needs web/MCP): Vercel runtime deprecations, Supabase Postgres version + advisors, Resend/Upstash/Printful/Cloudflare API changes, Claude Code CLI version._')

console.log(L.join('\n'))
