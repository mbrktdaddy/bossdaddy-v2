import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import Stripe from 'stripe'

// Synthetic Stripe webhook replay (audit C2). The webhook is the money path's
// front door: it must (1) reject any body that isn't HMAC-signed with our
// secret, and (2) be idempotent — Stripe delivers at-least-once, so a replayed
// checkout.session.completed must NOT create a second order.
//
// We sign real payloads with a test secret via Stripe's own
// generateTestHeaderString (same HMAC the SDK verifies), and mock every
// downstream side-effect so the test stays hermetic — no DB, Printful, Resend,
// or Sentry calls leave the process.

const WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests'

// Spies the mock factories reference (must be hoisted alongside vi.mock).
const h = vi.hoisted(() => ({
  insertSpy: vi.fn(),
  createOrderSpy: vi.fn(),
  sendEmailSpy: vi.fn(async () => ({ ok: true as const })),
  captureExceptionSpy: vi.fn(),
}))

// Chainable Supabase query-builder stub. Every terminal (maybeSingle/single/
// await) resolves to `result`; insert is spied so we can assert non-duplication.
function makeAdminStub(result: unknown) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  Object.assign(builder, {
    select: chain,
    update: chain,
    delete: chain,
    eq: chain,
    insert: (...args: unknown[]) => {
      h.insertSpy(...args)
      return builder
    },
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  })
  return { from: () => builder }
}

// Default: the idempotency lookup finds an existing order (the replay case).
let adminResult: unknown = { data: { id: 'order_existing' }, error: null }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdminStub(adminResult),
}))
vi.mock('@/lib/printful', () => ({
  createOrder: h.createOrderSpy,
  deleteOrder: vi.fn(),
}))
vi.mock('@/lib/order-emails', () => ({
  sendOrderConfirmationEmail: h.sendEmailSpy,
}))
vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({
  captureException: h.captureExceptionSpy,
}))

let POST: (req: Request) => Promise<Response>
let signer: Stripe

beforeAll(async () => {
  // @/lib/stripe constructs `new Stripe(STRIPE_SECRET_KEY!)` at import time.
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  signer = new Stripe('sk_test_dummy')
  // Dynamic import so the env is set before the module graph evaluates.
  ;({ POST } = await import('@/app/api/webhooks/stripe/route'))
})

beforeEach(() => {
  h.insertSpy.mockClear()
  h.createOrderSpy.mockClear()
  h.sendEmailSpy.mockClear()
  h.captureExceptionSpy.mockClear()
  adminResult = { data: { id: 'order_existing' }, error: null }
})

function makeEvent() {
  return JSON.stringify({
    id: 'evt_test_1',
    object: 'event',
    api_version: '2026-04-22',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_replay_123', metadata: { cart_id: 'cart_1' } } },
  })
}

function signedRequest(body: string, secret = WEBHOOK_SECRET) {
  const sig = signer.webhooks.generateTestHeaderString({ payload: body, secret })
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': sig },
  })
}

describe('POST /api/webhooks/stripe', () => {
  it('rejects a request with no signature header (400)', async () => {
    const res = await POST(
      new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: makeEvent() }),
    )
    expect(res.status).toBe(400)
    expect(h.insertSpy).not.toHaveBeenCalled()
  })

  it('rejects a body signed with the wrong secret (400)', async () => {
    const res = await POST(signedRequest(makeEvent(), 'whsec_attacker_secret'))
    expect(res.status).toBe(400)
    expect(h.insertSpy).not.toHaveBeenCalled()
  })

  it('rejects a tampered body whose signature no longer matches (400)', async () => {
    const body = makeEvent()
    const req = signedRequest(body) // signature computed over the original body
    const tampered = new Request(req.url, {
      method: 'POST',
      body: body.replace('cart_1', 'cart_hacked'),
      headers: { 'stripe-signature': req.headers.get('stripe-signature')! },
    })
    const res = await POST(tampered)
    expect(res.status).toBe(400)
    expect(h.insertSpy).not.toHaveBeenCalled()
  })

  it('accepts a validly-signed event', async () => {
    const res = await POST(signedRequest(makeEvent()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
  })

  it('is idempotent on replay — a duplicate delivery creates no second order', async () => {
    // Deliver the same signed event twice; the idempotency lookup finds the
    // existing order both times, so no order insert ever fires.
    await POST(signedRequest(makeEvent()))
    await POST(signedRequest(makeEvent()))
    expect(h.insertSpy).not.toHaveBeenCalled()
    expect(h.createOrderSpy).not.toHaveBeenCalled()
    expect(h.sendEmailSpy).not.toHaveBeenCalled()
  })
})
