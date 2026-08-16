import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export interface PurgeResult {
  storageRemoved: number
  rowsRemoved: number
  failures: string[]
}

/**
 * Everything a hard account delete has to remove that foreign keys will not.
 *
 * `auth.admin.deleteUser()` drops the auth.users row and the FK graph handles
 * the rest — profiles, comments, votes, goals, messages. Two categories fall
 * outside that graph entirely:
 *
 *   1. STORAGE OBJECTS. There is no FK from a Postgres row to a storage object,
 *      so files simply stay. Worse, the row holding the only reference to the
 *      path is what cascades away — after the delete, nothing in the system
 *      knows the file exists. A member's child's photo remained live and
 *      anonymously readable at a stable URL in the public `avatars` bucket,
 *      indefinitely, while the user received an email saying all associated
 *      data had been permanently removed (emails/AccountStatusEmail.tsx:76).
 *
 *   2. EMAIL-KEYED ROWS. `newsletter_subscribers` has no `user_id` at all
 *      (003), so it survives and the digest keeps mailing a deleted account.
 *      `tool_email_subscriptions` has a cascading `user_id`, but rows created
 *      anonymously leave it null and key on `email` only — those survive too.
 *
 * MUST BE CALLED BEFORE `deleteUser`. Every path this collects lives on a row
 * that the cascade destroys: `kid_profiles` for kid photo folders,
 * `messages.attachment_path` for DM media. Afterwards they are unrecoverable.
 *
 * Never throws. A storage failure must not abort a batch delete or, worse,
 * leave the account half-deleted — the caller records `failures` and proceeds.
 * Audit findings #3, #23 (partly), #25, #33, #54 — docs/audit-2026-08-16.md.
 */
export async function purgeUserData(
  admin: Admin,
  opts: { userId: string; email: string | null }
): Promise<PurgeResult> {
  const { userId, email } = opts
  const result: PurgeResult = { storageRemoved: 0, rowsRemoved: 0, failures: [] }

  const removeFrom = async (bucket: string, paths: string[], label: string) => {
    if (paths.length === 0) return
    const { error } = await admin.storage.from(bucket).remove(paths)
    if (error) result.failures.push(`${label}: ${error.message}`)
    else result.storageRemoved += paths.length
  }

  // Storage does not expose "delete this folder" — list, then remove by path.
  const listFolder = async (bucket: string, folder: string, label: string): Promise<string[]> => {
    const { data, error } = await admin.storage.from(bucket).list(folder)
    if (error) { result.failures.push(`${label} list: ${error.message}`); return [] }
    return (data ?? []).map((f) => `${folder}/${f.name}`)
  }

  // ── 1. Profile avatar — `avatars/{user_id}/…` (migration 061) ──────────────
  await removeFrom('avatars', await listFolder('avatars', userId, 'avatar'), 'avatar')

  // ── 2. Family-member photos — private `family-photos` bucket (mig 151) ────
  // Read the ids first: kid_profiles cascades from profiles, which cascades
  // from auth.users, so after deleteUser there is no record these folders exist.
  const { data: kids, error: kidsErr } = await admin
    .from('kid_profiles')
    .select('id')
    .eq('user_id', userId)
  if (kidsErr) result.failures.push(`kid_profiles query: ${kidsErr.message}`)

  for (const kid of kids ?? []) {
    await removeFrom(
      'family-photos',
      await listFolder('family-photos', kid.id, `family photo ${kid.id}`),
      `family photo ${kid.id}`,
    )
  }

  // ── 3. DM attachments — private `dm-media` bucket (migration 094) ──────────
  // `messages.sender_id` cascades from auth.users (083:36), so the rows holding
  // these paths disappear with the user.
  const { data: attachments, error: attachErr } = await admin
    .from('messages')
    .select('attachment_path')
    .eq('sender_id', userId)
    .not('attachment_path', 'is', null)
  if (attachErr) result.failures.push(`messages query: ${attachErr.message}`)

  const attachmentPaths = (attachments ?? [])
    .map((m) => m.attachment_path)
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
  await removeFrom('dm-media', attachmentPaths, 'dm-media')

  // ── 4. Email-keyed rows with no FK back to the user ───────────────────────
  if (email) {
    const { error: newsErr, count: newsCount } = await admin
      .from('newsletter_subscribers')
      .delete({ count: 'exact' })
      .eq('email', email)
    if (newsErr) result.failures.push(`newsletter_subscribers: ${newsErr.message}`)
    else result.rowsRemoved += newsCount ?? 0

    // Rows with a user_id cascade on their own; these are the anonymous ones
    // that only ever knew the address.
    const { error: toolErr, count: toolCount } = await admin
      .from('tool_email_subscriptions')
      .delete({ count: 'exact' })
      .eq('email', email)
      .is('user_id', null)
    if (toolErr) result.failures.push(`tool_email_subscriptions: ${toolErr.message}`)
    else result.rowsRemoved += toolCount ?? 0
  }

  return result
}
