import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import { CandidatesClient, type Candidate } from './_components/CandidatesClient'

export const dynamic = 'force-dynamic'

export default async function CandidatesAdminPage() {
  await requireAdmin()

  const admin = createAdminClient()
  const { data } = await admin
    .from('gear_candidates')
    .select('id, slug, name, brand, category, price_text, price_tier, fit, affiliate_url, request_count, adopted_at, adopted_product_id, created_at, last_seen_at')
    .order('request_count', { ascending: false })
    .order('last_seen_at', { ascending: false })

  const candidates = (data ?? []) as Candidate[]

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Researched Gear</h1>
        <p className="text-prose-faint text-sm mt-1 leading-relaxed">
          Gear The Boss surfaced via live research when there was no tested pick.
          These are <span className="font-semibold">never public</span> — adopt one
          to put it on the bench as something to test (it becomes a real product,
          tagged as research-sourced).{' '}
          <Link href="/dashboard/admin/demand" className="text-accent-text-soft hover:text-accent">
            See gear demand →
          </Link>
        </p>
      </div>

      <CandidatesClient candidates={candidates} />
    </div>
  )
}
