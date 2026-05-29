import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Falls back to no-op if Upstash env vars are missing (local dev without Redis).
function hasUpstash() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

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
  }

  limiters[type] = configs[type] ?? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), prefix: `bd_${type}` })
  return limiters[type]!
}

export async function checkRateLimit(
  identifier: string,
  type: 'draft' | 'submit' | 'refine' | 'newsletter' | 'view' | 'click' | 'collection-intro' | 'collection-fill' | 'claude-aux' | 'track' | 'image-gen' = 'draft'
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const limiter = getLimiter(type)
  if (!limiter) return { success: true, remaining: 999, reset: 0 }

  const result = await limiter.limit(identifier)
  return {
    success:   result.success,
    remaining: result.remaining,
    reset:     result.reset,
  }
}
