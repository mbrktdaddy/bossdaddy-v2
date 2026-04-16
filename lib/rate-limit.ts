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
    draft:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), prefix: 'bd_draft' }),
    submit:     new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  '1 h'), prefix: 'bd_submit' }),
    newsletter: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,  '1 h'), prefix: 'bd_newsletter' }),
  }

  limiters[type] = configs[type] ?? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), prefix: `bd_${type}` })
  return limiters[type]!
}

export async function checkRateLimit(
  identifier: string,
  type: 'draft' | 'submit' | 'newsletter' = 'draft'
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
