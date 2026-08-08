// Throwaway verification accounts for the goals browser pass.
// Run: node --env-file=.env.local e2e/setup-accounts.mjs [--teardown]
//
// Creates two confirmed users straight through the admin API rather than the
// signup form, so nothing depends on email confirmation. These are real rows in
// the production Supabase project — --teardown removes them.

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export const ACCOUNTS = [
  { email: 'bd-verify-a@example.com', password: 'VerifyPass!A1', name: 'Verify Owner' },
  { email: 'bd-verify-b@example.com', password: 'VerifyPass!B1', name: 'Verify Partner' },
  // C exists specifically to be a STRANGER. A and B were grandfathered into an
  // accepted connection by migration 140 (they had a DM fixture), so neither can
  // exercise request → accept from a clean slate. C never gets a DM thread.
  { email: 'bd-verify-c@example.com', password: 'VerifyPass!C1', name: 'Verify Stranger' },
]

async function findByEmail(email) {
  // listUsers has no email filter in v2; the set is small enough to page once.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((u) => u.email === email) ?? null
}

async function create() {
  for (const acct of ACCOUNTS) {
    const existing = await findByEmail(acct.email)
    if (existing) {
      console.log(`exists  ${acct.email}  ${existing.id}`)
      continue
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: acct.email,
      password: acct.password,
      email_confirm: true,
      user_metadata: { display_name: acct.name },
    })
    if (error) throw new Error(`${acct.email}: ${error.message}`)
    console.log(`created ${acct.email}  ${data.user.id}`)
  }

  // Did the profile trigger fire? A missing profile breaks the partner's name on
  // the share page, which is exactly the sort of thing this pass is looking for.
  for (const acct of ACCOUNTS) {
    const u = await findByEmail(acct.email)
    const { data: p } = await admin
      .from('profiles')
      .select('id, username, display_name, role, account_status')
      .eq('id', u.id)
      .maybeSingle()
    console.log(`profile ${acct.email}`, p ?? 'MISSING')
  }
}

/**
 * A DM thread between the two accounts, so the share page's "someone you already
 * talk to" picker has a name in it. A DM is the only contact relationship the app
 * models, so without one the picker correctly renders nothing.
 *
 * dm_key mirrors get_or_create_dm (migration 083): least:greatest of the two ids.
 * UNIQUE on that column makes this idempotent.
 */
async function ensureDm() {
  const [a, b] = await Promise.all(ACCOUNTS.slice(0, 2).map((x) => findByEmail(x.email)))
  if (!a || !b) throw new Error('run without --dm first to create the accounts')

  const key = [a.id, b.id].sort().join(':')
  const { data: existing } = await admin
    .from('conversations').select('id').eq('dm_key', key).maybeSingle()
  if (existing) { console.log(`dm      exists ${existing.id}`); return }

  const { data: conv, error } = await admin
    .from('conversations').insert({ dm_key: key }).select('id').single()
  if (error) throw error
  await admin.from('conversation_participants').insert([
    { conversation_id: conv.id, user_id: a.id },
    { conversation_id: conv.id, user_id: b.id },
  ])
  await admin.from('messages').insert({
    conversation_id: conv.id, sender_id: a.id, body: 'e2e fixture thread',
  })
  console.log(`dm      created ${conv.id}`)
}

/**
 * Reset to the fixture's baseline: A and B connected (as migration 140's
 * grandfathering left them), C a stranger to both, no leftover E2E goals.
 *
 * The connection tests mutate relationships, so without this a second run starts
 * from wherever the first one finished.
 */
async function clean() {
  const found = []
  for (const acct of ACCOUNTS) {
    const u = await findByEmail(acct.email)
    if (!u) continue
    found.push({ ...acct, id: u.id })
    const { data, error } = await admin
      .from('goals').delete().eq('user_id', u.id).like('title', 'E2E %').select('id')
    console.log(error ? `FAILED  ${acct.email}: ${error.message}` : `removed ${data.length} E2E goals from ${acct.email}`)
  }

  const ids = found.map((f) => f.id)
  if (ids.length) {
    await admin.from('user_blocks').delete().in('blocker_id', ids)
    await admin.from('user_connections').delete().or(
      `user_a.in.(${ids.join(',')}),user_b.in.(${ids.join(',')})`,
    )
    console.log('cleared blocks + connections between the fixture accounts')
  }

  const a = found.find((f) => f.email.includes('-a@'))
  const b = found.find((f) => f.email.includes('-b@'))
  if (a && b) {
    const [user_a, user_b] = [a.id, b.id].sort()
    await admin.from('user_connections').insert({
      user_a, user_b, requester_id: user_a,
      status: 'accepted', accepted_at: new Date().toISOString(),
    })
    console.log('restored the A↔B connection (grandfathered baseline)')
  }
}

async function teardown() {
  for (const acct of ACCOUNTS) {
    const u = await findByEmail(acct.email)
    if (!u) { console.log(`gone    ${acct.email}`); continue }
    const { error } = await admin.auth.admin.deleteUser(u.id)
    console.log(error ? `FAILED  ${acct.email}: ${error.message}` : `deleted ${acct.email}`)
  }
}

await (process.argv.includes('--teardown') ? teardown()
  : process.argv.includes('--clean') ? clean()
  : process.argv.includes('--dm') ? ensureDm()
  : create().then(ensureDm))
