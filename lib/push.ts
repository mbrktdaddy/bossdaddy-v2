// Server-only web-push sender. The immediacy layer for new-message
// notifications (the debounced email is the slow fallback).
//
// Graceful by design: if VAPID env vars are unset (e.g. before keys are added
// in Vercel), every send is a silent no-op — push is simply inactive and
// nothing breaks. Dead subscriptions (404/410 from the push service) are
// pruned on send so the table self-heals.

import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:boss@bossdaddylife.com'

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body?: string
  /** In-app path to open on click, e.g. /account/messages/<id>. */
  url?: string
  /** Collapses repeat notifications (e.g. per conversation). */
  tag?: string
}

export interface PushResult {
  /** False when VAPID isn't configured or the user has no live subscriptions. */
  attempted: boolean
  /** Devices that accepted the push. */
  delivered: number
  /** Dead subscriptions removed during this send (404/410). */
  pruned: number
  /** Devices that failed for some other reason. */
  failed: number
}

/**
 * Send a push to every device the user has subscribed. Best-effort — never
 * throws, so callers (message send) can fire-and-forget without risking their
 * main flow. Prunes subscriptions the push service reports as gone.
 *
 * Returns a summary so callers that DO care can act on it: the goals sweep
 * records the outcome in `goal_deliveries` and falls back to email when push
 * reached nobody. Push subscriptions die silently — revoked permission, an
 * unregistered service worker, an expired endpoint — so a reminder system that
 * treats "sent" as "delivered" quietly stops working in month three.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  const idle: PushResult = { attempted: false, delivered: 0, pruned: 0, failed: 0 }
  if (!ensureConfigured()) return idle
  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (!subs?.length) return idle

  const json = JSON.stringify(payload)
  const result: PushResult = { attempted: true, delivered: 0, pruned: 0, failed: 0 }
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        )
        result.delivered++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          // Subscription expired/unsubscribed — remove it so we stop trying.
          await admin.from('push_subscriptions').delete().eq('id', s.id)
          result.pruned++
        } else {
          console.error('web-push send failed:', status, (err as Error).message)
          result.failed++
        }
      }
    }),
  )
  return result
}
