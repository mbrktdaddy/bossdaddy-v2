import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyUnsubscribe, UNSUBSCRIBE_PAGE_PATH } from '@/lib/newsletter/unsubscribe-token'

// Newsletter unsubscribe (continuity-fix-plan B7).
//
// GET NEVER MUTATES. Gmail prefetch and Outlook SafeLinks fetch every link in a
// message, and the old GET deleted the row — subscribers fell off the list without
// clicking, and anyone could unsubscribe anyone by typing a URL. GET now only
// redirects to the confirmation page, preserving `email`/`token`, so links in
// emails already sent keep working. POST performs the delete.
//
// Three ways in, in descending trust:
//   one-click  RFC 8058 — a mail client POSTs `List-Unsubscribe=One-Click` to the
//              URL from the digest's List-Unsubscribe header (email + token in the
//              query). No human, no redirect, so it REQUIRES a verified token.
//   signed     the confirm-page form (or JSON) carrying a verified token.
//   legacy     the confirm-page form with a raw email and no token — mail sent
//              before signing existed. The human clicking "Unsubscribe" is the
//              deliberate step; the form's `confirm=1` marks that contract. This
//              is forgeable by anyone who can POST, and that is accepted until the
//              old emails age out (the plan's call) — it is never reachable by GET.
//
// Whether an address was subscribed is never revealed: a delete that matches no
// row answers exactly like one that matched.

const EmailSchema = z.string().trim().max(320).email()

type Mode = 'one-click' | 'json' | 'form'

/** String fields from a JSON or form body, falling back to the URL query. */
async function readFields(request: NextRequest, mode: Mode) {
  const body: Record<string, string> = {}

  if (mode === 'json') {
    const json: unknown = await request.json().catch(() => null)
    if (json && typeof json === 'object') {
      for (const [k, v] of Object.entries(json)) if (typeof v === 'string') body[k] = v
    }
  } else {
    const form = await request.formData().catch(() => null)
    form?.forEach((v, k) => { if (typeof v === 'string') body[k] = v })
  }

  const query = request.nextUrl.searchParams
  return {
    email:   body.email ?? query.get('email') ?? '',
    token:   body.token ?? query.get('token') ?? '',
    confirm: body.confirm === '1',
    oneClickMarker: body['List-Unsubscribe'] === 'One-Click',
  }
}

/** Back to the confirm page (303 so the browser follows with a GET, not a re-POST). */
function backToPage(request: NextRequest, params: Record<string, string>) {
  const url = new URL(UNSUBSCRIBE_PAGE_PATH, request.url)
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v)
  return NextResponse.redirect(url, 303)
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''
  // Decide the mode from the content type first so we know how to read the body;
  // the one-click marker lives IN the form body, so refine after reading it.
  const initialMode: Mode = contentType.includes('application/json') ? 'json' : 'form'
  const fields = await readFields(request, initialMode)
  const mode: Mode = fields.oneClickMarker ? 'one-click' : initialMode
  const isApi = mode !== 'form'

  const invalid = () => isApi
    ? NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 })
    : backToPage(request, { error: 'invalid' })

  const parsed = EmailSchema.safeParse(fields.email)
  if (!parsed.success) return invalid()
  const email = parsed.data

  const trust = classifyUnsubscribe(email, fields.token)
  if (trust === 'invalid') return invalid()
  // One-click has no human step, so only a verified token may drive it.
  if (mode === 'one-click' && trust !== 'signed') return invalid()
  // Legacy raw-email links are honoured only from the confirm-page form.
  if (trust === 'legacy' && !(mode === 'form' && fields.confirm)) return invalid()

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('newsletter_subscribers')
    .delete()
    .eq('email', email)

  if (error) {
    // Surface it: answering "you're off the list" on a failed delete means the
    // next digest lands in an inbox that asked to be removed.
    console.error('[newsletter-unsubscribe] delete failed:', error.message)
    return isApi
      ? NextResponse.json({ error: 'Could not unsubscribe. Try again.' }, { status: 500 })
      : backToPage(request, { error: 'server', email, token: trust === 'signed' ? fields.token : '' })
  }

  return isApi
    ? NextResponse.json({ success: true }, { status: 200 })
    : backToPage(request, { done: '1' })
}

// GET /api/newsletter/unsubscribe?email=…&token=… — links in emails already sent.
// Redirect only; the delete needs a POST from the confirm page.
export function GET(request: NextRequest) {
  const url = new URL(UNSUBSCRIBE_PAGE_PATH, request.url)
  for (const key of ['email', 'token']) {
    const value = request.nextUrl.searchParams.get(key)
    if (value) url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url)
}
