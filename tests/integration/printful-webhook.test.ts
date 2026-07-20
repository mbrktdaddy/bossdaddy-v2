import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// Synthetic Printful webhook replay (audit A3). Printful's v1 webhooks can't be
// HMAC-signed, so the endpoint is guarded by a shared secret AND — crucially —
// treats the request body as untrusted: on package_shipped it re-fetches the
// order from Printful and writes only the tracking Printful itself reports.
// These tests prove: the secret gate (constant-time, header OR query), that a
// forged/leaked-token event for an order we DON'T own spends no Printful quota,
// and that the persisted tracking comes from Printful — never from the payload.
//
// Every downstream side-effect (DB, Printful API, Sentry, rate-limit) is mocked
// so the test stays hermetic.

const SECRET = 'printful_test_secret'

const h = vi.hoisted(() => ({
  updateSpy: vi.fn(),
  getOrderSpy: vi.fn(),
  captureExceptionSpy: vi.fn(),
  captureMessageSpy: vi.fn(),
  rateLimitSpy: vi.fn(async () => ({ success: true, remaining: 99, reset: 0 })),
}))

// Lookup of OUR order by printful_order_id (the .select().eq().maybeSingle() chain).
let lookupResult: unknown = { data: { id: 'order_1' }, error: null }

function makeAdminStub() {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  Object.assign(builder, {
    select: chain,
    eq: chain,
    update: (...args: unknown[]) => {
      h.updateSpy(...args)
      return builder
    },
    maybeSingle: async () => lookupResult,
    // The update chain (.update().eq()) is awaited directly → resolves here.
    then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
  })
  return { from: () => builder }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => makeAdminStub() }))
vi.mock('@/lib/printful', () => ({ getOrder: h.getOrderSpy }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: h.rateLimitSpy }))
vi.mock('@sentry/nextjs', () => ({
  captureException: h.captureExceptionSpy,
  captureMessage: h.captureMessageSpy,
}))

let POST: (req: Request) => Promise<Response>

beforeAll(async () => {
  process.env.PRINTFUL_WEBHOOK_SECRET = SECRET
  ;({ POST } = await import('@/app/api/webhooks/printful/route'))
})

beforeEach(() => {
  h.updateSpy.mockClear()
  h.getOrderSpy.mockClear()
  h.captureExceptionSpy.mockClear()
  h.captureMessageSpy.mockClear()
  h.rateLimitSpy.mockClear()
  h.rateLimitSpy.mockResolvedValue({ success: true, remaining: 99, reset: 0 })
  lookupResult = { data: { id: 'order_1' }, error: null }
  // Default: Printful reports one shipment with the REAL tracking.
  h.getOrderSpy.mockResolvedValue({
    shipments: [{ tracking_number: 'REAL123', tracking_url: 'https://track/REAL123', carrier: 'USPS' }],
  })
})

const shipEvent = () =>
  JSON.stringify({ type: 'package_shipped', data: { order: { id: 555 } } })

function req(body: string, opts: { token?: string; header?: string } = {}) {
  const url = opts.token
    ? `http://localhost/api/webhooks/printful?token=${opts.token}`
    : 'http://localhost/api/webhooks/printful'
  const headers: Record<string, string> = {}
  if (opts.header) headers['x-printful-token'] = opts.header
  return new Request(url, { method: 'POST', body, headers })
}

describe('POST /api/webhooks/printful', () => {
  it('rejects a request with no token (403)', async () => {
    const res = await POST(req(shipEvent()))
    expect(res.status).toBe(403)
    expect(h.getOrderSpy).not.toHaveBeenCalled()
    expect(h.updateSpy).not.toHaveBeenCalled()
  })

  it('rejects a wrong token (403)', async () => {
    const res = await POST(req(shipEvent(), { token: 'attacker' }))
    expect(res.status).toBe(403)
    expect(h.updateSpy).not.toHaveBeenCalled()
  })

  it('accepts the correct token via query string (200)', async () => {
    const res = await POST(req(shipEvent(), { token: SECRET }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
  })

  it('accepts the correct token via x-printful-token header (200)', async () => {
    const res = await POST(req(shipEvent(), { header: SECRET }))
    expect(res.status).toBe(200)
  })

  it('persists the tracking Printful reports, never the payload body', async () => {
    // Payload carries no tracking at all; the truth comes from getOrder().
    await POST(req(shipEvent(), { token: SECRET }))
    expect(h.getOrderSpy).toHaveBeenCalledWith(555)
    expect(h.updateSpy).toHaveBeenCalledTimes(1)
    expect(h.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'shipped',
        tracking_number: 'REAL123',
        tracking_url: 'https://track/REAL123',
        carrier: 'USPS',
      }),
    )
  })

  it('ignores an event for an order we do not own — no Printful call, no write', async () => {
    lookupResult = { data: null, error: null }
    const res = await POST(req(shipEvent(), { token: SECRET }))
    expect(res.status).toBe(200)
    expect(h.getOrderSpy).not.toHaveBeenCalled()
    expect(h.updateSpy).not.toHaveBeenCalled()
  })

  it('does not fabricate tracking when Printful reports no shipment yet', async () => {
    h.getOrderSpy.mockResolvedValueOnce({ shipments: [] })
    const res = await POST(req(shipEvent(), { token: SECRET }))
    expect(res.status).toBe(200)
    expect(h.updateSpy).not.toHaveBeenCalled()
    expect(h.captureMessageSpy).toHaveBeenCalled()
  })

  it('rate-limits floods on the public URL (429)', async () => {
    h.rateLimitSpy.mockResolvedValueOnce({ success: false, remaining: 0, reset: 0 })
    const res = await POST(req(shipEvent(), { token: SECRET }))
    expect(res.status).toBe(429)
    expect(h.getOrderSpy).not.toHaveBeenCalled()
  })

  it('ignores non-shipment event types', async () => {
    const res = await POST(
      req(JSON.stringify({ type: 'order_created', data: {} }), { token: SECRET }),
    )
    expect(res.status).toBe(200)
    expect(h.getOrderSpy).not.toHaveBeenCalled()
    expect(h.updateSpy).not.toHaveBeenCalled()
  })
})
