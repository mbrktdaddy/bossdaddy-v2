import { NextResponse, type NextRequest } from 'next/server'
import { subscribe } from '@/lib/newsletter/subscribe'

// JSON-only subscribe endpoint, for anything off-site. Every on-site form uses
// the `subscribeFromForm` server action instead (no-JS safe, real in-place
// feedback). The form-POST branch that lived here redirected to
// `/?newsletter=…`, which no page read — the homepage signup's only "feedback"
// was a reload to the top of the homepage (continuity plan B1). It's gone; a
// form post now gets a 415 rather than a silent bounce.

const STATUS = { invalid: 400, rate_limited: 429, server: 500 } as const

export async function POST(request: NextRequest) {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 415 })
  }
  const body = await request.json().catch(() => ({}))
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'

  const result = await subscribe(
    {
      email: typeof body.email === 'string' ? body.email : '',
      intent: body.intent === 'notify' ? 'notify' : 'digest',
      topic: typeof body.topic === 'string' ? body.topic : undefined,
      interests: Array.isArray(body.interests) ? body.interests.filter((i: unknown) => typeof i === 'string') : undefined,
    },
    { ip },
  )

  return result.ok
    ? NextResponse.json({ success: true, alreadySubscribed: result.already })
    : NextResponse.json({ error: result.error }, { status: STATUS[result.code] })
}
