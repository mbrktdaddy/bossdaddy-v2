import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import BossChat from './_components/BossChat'

export const metadata: Metadata = {
  title: LABELS.tools.theBoss.pageTitle,
  description: LABELS.tools.theBoss.metaDescription,
  alternates: { canonical: '/tools/the-boss' },
}

// Soft wall (pattern B1): the chat renders for everyone. Visitors get a small
// free taste (IP-quota in the API); the quota CTA appears in-chat when spent.
export default async function TheBossPage({
  searchParams,
}: {
  searchParams?: Promise<{ context?: string }>
}) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const seedContext = (await searchParams)?.context

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-widest font-semibold text-eyebrow mb-2">Ask the Boss</p>
        <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">{LABELS.tools.theBoss.full}</h1>
        <p className="mt-2 text-sm sm:text-base text-prose-muted leading-relaxed max-w-2xl">
          Tested gear picks, straight answers, and dad-life help — grounded in real, hands-on reviews.
        </p>
      </header>

      <BossChat isMember={!!user} seedContext={seedContext} />
    </div>
  )
}
