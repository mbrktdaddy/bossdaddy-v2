import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { extractToolInput } from '@/lib/claude/structured'
import {
  RADAR_TOPICS,
  SUBREDDITS,
  TREND_SEEDS,
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

// ── Source: Google autocomplete (free proxy for trending interest) ───────────
async function runTrendsRadar(errors: string[]): Promise<SignalInput[]> {
  const out: SignalInput[] = []
  await Promise.all(TREND_SEEDS.map(async (seed) => {
    try {
      const res = await fetch(
        `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`,
        { headers: { 'User-Agent': RADAR_USER_AGENT }, signal: AbortSignal.timeout(10_000) },
      )
      if (!res.ok) { errors.push(`autocomplete/${seed}: HTTP ${res.status}`); return }
      const json = await res.json()
      // Firefox client shape: [query, [suggestion, suggestion, ...]]
      const suggestions: unknown = Array.isArray(json) ? json[1] : null
      if (!Array.isArray(suggestions)) return
      suggestions.slice(0, RADAR_CAPS.trendsPerSeed).forEach((s, i) => {
        if (typeof s !== 'string' || !s.trim()) return
        out.push({
          source:    'autocomplete',
          topic:     s.trim().slice(0, 500),
          url:       null,
          // Rank-based strength: earlier suggestions rank higher.
          raw_score: RADAR_CAPS.trendsPerSeed - i,
          payload:   { seed, rank: i },
        })
      })
    } catch (err) {
      errors.push(`autocomplete/${seed}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }))
  return out
}

// ── Source: Claude web_search (the core radar) ───────────────────────────────
const RADAR_SYSTEM = `You are the trend radar for Boss Daddy (BossDaddyLife.com), a dad-life product-review and advice brand. Your job: use web search to surface FRESH, currently-discussed topics and angles that Boss Daddy could post about on X this week.

Hunt for: trending dad/parenting gear, new product launches and recalls, viral father-son moments, seasonal buying interest, and dad-life conversations gaining traction right now. Favor timely, specific, postable angles over evergreen generalities.

For each signal return: a short topic/angle (what Boss Daddy would post about), a real source URL you actually retrieved, a relevance score 0-100 (how on-brand and timely it is), and a one-line "why" (the hook).

Be efficient with searches. When you have gathered signals, return them by calling the submit_signals tool. Only include signals backed by a real URL you retrieved.`

const SIGNALS_TOOL: Anthropic.Tool = {
  name: 'submit_signals',
  description: 'Return the trending topic signals gathered from web search.',
  input_schema: {
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
  },
}

function isHttpUrl(s: unknown): s is string {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim())
}

async function runWebSearchRadar(errors: string[]): Promise<SignalInput[]> {
  const prompt = `Find this week's most postable dad-life topics for Boss Daddy on X. Hunt across these themes:
${RADAR_TOPICS.map((t) => `- ${t}`).join('\n')}

Search recent sources, then return 10-20 timely signals via the submit_signals tool. Each needs a real source URL you retrieved, a 0-100 relevance score, and a one-line hook.`

  const tools: Anthropic.Messages.MessageCreateParams['tools'] = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: RADAR_CAPS.maxWebSearches },
    SIGNALS_TOOL,
  ]
  const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: prompt }]
  const createArgs = (msgs: Anthropic.Messages.MessageParam[]) => ({
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: 'text' as const, text: RADAR_SYSTEM, cache_control: { type: 'ephemeral' as const } }],
    tools,
    messages: msgs,
  })

  try {
    let message = await getClaudeClient().messages.create(createArgs(messages), { maxRetries: 3 })
    // web_search can yield stop_reason 'pause_turn' on long loops — continue the
    // turn (passing partial content back) until it finishes, capped.
    let guard = 0
    while (message.stop_reason === 'pause_turn' && guard < 3) {
      guard++
      messages.push({ role: 'assistant', content: message.content })
      message = await getClaudeClient().messages.create(createArgs(messages), { maxRetries: 3 })
    }

    // web_search + a forced output tool can't coexist, so fall back to prose JSON.
    let out = extractToolInput(message, 'submit_signals')
    if (!out) {
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text).join('\n')
      const m = text.match(/\{[\s\S]*\}/)
      if (m) { try { out = JSON.parse(m[0]) } catch { out = null } }
    }
    const signals = Array.isArray(out?.signals) ? out!.signals : []
    return signals
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

  const [web, reddit, trends] = await Promise.all([
    runWebSearchRadar(errors),
    runRedditRadar(errors),
    runTrendsRadar(errors),
  ])

  const all = [...web, ...reddit, ...trends].slice(0, RADAR_CAPS.maxSignalsPerRun)
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
