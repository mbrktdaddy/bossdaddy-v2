// What do the rate-limit keys actually look like?
// Run: node --env-file=.env.local e2e/inspect-ratelimit.mjs
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

for (const prefix of ['bd_conn_req', 'bd_goal_invite', 'bd_member_search']) {
  const keys = await redis.keys(`${prefix}*`)
  console.log(`${prefix}: ${keys.length} key(s)`)
  for (const k of keys.slice(0, 6)) console.log(`   ${k}  =`, await redis.get(k))
}
