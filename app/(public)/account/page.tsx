// Account — everything about YOU that isn't a form.
//
// NOT the signed-in home. /tools is (docs/nav-ia-plan.md Phase D), and this page stopped
// competing for the job in Phase F when the Today card came off it. What's here is your
// family, your people and the things you saved; what's on /account/settings is the
// configuration — profile fields, email and privacy toggles, delete account. The label
// is LABELS.account, and the reason it is no longer "Your Stuff" is written there.
//
// This page didn't exist. Everything on it was living inside /account/settings,
// which meant a settings URL was where your kid profiles, your taper, your likes
// and your followed gear lived. That's two different jobs on one page: things you
// HAVE versus things you CONFIGURE. Every product that has both splits them —
// Facebook Profile vs Settings, LinkedIn Me→Profile vs Settings & Privacy, GitHub
// Your repositories vs Settings — and none of them file "your stuff" under
// preferences.
//
// So settings kept the configuration (profile fields, email, notification
// toggles, who-can-reach-you, delete account) and everything else moved here.
//
// The two people-shaped cards are deliberately DIFFERENT SETS, and they now live on
// different pages:
//   • ContactsCard      — everyone you're connected to. Who you CAN ask. HERE, because
//                         connecting and blocking are management.
//   • YourCornerSection — who accepted a share on one of your goals. Who SAID YES.
//                         Moved to /tools, because it's a fact about goals this page no
//                         longer shows (docs/nav-ia-plan.md Phase D).
// Collapsing them is what made "Your Corner" meaningless the first time round; keep
// them apart even though they're now apart by more than a heading.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import MyKidsSection from '@/components/dad-tools/MyKidsSection'
import ContactsCard from '@/components/account/ContactsCard'

export const metadata: Metadata = {
  title: LABELS.account.pageTitle,
  robots: { index: false, follow: false },
}

const BENCH_STATUS_LABEL: Record<string, string> = {
  queued:      'Up next',
  testing:     'Testing',
  considering: 'Considering',
  reviewed:    'Reviewed',
}

