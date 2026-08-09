// May I put an unsolicited invite in front of this person?
//
// Three send paths grew this hole independently — savings invites by email,
// savings invites to a member id, and goal invites by email. None of them asked
// the recipient anything. `profiles.connection_requests_from = 'nobody'` and a
// block were both trivially bypassed by typing the address instead of picking the
// person, which made the setting a suggestion.
//
// So one guard, used by all three. The rules:
//
//   • A NON-MEMBER IS ALWAYS FINE. They have no preference to honour and no
//     relationship to violate — an email to someone who isn't here yet is just an
//     email.
//   • A BLOCK REFUSES, either direction, same as everywhere else.
//   • 'nobody' REFUSES. It says nobody, and "unless they know your email address"
//     is not a meaningful version of nobody.
//
// ⚠️ A REFUSAL MUST NOT BE OBSERVABLE. Telling the sender "they've opted out"
// would turn every send into a membership oracle: type an address, learn whether
// it belongs to a member here. Since this app is about recovery, medication and
// fatherhood, confirming somebody's membership to a third party is exactly the
// leak worth caring about. So callers do not surface a reason — they skip the
// send and fall back to "here's a link you can pass on", which is the same thing
// the UI shows when no address was given at all, and the same thing it shows when
// Resend fails. Indistinguishable by construction.

import 'server-only'

/** Resolve an address to a member id, or null. Exact match, normalized. */
async function memberIdForEmail(email: string): Promise<string | null> {
  const wanted = email.trim().toLowerCase()
  if (!wanted) return null
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data, error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) return null
    return data.users.find((u) => u.email?.toLowerCase() === wanted)?.id ?? null
  } catch {
    return null
  }
}

/**
 * May `senderId` send an invite to this member?
 *
 * Fails CLOSED on an error. If we can't tell whether someone opted out, not
 * sending is the recoverable mistake — the sender still gets a link to pass on,
 * whereas an email we shouldn't have sent can't be recalled.
 */
export async function mayInviteMember(
  memberId: string,
  senderId: string,
): Promise<boolean> {
  if (memberId === senderId) return false
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()

    const [{ data: profile }, { data: blocks }] = await Promise.all([
      admin.from('profiles').select('connection_requests_from').eq('id', memberId).maybeSingle(),
      admin.from('user_blocks').select('blocker_id').or(
        `and(blocker_id.eq.${memberId},blocked_id.eq.${senderId}),` +
        `and(blocker_id.eq.${senderId},blocked_id.eq.${memberId})`,
      ),
    ])

    if ((blocks ?? []).length > 0) return false
    return (profile as { connection_requests_from?: string } | null)?.connection_requests_from !== 'nobody'
  } catch (err) {
    console.error('invite guard: member check failed, refusing to send —', err)
    return false
  }
}

/**
 * May `senderId` email this address?
 *
 * True for any address that isn't a member's — see the header. For a member's
 * address it defers to mayInviteMember, so typing the email and picking the
 * person land on exactly the same answer.
 */
export async function mayInviteEmail(
  email: string,
  senderId: string,
): Promise<boolean> {
  const memberId = await memberIdForEmail(email)
  if (!memberId) return true
  return mayInviteMember(memberId, senderId)
}
