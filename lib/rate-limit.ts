import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import * as Sentry from '@sentry/nextjs'

// Falls back to no-op if Upstash env vars are missing (local dev without Redis).
function hasUpstash() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

// $-budget guards: the autonomous radar cron + the anonymous / priciest AI
// paths. For these, a missing/unreachable limiter must FAIL CLOSED — skipping a
// cron run or blocking one anonymous call is far cheaper than letting an
// uncapped path burn the Anthropic/OpenAI budget (the radar cron fires
// web_search, the priciest call in the stack, with no human waiting). Every
// other type fails open so local dev without Redis still works. See audit
// 2026-07-19 (rate limiter fails open on the budget cron).
const FAIL_CLOSED_TYPES = new Set(['radar', 'boss-anon', 'boss-research'])

const limiters: Record<string, Ratelimit | null> = {}

function getLimiter(type: string): Ratelimit | null {
  if (!hasUpstash()) return null
  if (limiters[type]) return limiters[type]!

  const redis = Redis.fromEnv()
  const configs: Record<string, Ratelimit> = {
    draft:             new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10,  '1 h'),  prefix: 'bd_draft' }),
    submit:            new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,   '1 h'),  prefix: 'bd_submit' }),
    refine:            new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20,  '1 h'),  prefix: 'bd_refine' }),
    newsletter:        new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,   '1 h'),  prefix: 'bd_newsletter' }),
    view:              new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 m'),  prefix: 'bd_view' }),
    // Affiliate click redirect — protects associate account from bot click patterns.
    // Real humans rarely click 30 affiliate links per minute; bots routinely do.
    click:             new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30,  '1 m'),  prefix: 'bd_click' }),
    // Collection intro generation + refine — short prompts, smaller token spend
    // than full review/guide drafts, so a higher cap than `draft` is fine.
    'collection-intro': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 h'), prefix: 'bd_collection_intro' }),
    // One-shot fill of per-pick blurbs, role labels, and flavor-specific FAQs.
    // Higher token spend than intro because it returns multiple structured pieces,
    // but still a tight prompt so 15/hr is plenty for editing flow.
    'collection-fill':  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(15, '1 h'), prefix: 'bd_collection_fill' }),
    // Auxiliary Claude endpoints (seo-meta, social-copy, suggest-*, alt-text) —
    // cheap prompts, but they all hit the Anthropic API, so cap per author.
    'claude-aux':       new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'bd_claude_aux' }),
    // Anonymous analytics writes — keyed by IP. Generous for real users,
    // throttles flood/pollution of the affiliate-click + scroll-depth tables.
    'track':            new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'bd_track' }),
    // OpenAI image generation — the most expensive call in the stack.
    'image-gen':        new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 h'), prefix: 'bd_image_gen' }),
    // AI specs grading — uses the web_search tool (per-search cost) on top of
    // tokens, so the priciest Claude call. Author-triggered; this is a light
    // backstop, the manual button is the real throttle.
    'specs-grade':      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 h'), prefix: 'bd_specs_grade' }),
    // Voice-lexicon writes (capture/approve/edit a signature phrase). Cheap DB
    // writes, no AI call — generous cap, just a flood backstop.
    'voice':            new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 h'), prefix: 'bd_voice' }),
    // The Boss concierge — member turns. Each turn may fan out into 1-3 model
    // calls (tool round-trips), so cap by turns not raw API calls.
    'boss':             new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(40, '1 h'),  prefix: 'bd_boss' }),
    // The Boss free-taste for logged-out visitors — keyed by IP. Tight quota so
    // anonymous use drives signup and can't burn the Anthropic budget.
    'boss-anon':        new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  '24 h'), prefix: 'bd_boss_anon' }),
    // The Boss paid tier (Boss+). Generous cap; the subscription is the real gate.
    // Unused until monetization ships — defined now so the entitlements seam is typed.
    'boss-plus':        new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, '1 h'), prefix: 'bd_boss_plus' }),
    // The Boss gap-fallback research tool — fires Anthropic web_search (priciest
    // call in the stack), so a tight per-member quota on top of the turn limit.
    'boss-research':    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(8, '24 h'), prefix: 'bd_boss_research' }),
    // The Boss "notify me when tested" wait-list capture — cheap DB write,
    // flood backstop only.
    'boss-notify':      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 h'), prefix: 'bd_boss_notify' }),
    // X Studio radar cron — fires Anthropic web_search (priciest call in the
    // stack) autonomously. HARD daily run cap = the budget guard. Cron runs 1×/day;
    // the spare slots absorb manual ?secret= triggers.
    // TODO(x-studio): revert to slidingWindow(2, '24 h') once the hardened
    // web_search radar is confirmed inserting rows — temporarily 10 for testing.
    'radar':            new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '24 h'), prefix: 'bd_radar' }),
    // Merch Studio saying generation — one short Claude call per run returning a
    // batch of candidate sayings. Cheap prompt, admin-only, but hits the Anthropic
    // API so cap the batches per hour.
    'merch-sayings':    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 h'), prefix: 'bd_merch_sayings' }),
    // Merch publish — each call renders a print file + hits Printful twice
    // (create product). Admin-only; this is a flood/runaway backstop.
    'merch-publish':    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'bd_merch_publish' }),
    // Member-to-member DM sends (text via sendMessage + image via /api/dm/upload),
    // keyed by sender user id. 30/min is a fast texter; throttles spam floods and
    // scripted harassment. RLS + block checks are the real gate — this is a backstop.
    'message':          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'bd_message' }),
    // Stripe Checkout session creation (/api/checkout), keyed by user id (or IP for
    // guests). Each call hits the Stripe API; nobody legitimately checks out 10×/min,
    // so this throttles scripted session-spam without touching real buyers.
    'checkout':         new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'bd_checkout' }),
    // Printful shipment webhook — keyed by source IP. Legit traffic is a handful
    // of package_shipped events (plus Printful's own retries); a flood on the
    // public URL is either an attacker probing the shared token or a retry storm.
    // Generous cap so real bursts pass; throttles abuse of the discovered URL.
    'printful-webhook': new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m'), prefix: 'bd_printful_webhook' }),
  }

  limiters[type] = configs[type] ?? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), prefix: `bd_${type}` })
  return limiters[type]!
}

