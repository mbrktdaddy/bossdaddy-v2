import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import PageHeader from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/Button'

// Same anatomy as /newsletter/unsubscribe (the other unsubscribe surface) so the
// two read as one: PageHeader (compact) in a max-w-xl column → the explanation →
// the action row. Keep the two in step.

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
    <div className="max-w-xl mx-auto px-6 py-12 sm:py-20">
      <PageHeader
        size="compact"
        eyebrow="Email preferences"
        title={status === 'ok' ? 'You’re off the list.' : 'Something’s off.'}
      />

      <div className="pt-6 space-y-4 text-base text-prose-muted leading-relaxed">
        {status === 'ok' && (
          <p>No more Boss Daddy tool emails. Your kid profile and moments are untouched.</p>
        )}
        {status === 'invalid' && (
          <p>That unsubscribe link didn&apos;t check out. The subscription may have already been removed.</p>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/" className={buttonVariants({ size: 'lg' })}>
            ← Boss Daddy
          </Link>
        </div>
      </div>
    </div>
  )
}
