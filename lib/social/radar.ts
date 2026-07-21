import type { SupabaseClient } from '@supabase/supabase-js'
import { jsonSchema, type JSONSchema7 } from 'ai'
import { aiResearch } from '@/lib/ai/research'
import {
  RADAR_TOPICS,
  SUBREDDITS,
  RADAR_CAPS,
  RADAR_USER_AGENT,
} from '@/lib/social/radar-config'

// X Studio Phase 4 — radar engine (SENSE layer).
//
// Pulls raw signals from three free-ish sources and appends them to
// `social_signals` (owner-scoped; the cron writes via the service-role client,
// attributing rows to the admin/founder). Each source is isolated — one failing
// never aborts the run. The DECIDE layer (Phase 5) reads these and scores them;
// `raw_score` is the per-source raw strength, NOT a normalized score.

export type RadarSource = 'web_search' | 'reddit' | 'trends' | 'autocomplete'

export interface SignalInput {
  source:    RadarSource
  topic:     string
  url:       string | null
  raw_score: number | null
  payload:   Record<string, unknown>
}

export interface RadarResult {
  inserted: number
  bySource: Record<string, number>
  errors:   string[]
}

// ── Source: Reddit (free public JSON) ────────────────────────────────────────
async function runRedditRadar(errors: string[]): Promise<SignalInput[]> {
  const out: SignalInput[] = []
  await Promise.all(SUBREDDITS.map(async (sub) => {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/top.json?t=${RADAR_CAPS.redditWindow}&limit=${RADAR_CAPS.redditPerSub}`,
        { headers: { 'User-Agent': RADAR_USER_AGENT }, signal: AbortSignal.timeout(15_000) },
      )
      if (!res.ok) { errors.push(`reddit/${sub}: HTTP ${res.status}`); return }
      const json = await res.json()
      const children = json?.data?.children
      if (!Array.isArray(children)) return
      for (const c of children) {
        const d = c?.data
        if (!d?.title) continue
        out.push({
          source:    'reddit',
          topic:     String(d.title).slice(0, 500),
          url:       d.permalink ? `https://www.reddit.com${d.permalink}` : null,
          raw_score: Number.isFinite(d.score) ? Number(d.score) : null,
          payload: {
            subreddit:    sub,
            num_comments: Number(d.num_comments) || 0,
            upvote_ratio: typeof d.upvote_ratio === 'number' ? d.upvote_ratio : null,
            post_url:     typeof d.url === 'string' ? d.url : null,
            over_18:      d.over_18 === true,
          },
        })
      }
    } catch (err) {
      errors.push(`reddit/${sub}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }))
  return out
}

// ── Source: Claude web_search (the core radar) ───────────────────────────────
const RADAR_SYSTEM = `You are the trend radar for Boss Daddy (BossDaddyLife.com), a dad-life product-review and advice brand. Your job: use web search to surface FRESH, currently-discussed topics and angles that Boss Daddy could post about on X this week.

Hunt for: trending dad/parenting gear, new product launches and recalls, viral father-son moments, seasonal buying interest, and dad-life conversations gaining traction right now. Favor timely, specific, postable angles over evergreen generalities.

For each signal: a short topic/angle (what Boss Daddy would post about), a real source URL you actually retrieved, a relevance score 0-100 (how on-brand and timely it is), and a one-line "why" (the hook).

WORKFLOW (follow exactly):
1. Run a few web searches across the themes you're given. Be efficient — a few broad searches beat many narrow ones.
2. As soon as you have ~10-20 candidate signals, STOP searching and return them as the structured object.
Return the result as the required structured object (a "signals" array). Only include a signal if you have a real source URL you actually retrieved.`

// The signals are returned as one schema-validated object (AI SDK `Output.object`)
// after the model runs its web_search steps — no output tool, no forced-tool
// second pass, no prose salvage.
const SIGNALS_SCHEMA: JSONSchema7 = {
    type: 'object',
    properties: {
      signals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic:     { type: 'string', description: 'Short postable topic/angle' },
            url:       { type: 'string', description: 'A real source URL you actually retrieved' },
            relevance: { type: 'number', description: '0-100 on-brand + timeliness score' },
            why:       { type: 'string', description: 'One-line hook / reason it matters now' },
          },
          required: ['topic', 'url', 'relevance', 'why'],
        },
      },
    },
    required: ['signals'],
}

function isHttpUrl(s: unknown): s is string {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim())
}

async function runWebSearchRadar(errors: string[]): Promise<SignalInput[]> {
  const prompt = `Find this week's most postable dad-life topics for Boss Daddy on X. Hunt across these themes:
${RADAR_TOPICS.map((t) => `- ${t}`).join('\n')}

Search recent sources, then return 10-20 timely signals as the structured object. Each needs a real source URL you retrieved, a 0-100 relevance score, and a one-line hook.`

  // Provider-native web search (research bucket) + one schema-validated object.
  // The SDK's multi-step loop replaces the old phase-1 pause_turn loop, and
  // `Output.object` makes the phase-2 forced-tool call and the prose salvage
  // unnecessary — the model can't end without emitting the object. A single hard
  // `timeout` bounds the call under the cron's 300s cap; maxRetries 1 — a retry on
  // a near-timeout call would blow the cap. When AI_MODEL_RESEARCH points at a
  // grok slug this hunts X via Grok Live Search (the platform radar posts to).
  try {
    const { object } = await aiResearch<{ signals?: Record<string, unknown>[] }>({
      tag: 'radar',
      system: RADAR_SYSTEM,
      prompt,
      schema: jsonSchema<{ signals?: Record<string, unknown>[] }>(SIGNALS_SCHEMA),
      search: { maxUses: RADAR_CAPS.maxWebSearches },
      maxSteps: RADAR_CAPS.maxWebSearches + 3,
      maxOutputTokens: 3000,
      maxRetries: 1,
      timeout: 230_000,
    })

    const signals = Array.isArray(object?.signals) ? object.signals : []
    const mapped = signals
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof s.topic === 'string' && isHttpUrl(s.url))
      .map((s) => {
        const rel = Number(s.relevance)
        return {
          source:    'web_search' as const,
          topic:     (s.topic as string).trim().slice(0, 500),
          url:       (s.url as string).trim(),
          raw_score: Number.isFinite(rel) ? Math.max(0, Math.min(100, Math.round(rel))) : null,
          payload:   { why: typeof s.why === 'string' ? s.why.trim().slice(0, 300) : null },
        }
      })

    // Surface a zero-yield run instead of failing silently.
    if (mapped.length === 0) errors.push('web_search: 0 signals returned')
    return mapped
  } catch (err) {
    errors.push(`web_search: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────
// Resolve the admin/founder the signals belong to (single-user N=1 for now).
export async function pickRadarUserId(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

export async function runRadar(admin: SupabaseClient, userId: string): Promise<RadarResult> {
  const errors: string[] = []

  const [web, reddit] = await Promise.all([
    runWebSearchRadar(errors),
    runRedditRadar(errors),
  ])

  const all = [...web, ...reddit].slice(0, RADAR_CAPS.maxSignalsPerRun)
  const capturedAt = new Date().toISOString()

  const bySource: Record<string, number> = {}
  for (const s of all) bySource[s.source] = (bySource[s.source] ?? 0) + 1

  if (all.length === 0) return { inserted: 0, bySource, errors }

  const rows = all.map((s) => ({
    user_id:     userId,
    source:      s.source,
    topic:       s.topic,
    url:         s.url,
    raw_score:   s.raw_score,
    payload:     s.payload,
    captured_at: capturedAt,
  }))

  // social_signals is owner-scoped; the cron writes via service-role (bypasses
  // RLS) attributing rows to the admin. Cast matches the codebase convention for
  // the social_* tables.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('social_signals').insert(rows)
  if (error) {
    errors.push(`insert: ${error.message}`)
    return { inserted: 0, bySource, errors }
  }

  return { inserted: rows.length, bySource, errors }
}