export async function checkRateLimit(
  identifier: string,
  type: 'draft' | 'submit' | 'refine' | 'newsletter' | 'view' | 'click' | 'collection-intro' | 'collection-fill' | 'claude-aux' | 'track' | 'image-gen' | 'specs-grade' | 'voice' | 'boss' | 'boss-anon' | 'boss-plus' | 'boss-research' | 'boss-notify' | 'radar' | 'merch-sayings' | 'merch-publish' | 'message' | 'checkout' | 'printful-webhook' = 'draft'
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const failClosed = FAIL_CLOSED_TYPES.has(type)
  const limiter = getLimiter(type)

  if (!limiter) {
    if (failClosed) {
      const msg = `[rate-limit] Upstash unavailable — failing CLOSED for budget guard "${type}" to protect the AI budget`
      console.error(msg)
      Sentry.captureMessage(msg, 'error')
      return { success: false, remaining: 0, reset: 0 }
    }
    // Non-budget type in an env without Redis (local dev) — allow.
    return { success: true, remaining: 999, reset: 0 }
  }

  try {
    const result = await limiter.limit(identifier)
    return {
      success:   result.success,
      remaining: result.remaining,
      reset:     result.reset,
    }
  } catch (err) {
    // Redis reachable-check passed but the call failed (network blip, quota).
    Sentry.captureException(err, { tags: { path: 'rate-limit', type, failClosed: String(failClosed) } })
    if (failClosed) {
      console.error(`[rate-limit] limiter error for budget guard "${type}" — failing CLOSED:`, err)
      return { success: false, remaining: 0, reset: 0 }
    }
    console.error(`[rate-limit] limiter error for "${type}" — failing open:`, err)
    return { success: true, remaining: 999, reset: 0 }
  }
}
