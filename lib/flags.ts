// Feature + provider flags. Today this is the single source of truth for WHICH
// AI model each purpose-bucket resolves to.
//
// Two mechanisms, kept deliberately separate:
//   • Outage / cost failover is AUTOMATIC — the Gateway retries the fallback
//     chain (see lib/ai/client.ts `providerOptions.gateway.models`). No toggle.
//   • DELIBERATE per-bucket provider preference lives HERE, via env vars:
//         AI_MODEL_CONTENT=xai/grok-4.5
//     Changes take effect on the next deploy. `moderation` has NO env var by
//     design (see PINNED below).

import { MODELS, isValidModelSlug } from './ai/models'

// Purpose buckets — the level at which providers are toggled. Every AI call site
// belongs to exactly one. Fine-grained surfaces still label calls for cost
// attribution (the wrapper's `tag`), but they inherit their bucket's model.
export type AiBucket = 'content' | 'research' | 'utility' | 'moderation' | 'concierge'

// Default model per bucket — Claude across the board until an operator opts a
// bucket into another provider.
const BUCKET_DEFAULT: Record<AiBucket, string> = {
  content: MODELS.claudeSonnet,
  research: MODELS.claudeSonnet,
  utility: MODELS.claudeSonnet,
  moderation: MODELS.claudeSonnet,
  concierge: MODELS.claudeSonnet,
}

// Buckets whose model is FIXED and ignores env overrides. `moderation` is the
// FTC / affiliate compliance gate (CLAUDE.md §3) — it must not be swapped to an
// unevaluated provider by a stray env var. To un-pin, remove it here
// deliberately; do NOT add an env escape hatch.
const PINNED: ReadonlySet<AiBucket> = new Set<AiBucket>(['moderation'])

// The concierge "sensitive lane" — edge-off / vulnerable-topic turns (loss,
// mental health, marriage strain, safety-critical). Defaults to Claude (the
// brand's warm Protector voice is tuned on it) but IS operator-overridable,
// independently of the everyday concierge model.
const CONCIERGE_SENSITIVE_ENV = 'AI_MODEL_CONCIERGE_SENSITIVE'

// The concierge "fast lane" — the cheap opening turn before any tool round (a
// Haiku-first cost optimization). Defaults to Haiku (NOT the bucket's Sonnet
// default) and is operator-overridable independently, so the cheap lane can be
// pointed at another model without touching the everyday/sensitive lanes.
const CONCIERGE_FAST_ENV = 'AI_MODEL_CONCIERGE_FAST'
const CONCIERGE_FAST_DEFAULT = MODELS.claudeHaiku

export interface ResolvedModel {
  /** Primary gateway slug the call should use. */
  model: string
  /** Fallback slugs the Gateway tries if the primary errors / hits its budget. */
  fallback: string[]
}

function envOverride(bucket: AiBucket): string | undefined {
  const raw = process.env[`AI_MODEL_${bucket.toUpperCase()}`]
  return isValidModelSlug(raw) ? raw.trim() : undefined
}

// When the chosen model is NOT the Claude default, add the default as an
// automatic Gateway fallback so an outage or budget cap on the chosen provider
// silently degrades back to Claude.
function withClaudeFallback(model: string): ResolvedModel {
  return { model, fallback: model === MODELS.claudeSonnet ? [] : [MODELS.claudeSonnet] }
}

/**
 * Resolve the model a bucket should use, honoring operator env overrides and the
 * compliance pins.
 */
export function resolveModel(
  bucket: AiBucket,
  opts?: { sensitive?: boolean; fast?: boolean; model?: string },
): ResolvedModel {
  // Compliance-pinned buckets ignore ALL overrides (env, sensitive, explicit) —
  // checked first so nothing can route them off Claude.
  if (PINNED.has(bucket)) {
    return { model: BUCKET_DEFAULT[bucket], fallback: [] }
  }

  // Explicit per-request model (e.g. a user-facing sonnet/opus tier picker in
  // X Studio repurpose). Supersedes the env override and bucket default, but
  // still gets the automatic Claude fallback.
  if (isValidModelSlug(opts?.model)) {
    return withClaudeFallback(opts!.model!.trim())
  }

  // Concierge vulnerable-topic lane has its own knob. Checked before `fast` so a
  // sensitive turn is never downgraded to the cheap lane (safety over cost).
  if (bucket === 'concierge' && opts?.sensitive) {
    const raw = process.env[CONCIERGE_SENSITIVE_ENV]
    return withClaudeFallback(isValidModelSlug(raw) ? raw.trim() : BUCKET_DEFAULT.concierge)
  }

  // Concierge cheap opening-turn lane — its own knob, defaulting to Haiku.
  if (bucket === 'concierge' && opts?.fast) {
    const raw = process.env[CONCIERGE_FAST_ENV]
    return withClaudeFallback(isValidModelSlug(raw) ? raw.trim() : CONCIERGE_FAST_DEFAULT)
  }

  return withClaudeFallback(envOverride(bucket) ?? BUCKET_DEFAULT[bucket])
}