export default async function AccountHomePage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect('/login?next=/account')

  const [
    { count: commentCount },
    { count: likesGiven },
    { data: likedReviewLinks },
    { data: likedArticleLinks },
    { data: benchSubs },
  ] = await Promise.all([
    supabase.from('comments').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    supabase.from('likes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('likes').select('content_id').eq('user_id', user.id).eq('content_type', 'review')
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('likes').select('content_id').eq('user_id', user.id).eq('content_type', 'guide')
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('wishlist_subscriptions')
      .select('wishlist_item_id, products(id, slug, title:name, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const likedReviewIds  = likedReviewLinks?.map((l) => l.content_id) ?? []
  const likedArticleIds = likedArticleLinks?.map((l) => l.content_id) ?? []

  const [{ data: likedReviews }, { data: likedArticles }] = await Promise.all([
    likedReviewIds.length
      ? supabase.from('reviews').select('id, slug, title, product_name')
          .in('id', likedReviewIds).eq('status', 'approved').eq('is_visible', true)
      : Promise.resolve({ data: [] }),
    likedArticleIds.length
      ? supabase.from('guides').select('id, slug, title')
          .in('id', likedArticleIds).eq('status', 'approved').eq('is_visible', true)
      : Promise.resolve({ data: [] }),
  ])

  const reviewMap  = new Map(likedReviews?.map((r) => [r.id, r]))
  const articleMap = new Map(likedArticles?.map((a) => [a.id, a]))
  const orderedLikedReviews  = likedReviewIds.map((id) => reviewMap.get(id)).filter(Boolean)
  const orderedLikedArticles = likedArticleIds.map((id) => articleMap.get(id)).filter(Boolean)
  const hasLikedContent = orderedLikedReviews.length > 0 || orderedLikedArticles.length > 0

  type BenchItem = { id: string; slug: string; title: string; status: string }
  const subscribedItems: BenchItem[] = (benchSubs ?? [])
    .map((s) => s.products as unknown as BenchItem | null)
    .filter((item): item is BenchItem => item !== null)

  return (
    <div data-theme="dark" className="bg-background text-prose min-h-[calc(100vh-4rem)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* "Account", not "Your Stuff" — and both strings now come from
            lib/labels.ts, which is where a nav link and a page H1 are supposed to read
            from (CLAUDE.md, Naming Doctrine). The old label was hardcoded in four
            places; see the block in labels.ts for why the word changed. */}
        <div className="mb-8">
          <h1 className="text-2xl font-black">{LABELS.account.h1}</h1>
          <p className="text-prose-faint text-sm mt-1">
            {LABELS.account.tagline}
          </p>
        </div>

        {/* ── MANAGEMENT LIVES HERE; STATE AND WORK LIVE ON /tools ─────────────
            One rule, and it decides every section on both pages: this page is where
            you CHANGE things — family members, who you're connected to, your profile
            — and /tools is where you see what's happening. So "what you're working
            on" and "in your corner" moved there (docs/nav-ia-plan.md Phase D), while
            family and contacts stayed, because adding a kid and blocking a contact
            are management, not state.

            The dek changed with them: it promised "what you're working on", which
            this page no longer shows.

            Order is concentric rather than most-urgent-first — the people he's
            responsible for, then the people he can call on. */}
        <div className="mb-6">
          <MyKidsSection />
        </div>

        <ContactsCard />

        {/* THE TODAY CARD IS GONE FROM HERE (Phase F), and it's the last piece of
            Phase D. It was kept "by request" as the one work item on a management page,
            which left three identical cards pointing at one door — /tools, /goals and
            here — and a card that appears everywhere stops being read anywhere. /tools
            is the signed-in home and leads with it; the avatar menu is one tap away from
            either page.

            What's left below is what a member HAS: the things he saved, then the two
            counts. Activity moved under them — it's the least useful thing on the page
            and it was sitting above the content it counts. */}
        <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Liked Content</p>
          {!hasLikedContent ? (
            <p className="text-sm text-prose-faint text-center py-4">
              Nothing liked yet — heart a review or article and it will appear here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {orderedLikedReviews.slice(0, 5).map((r) => r && (
                <Link key={r.id} href={`/reviews/${r.slug}`}
                  className="flex items-center gap-3 px-3 py-2.5 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-lg transition-colors group min-h-[44px]">
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent-tint text-accent-text-soft border border-accent-border/60 shrink-0 font-medium">Review</span>
                  <p className="text-sm text-prose-muted group-hover:text-prose transition-colors truncate min-w-0 flex-1">{r.title}</p>
                  <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              ))}
              {orderedLikedArticles.slice(0, 5).map((a) => a && (
                <Link key={a.id} href={`/guides/${a.slug}`}
                  className="flex items-center gap-3 px-3 py-2.5 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-lg transition-colors group min-h-[44px]">
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-info-bg text-info-ink border border-info-line shrink-0 font-medium">Guide</span>
                  <p className="text-sm text-prose-muted group-hover:text-prose transition-colors truncate min-w-0 flex-1">{a.title}</p>
                  <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              ))}
              {(orderedLikedReviews.length > 5 || orderedLikedArticles.length > 5) && (
                <p className="text-center text-xs text-prose-faint pt-2">
                  Showing 5 of each · {orderedLikedReviews.length + orderedLikedArticles.length} total liked
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Following on the Bench</p>
          {subscribedItems.length === 0 ? (
            <p className="text-sm text-prose-faint text-center py-4">
              Not following anything yet —{' '}
              <Link href="/bench" className="text-accent-text-soft hover:underline">visit the Bench</Link>
              {' '}to subscribe for review updates.
            </p>
          ) : (
            <div className="space-y-1">
              {subscribedItems.map((item) => (
                <Link key={item.id} href={`/bench/${item.slug}`}
                  className="flex items-center gap-3 p-3 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl transition-colors group">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-prose-muted border border-strong shrink-0">
                    {BENCH_STATUS_LABEL[item.status] ?? item.status}
                  </span>
                  <p className="text-sm text-prose-muted group-hover:text-prose transition-colors truncate min-w-0">{item.title}</p>
                  <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft shrink-0 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Two counts of your own doing, below the content they count. Kept rather
            than cut — it's your own record, not a scale metric on a public page — but
            it's the first thing to go if this page needs the room. */}
        <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Activity</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-prose">{commentCount ?? 0}</p>
              <p className="text-xs text-prose-faint mt-1">Comments Left</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-accent-text-soft">{likesGiven ?? 0}</p>
              <p className="text-xs text-prose-faint mt-1">Likes Given</p>
            </div>
          </div>
        </div>

        <div className="border-t border-soft pt-6">
          <Link
            href="/account/settings"
            className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-text hover:text-prose"
          >
            {LABELS.account.settingsCta} →
          </Link>
        </div>

      </div>
    </div>
  )
}
