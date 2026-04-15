import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Token bucket: 10 Claude draft requests per user per hour.
// Falls back to no-op if Upstash env vars are missing (local dev without Redis).
let _ratelimit: Ratelimit | null = null

export function getRateLimiter(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null // dev fallback — no rate limiting
  }
  if (!_ratelimit) {
    _ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.tokenBucket(10, '1 h', 10),
      analytics: false,
      prefix: 'bd_claude',
    })
  }
  return _ratelimit
}

export async function checkRateLimit(
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const limiter = getRateLimiter()
  if (!limiter) return { success: true, remaining: 999, reset: 0 }

  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  }
}
