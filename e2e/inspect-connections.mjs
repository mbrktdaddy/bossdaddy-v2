// Current relationship state between the three fixture accounts.
// Run: node --env-file=.env.local e2e/inspect-connections.mjs
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
const fixture = users.users.filter((u) => /^bd-verify-[abc]@example\.com$/.test(u.email ?? ''))
const name = (id) => fixture.find((u) => u.id === id)?.email?.replace('bd-verify-', '').replace('@example.com', '') ?? id.slice(0, 8)
const ids = fixture.map((u) => u.id)

const { data: conns } = await admin
  .from('user_connections').select('*')
  .or(`user_a.in.(${ids.join(',')}),user_b.in.(${ids.join(',')})`)

console.log('CONNECTIONS')
for (const c of conns ?? []) {
  console.log(`  ${name(c.user_a)} ↔ ${name(c.user_b)}  ${c.status.padEnd(9)} requested_by=${name(c.requester_id)} declines=${c.decline_count}`)
}

const { data: blocks } = await admin
  .from('user_blocks').select('*').in('blocker_id', ids)
console.log('BLOCKS')
for (const b of blocks ?? []) console.log(`  ${name(b.blocker_id)} blocked ${name(b.blocked_id)}`)
if (!blocks?.length) console.log('  (none)')
