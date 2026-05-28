import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = {
  title:   'Email unsubscribe — Boss Daddy Tools',
  robots:  { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ token?: string | string[] }>
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams
  const t = Array.isArray(token) ? token[0] : token

  let status: 'ok' | 'invalid' | 'unknown' = 'unknown'

  if (t && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    const admin = createAdminClient()
    // .select() turns the delete into DELETE … RETURNING — if the returned
    // array is empty, the token didn't match anything and we should NOT
    // claim a successful unsubscribe.
    const { data, error } = await admin.from('tool_email_subscriptions')
      .delete()
      .eq('unsubscribe_token', t)
      .select('id')
    status = error || !data || data.length === 0 ? 'invalid' : 'ok'
  } else {
    status = 'invalid'
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center space-y-4">
      {status === 'ok' && (
        <>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">You&apos;re off the list.</h1>
          <p className="text-prose-faint">
            No more Boss Daddy tool emails. Your kid profile and moments are untouched.
          </p>
        </>
      )}
      {status === 'invalid' && (
        <>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Something&apos;s off.</h1>
          <p className="text-prose-faint">
            That unsubscribe link didn&apos;t check out. The subscription may have already been removed.
          </p>
        </>
      )}
      <div className="pt-4">
        <Link
          href="/"
          className="inline-block px-5 py-3 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Back to Boss Daddy
        </Link>
      </div>
    </div>
  )
}
