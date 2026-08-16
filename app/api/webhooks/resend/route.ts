// Resend webhook — bounce and complaint feedback loop.
//
// Before this existed the site had no idea when mail failed: hard bounces were
// re-attempted by the next cron pass and spam complaints were entirely
// invisible. Authentication (SPF/DKIM/DMARC) was already correct — this closes
// the reputation half.
//
// Resend signs webhooks with the Svix scheme. resend@6.18.0 ships verification
// built in (`resend.webhooks.verify`), so no separate `svix` dependency.
//
// Configure at https://resend.com/webhooks with events:
//   email.bounced, email.complained, email.suppressed
// then put the signing secret in RESEND_WEBHOOK_SECRET.
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getResend } from '@/lib/resend'
import { recordSuppression, isPermanentBounce } from '@/lib/email-suppression'

// Shape of the events we act on. Resend's own types are a broad union; narrowing
// locally keeps the handler readable without casting at every access.
interface BaseData {
  email_id: string
  to: string[]
  subject: string
  from: string
  created_at: string
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // Fail closed on config: without the secret we cannot tell a real Resend
    // delivery from a forged one, and this endpoint writes to a table that can
    // block all outbound mail. 500 (not 400) so Resend retries after the env
    // var is set, rather than discarding the event.
    console.error('[resend webhook] RESEND_WEBHOOK_SECRET is unset — rejecting')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Raw body — the signature covers the exact bytes, so this must not be parsed
  // and re-serialized first.
  const payload = await request.text()

  // verify() takes Resend's own {id, timestamp, signature} object — NOT the raw
  // Request.headers (they share the name `Headers`, which makes the mismatch
  // invisible until tsc complains). Svix emits the `svix-*` names; the Standard
  // Webhooks spec it's based on uses `webhook-*`, so accept either.
  const pick = (svix: string, std: string) => request.headers.get(svix) ?? request.headers.get(std)

  const id        = pick('svix-id', 'webhook-id')
  const timestamp = pick('svix-timestamp', 'webhook-timestamp')
  const signature = pick('svix-signature', 'webhook-signature')

  if (!id || !timestamp || !signature) {
    // Not a signed delivery at all — terminal, don't retry.
    console.warn('[resend webhook] missing signature headers — rejecting')
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 })
  }

  let event: { type: string; data: unknown }
  try {
    event = getResend().webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    }) as { type: string; data: unknown }
  } catch (err) {
    // Invalid signature or replayed timestamp. 400 is terminal in Svix — a
    // forged request should not be retried.
    console.warn('[resend webhook] signature verification failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'email.bounced': {
        const data = event.data as BaseData & { bounce: { type: string; subType: string; message: string } }
        const { type, subType, message } = data.bounce

        // Only a Permanent bounce means the address is dead. A Transient bounce
        // (mailbox full, throttled) must not suppress — locking a real dad out
        // of his own order confirmations because his inbox filled up would be a
        // self-inflicted product bug.
        if (!isPermanentBounce(type)) {
          console.log(
            `[resend webhook] transient bounce (${type}/${subType}) for ${data.to.join(', ')} — not suppressing`,
          )
          break
        }

        await suppressAll(data, 'bounce', { bounceType: type, bounceSubtype: subType, detail: message })
        console.log(`[resend webhook] suppressed ${data.to.length} address(es) — permanent bounce (${subType})`)
        break
      }

      case 'email.complained': {
        // "Mark as spam". Always suppresses — this is the single strongest
        // negative signal a mailbox provider gives you. Critical transactional
        // mail still gets through; see suppressionBlocks() in
        // lib/email-suppression.ts for that carve-out.
        const data = event.data as BaseData
        await suppressAll(data, 'complaint', { detail: 'Recipient marked the message as spam' })
        console.log(`[resend webhook] suppressed ${data.to.length} address(es) — complaint`)
        break
      }

      case 'email.suppressed': {
        // Resend blocked a send against its OWN suppression list. Mirroring it
        // locally stops us burning API calls on an address Resend will refuse
        // anyway. Recorded as 'bounce' because Resend suppresses for hard
        // bounces and complaints — i.e. it blocks everything, same as ours.
        const data = event.data as BaseData & { suppressed: { type: string; message: string } }
        await suppressAll(data, 'bounce', {
          bounceType: 'Permanent',
          bounceSubtype: data.suppressed.type,
          detail: `Blocked by Resend's suppression list: ${data.suppressed.message}`,
        })
        console.log(`[resend webhook] mirrored Resend suppression for ${data.to.join(', ')}`)
        break
      }

      default:
        // Unsubscribed event type (email.sent, email.delivered, …). Return 2xx
        // so Resend does not retry something we deliberately ignore.
        break
    }
  } catch (err) {
    console.error(`[resend webhook] ${event.type} handling failed:`, err)
    Sentry.captureException(err, { tags: { path: 'resend.webhook' }, extra: { eventType: event.type } })
    // 500 → Resend retries. A dropped bounce is a permanently un-suppressed dead
    // address, so retrying is the behaviour we want.
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Suppression write failed', message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

/**
 * Resend delivers `to` as an array. Suppress every address on the message —
 * a bounce for one recipient of a multi-recipient send still means that one
 * address is bad. Sequential rather than Promise.all: the RPC increments
 * event_count on conflict, and concurrent upserts of the SAME address inside one
 * event would be a pointless row-lock fight.
 */
async function suppressAll(
  data: BaseData,
  reason: 'bounce' | 'complaint',
  extra: { bounceType?: string; bounceSubtype?: string; detail?: string },
) {
  for (const addr of data.to ?? []) {
    await recordSuppression({
      email: addr,
      reason,
      bounceType: extra.bounceType ?? null,
      bounceSubtype: extra.bounceSubtype ?? null,
      detail: extra.detail ?? null,
      emailId: data.email_id,
      subject: data.subject,
    })
  }
}
