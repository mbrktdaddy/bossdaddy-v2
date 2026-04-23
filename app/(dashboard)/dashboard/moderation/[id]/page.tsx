import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ScoreRing } from '../_components/ScoreRing'
import { ModerationDecision } from '../_components/ModerationDecision'

export default async function ReviewModerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Verify caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Fetch review via admin client — bypasses RLS so pending reviews are always accessible
  const admin = createAdminClient()
  const { data: review } = await admin
    .from('reviews')
    .select('id, title, product_name, content, rating, image_url, moderation_score, moderation_flags, has_affiliate_links, disclosure_acknowledged, status')
    .eq('id', id)
    .single()

  if (!review) {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/dashboard/moderation" className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to queue
        </Link>
        <p className="text-red-400">Review not found. It may have been deleted or already moderated.</p>
      </div>
    )
  }

  if (review.status !== 'pending') {
    return (
      <div className="p-8 max-w-3xl">
        <Link href="/dashboard/moderation" className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to queue
        </Link>
        <p className="text-yellow-400">
          This review is no longer pending — current status: <strong>{review.status}</strong>.
        </p>
      </div>
    )
  }

  const flags = (review.moderation_flags ?? []) as string[]

  return (
    <div className="p-4 sm:p-8 max-w-3xl">

      {/* Back */}
      <Link
        href="/dashboard/moderation"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back to queue
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="min-w-0 pr-6">
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-950/40 text-orange-400 border border-orange-900/30 mb-2 inline-block">Review</span>
          <h1 className="text-xl font-black leading-tight">{review.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{review.product_name} · {review.rating}/10</p>
        </div>
        <ScoreRing score={review.moderation_score as number | null} />
      </div>

      {/* Hero image */}
      {review.image_url && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={review.image_url} alt="Product" className="w-full h-48 object-cover" />
        </div>
      )}

      {/* Compliance badges */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <span className={`text-xs px-3 py-1.5 rounded-xl border font-medium ${
          review.has_affiliate_links
            ? 'bg-orange-950/40 text-orange-400 border-orange-900/40'
            : 'bg-gray-900 text-gray-500 border-gray-800'
        }`}>
          {review.has_affiliate_links ? '⚠ Has affiliate links' : '✓ No affiliate links'}
        </span>
        <span className={`text-xs px-3 py-1.5 rounded-xl border font-medium ${
          review.disclosure_acknowledged
            ? 'bg-green-950/40 text-green-400 border-green-900/40'
            : 'bg-red-950/40 text-red-400 border-red-900/40'
        }`}>
          {review.disclosure_acknowledged ? '✓ Disclosure acknowledged' : '✗ Disclosure missing'}
        </span>
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="mb-6 bg-red-950/30 border border-red-900/40 rounded-2xl p-5">
          <p className="text-red-400 text-xs font-semibold uppercase tracking-wide mb-3">Moderation Flags</p>
          <div className="space-y-1.5">
            {flags.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-300">
                <span className="text-red-600 mt-0.5 shrink-0">⚑</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content preview */}
      <div
        className="prose prose-invert prose-sm max-w-none bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 max-h-[480px] overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: review.content }}
      />

      {/* Decision panel — client component */}
      <ModerationDecision id={id} contentType="reviews" />
    </div>
  )
}
