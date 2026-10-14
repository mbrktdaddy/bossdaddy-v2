import Link from 'next/link'
import { z } from 'zod'
import { buttonVariants } from '@/components/ui/Button'
import { classifyUnsubscribe, UNSUBSCRIBE_API_PATH } from '@/lib/newsletter/unsubscribe-token'

// Newsletter unsubscribe confirmation (continuity-fix-plan B7). Every unsubscribe
// link — the digest footer, the List-Unsubscribe header's fallback, and the old
// GET /api/newsletter/unsubscribe links already sitting in inboxes — lands HERE,
// and rendering this page never touches the database. That is the point: a link
// scanner that prefetches the URL sees a form it cannot press. The button POSTs
// to the API route as a plain HTML form, so it works with no JavaScript.
//
// Same layout as /tools/email-unsubscribe (the other unsubscribe surface) so the
// two read as one. Social card allowlisted in scripts/check-og-coverage.mjs and
// noindex here — a personal, transactional page.

export const metadata = {
  title:  'Unsubscribe',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{
    email?: string | string[]
    token?: string | string[]
    done?: string | string[]
    error?: string | string[]
  }>
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const EmailSchema = z.string().trim().max(320).email()

const HEADING = 'text-2xl sm:text-3xl font-black tracking-tight'

export default async function NewsletterUnsubscribePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const done  = first(sp.done) === '1'
  const error = first(sp.error)
  const token = first(sp.token) ?? ''

  const parsed = EmailSchema.safeParse(first(sp.email) ?? '')
  const email = parsed.success ? parsed.data : null
  // `invalid` = a token that fails its signature. Missing params and bad addresses
  // land in the same friendly state below — one message, no crash, nothing leaked.
  const trust = email ? classifyUnsubscribe(email, token) : 'invalid'

  let view: 'done' | 'confirm' | 'invalid' = 'invalid'
  if (done) view = 'done'
  else if (email && trust !== 'invalid' && error !== 'invalid') view = 'confirm'

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center space-y-4">
      {view === 'done' && (
        <>
          <h1 className={HEADING}>You&apos;re off the list.</h1>
          <p className="text-prose-faint">
            No more Boss Daddy newsletters. If that was a mistake, you can sign back up any time.
          </p>
        </>
      )}

      {view === 'confirm' && email && (
        <>
          <h1 className={HEADING}>Unsubscribe from the newsletter?</h1>
          <p className="text-prose-faint">
            This takes
            {' '}
            <span className="font-semibold text-prose break-all">{email}</span>
            {' '}
            off the weekly Boss Daddy email.
          </p>
          {error === 'server' && (
            <p role="alert" className="bg-danger-bg border border-danger-line text-danger-ink text-sm rounded-xl px-4 py-3">
              Something broke on our end and nothing was changed. Give it another try.
            </p>
          )}
          <form method="POST" action={UNSUBSCRIBE_API_PATH} className="pt-2">
            <input type="hidden" name="email" value={email} />
            {trust === 'signed' && <input type="hidden" name="token" value={token} />}
            <input type="hidden" name="confirm" value="1" />
            <button type="submit" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
              Unsubscribe
            </button>
          </form>
        </>
      )}

      {view === 'invalid' && (
        <>
          <h1 className={HEADING}>Something&apos;s off.</h1>
          <p className="text-prose-faint">
            That unsubscribe link didn&apos;t check out. Try the link in your most recent Boss Daddy email, or write to
            {' '}
            <a href="mailto:hello@bossdaddylife.com" className="text-accent-text underline">hello@bossdaddylife.com</a>
            {' '}
            and we&apos;ll take care of it.
          </p>
        </>
      )}

      <div className="pt-4">
        <Link href="/" className={buttonVariants({ variant: view === 'confirm' ? 'outline' : 'primary' })}>
          ← Boss Daddy
        </Link>
      </div>
    </div>
  )
}
