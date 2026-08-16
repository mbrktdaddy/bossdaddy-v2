// Email suppression list — server-only.
//
// Reads and writes the `email_suppressions` table (migration 153). The Resend
// webhook (app/api/webhooks/resend/route.ts) writes; sendEmail() (lib/email.ts)
// reads before every send.
//
// The whole point: a mailbox provider scores you on whether you STOP mailing
// addresses that reject you. Retrying a dead address forever is what tanks a
// sender reputation — not subject-line wording.
import { createAdminClient } from '@/lib/supabase/admin'

export type SuppressionReason = 'bounce' | 'complaint' | 'manual'

export interface SuppressionRecord {
  email: string
  reason: SuppressionReason
  bounceType: string | null
  bounceSubtype: string | null
  detail: string | null
}

const normalize = (email: string) => email.trim().toLowerCase()

/**
 * Tags whose delivery is consequential enough to survive a spam complaint.
 *
 * A complaint means "stop marketing to me" — it does not mean "cancel my order
 * confirmation" or "hide the fact that your account was suspended". Blocking
 * those would break the product and, for account-status mail, remove notice the
 * user is entitled to. A HARD BOUNCE still blocks these, because the address
 * physically does not exist and sending is pure reputation damage.
 *
 * Matched as exact tag or prefix (account_suspended, account_reinstated, …).
 */
const CRITICAL_TAG_PREFIXES = ['order_confirmation', 'account_'] as const

export function isCriticalTag(tag: string): boolean {
  return CRITICAL_TAG_PREFIXES.some((p) => tag === p || tag.startsWith(p))
}

/**
 * Whether an existing suppression blocks this particular send.
 *
 * - bounce / manual → blocks everything. The address is dead or an operator
 *   explicitly killed it; "critical" does not earn an exemption.
 * - complaint       → blocks marketing, allows critical transactional.
 */
export function suppressionBlocks(rec: SuppressionRecord, critical: boolean): boolean {
  if (rec.reason === 'complaint') return !critical
  return true
}

/**
 * Look up a suppression. Returns null when the address is clear.
 *
 * FAILS OPEN: if the lookup itself errors (DB blip, missing migration), we log
 * and return null so mail still goes out. A transient database problem must not
 * silently halt every email the site sends — that failure mode is worse than
 * one extra message to a bounced address.
 */
export async function getSuppression(email: string): Promise<SuppressionRecord | null> {
  const addr = normalize(email)
  if (!addr) return null

  try {
    const admin = createAdminClient()
    // Table added post-type-gen — cast until `npm run db:types` is re-run.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from('email_suppressions')
      .select('email, reason, bounce_type, bounce_subtype, detail')
      .eq('email', addr)
      .maybeSingle()

    if (error) {
      console.error('[suppression] lookup failed — failing open', error.message)
      return null
    }
    if (!data) return null

    return {
      email:         data.email,
      reason:        data.reason as SuppressionReason,
      bounceType:    data.bounce_type ?? null,
      bounceSubtype: data.bounce_subtype ?? null,
      detail:        data.detail ?? null,
    }
  } catch (err) {
    console.error('[suppression] lookup threw — failing open', err)
    return null
  }
}

export interface RecordSuppressionArgs {
  email: string
  reason: SuppressionReason
  bounceType?: string | null
  bounceSubtype?: string | null
  detail?: string | null
  emailId?: string | null
  subject?: string | null
}

/**
 * Add or escalate a suppression. Idempotent and race-safe — the reason
 * precedence and the event_count increment both happen inside the RPC's
 * ON CONFLICT clause (see migration 153).
 *
 * Throws on failure so the webhook can return non-2xx and let Resend retry.
 */
export async function recordSuppression(args: RecordSuppressionArgs): Promise<void> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).rpc('record_email_suppression', {
    p_email:          args.email,
    p_reason:         args.reason,
    p_bounce_type:    args.bounceType ?? null,
    p_bounce_subtype: args.bounceSubtype ?? null,
    p_detail:         args.detail ?? null,
    p_email_id:       args.emailId ?? null,
    p_subject:        args.subject ?? null,
  })

  if (error) throw new Error(`record_email_suppression failed: ${error.message}`)
}

/**
 * Operator escape hatch — clears a suppression so the address can be mailed
 * again. Use after a dad fixes a full mailbox or asks to be re-subscribed.
 */
export async function releaseSuppression(email: string): Promise<void> {
  const addr = normalize(email)
  if (!addr) return

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('email_suppressions')
    .delete()
    .eq('email', addr)

  if (error) throw new Error(`releaseSuppression failed: ${error.message}`)
}

/**
 * Does this Resend bounce classification mean the address is permanently dead?
 *
 * Only 'Permanent' suppresses. 'Transient' (mailbox full, throttled) and
 * 'Undetermined' are recorded upstream for visibility but must not block a real
 * user — suppressing on a temporarily-full inbox would lock a paying dad out of
 * his own order confirmations.
 */
export function isPermanentBounce(bounceType: string | null | undefined): boolean {
  return (bounceType ?? '').toLowerCase() === 'permanent'
}
