import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'
import Link from 'next/link'
import { PillFilterStrip, PILL_BASE, PILL_INACTIVE } from '@/components/ui/PillFilterStrip'
import Image from 'next/image'
import { createAnonClient } from '@/lib/supabase/anon'
import { getCategoryBySlug, CATEGORIES } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import PageHeader from '@/components/PageHeader'
import VaultCard from '@/components/VaultCard'
import { getVaultCollections, getVaultTab } from '@/lib/vault'
import { formatPublished } from '@/lib/latest'
import { LABELS } from '@/lib/labels'
import { EmptyState } from '@/components/ui/EmptyState'
import { LabelBlock } from '@/components/ui/LabelBlock'
import EditorialHeader from '@/components/EditorialHeader'
import ReviewCard from '@/components/ReviewCard'
import { ChevronDownIcon } from '@/components/icons'

interface Props { params: Promise<{ slug: string }> }

export const revalidate = 3600

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title: `${cat.label} — Dad-Tested Reviews & Real-Dad Guides | Boss Daddy`,
    description: cat.description,
    path: `/category/${slug}`,
    siteUrl,
    ogTitle: `${cat.label} | Boss Daddy`,
    type: 'site',
    ogType: 'website',
  })
}

export default async function CategoryHubPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const supabase = createAnonClient()

  const [{ data: topReviews }, { data: latestGuides }, collections] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', slug)
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(3),
    supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', slug)
      .order('published_at', { ascending: false })
      .limit(3),
    // Reading-format collections (comparisons, best-of) belong to a topic by
    // their DOMINANT category — collections carry no category column; it is
    // derived from the reviews inside them (lib/collection-listings). Same
    // cached loader the listings use, so hub and listing agree on what's live.
    getVaultCollections(),
  ])

  const comparisons = collections.filter((c) => c.dominant_category === slug && c.collection_type === 'comparison').slice(0, 3)
  const picks = collections.filter((c) => c.dominant_category === slug && (c.collection_type === 'best_of' || c.collection_type === 'general')).slice(0, 3)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: cat.label, item: `${siteUrl}/category/${slug}` },
    ],
  }

  type FAQ = { question: string; answer: string }
  const catFaqs = (cat.faqs ?? []) as unknown as FAQ[]

  const faqLd = catFaqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: catFaqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null

  const hasReviews = topReviews && topReviews.length > 0
  const hasGuides = latestGuides && latestGuides.length > 0
  // Phase I-2: the two reading FORMATS that used to live only in the Vault.
  // Each section self-suppresses at zero — this is a hub, not a tab strip, so
  // empty means absent, never a `0` (nav-ia-plan invariant 10).
  const hasComparisons = comparisons.length > 0
  const hasPicks = picks.length > 0

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <PageHeader eyebrow="Boss Daddy" title={cat.label} deck={cat.description} />

      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        <div className="mb-16">
          {cat.pov && (
            <p className="mt-5 text-prose-muted max-w-2xl leading-relaxed italic border-l-2 border-accent/50 pl-4">
              {cat.pov as string}
            </p>
          )}
          <Link
            href={`/reviews/category/${slug}`}
            className="inline-block mt-5 text-sm text-prose-faint hover:text-accent-text-soft transition-colors font-medium"
          >
            All {cat.label} reviews →
          </Link>
        </div>

        {/* ── Best reviews ──────────────────────────────────────────────── */}
        {hasReviews && (
          <section className="mb-20">
            <EditorialHeader eyebrow="Top Rated" title={`Best ${cat.label}`} right={{ label: "All Reviews", href: `/reviews/category/${slug}` }} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {topReviews.map((r, i) => (
                <ReviewCard key={r.id} review={{ ...r, category: slug }} priority={i === 0} eyebrow={null} headingLevel="h3" />
              ))}
            </div>
          </section>
        )}

        {/* ── Guides — editorial rows (geometry variation vs Best Reviews grid above) */}
        {hasGuides && (
          <section className="mb-20">
            <EditorialHeader eyebrow="Know-How" title={`${cat.label} Guides`} right={{ label: "All Guides", href: `/guides/category/${slug}` }} />

            <ul className="divide-y divide-soft">
              {latestGuides.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/guides/${g.slug}`}
                    className="group flex items-center gap-4 sm:gap-5 py-5"
                  >
                    {/* Thumbnail — fixed square, fills */}
                    <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 overflow-hidden rounded-xl bg-surface-raised">
                      {g.image_url ? (
                        <Image
                          src={g.image_url}
                          alt={g.title}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CategoryIcon slug={cat.slug} className="w-7 h-7 text-prose-faint" />
                        </div>
                      )}
                    </div>

                    {/* Title + meta */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-black text-prose group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                        {g.title}
                      </h3>
                      {g.excerpt && (
                        <p className="hidden sm:block text-sm text-prose-faint mt-1.5 line-clamp-1">{g.excerpt}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-prose-faint">
                        {g.published_at && <span>{formatPublished(g.published_at)}</span>}
                        {g.reading_time_minutes && (
                          <span aria-hidden>·</span>
                        )}
                        {g.reading_time_minutes && (
                          <span>{g.reading_time_minutes} min read</span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <span aria-hidden className="text-prose-faint group-hover:text-accent-text-soft transition-colors text-2xl shrink-0">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Comparisons — head-to-head, built from this topic's reviews ── */}
        {hasComparisons && (
          <section className="mb-20">
            <EditorialHeader eyebrow="Head to Head" title={`${cat.label} ${LABELS.comparisons.short}`} right={{ label: `All ${LABELS.comparisons.short}`, href: `/comparisons?cat=${slug}` }} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {comparisons.map((c) => (
                <VaultCard key={c.id} col={c} cta={getVaultTab('comparisons').cardCta} />
              ))}
            </div>
          </section>
        )}

        {/* ── Best Of — ranked roundups for this topic ─────────────────── */}
        {hasPicks && (
          <section className="mb-20">
            <EditorialHeader eyebrow="Ranked" title={`${cat.label} ${LABELS.picks.full}`} right={{ label: `All ${LABELS.picks.short}`, href: `/picks?cat=${slug}` }} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {picks.map((c) => (
                <VaultCard key={c.id} col={c} cta={getVaultTab('picks').cardCta} />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!hasReviews && !hasGuides && !hasComparisons && !hasPicks && (
          <EmptyState
            icon={<CategoryIcon slug={cat.slug} className="w-10 h-10 text-accent-text" />}
            title={<>No {cat.label} content yet.</>}
            body={<>Check back soon — it&apos;s on the bench.</>}
            action={
              <Link
                href="/bench"
                className="inline-block mt-6 text-sm text-accent-text-soft hover:text-accent font-medium transition-colors"
              >
                See what&apos;s coming →
              </Link>
            }
          />
        )}

        {/* ── FAQ accordion ────────────────────────────────────────────── */}
        {catFaqs.length > 0 && (
          <section className="mb-16">
            <EditorialHeader eyebrow="Common Questions" title={`${cat.label} FAQ`} />
            <div className="border-t border-soft">
              {catFaqs.map((faq, i) => (
                <details key={i} className="group border-b border-soft">
                  <summary className="flex items-center justify-between gap-3 py-3.5 cursor-pointer list-none min-h-[44px]">
                    <span className="text-sm font-semibold text-prose leading-snug">{faq.question}</span>
                    <ChevronDownIcon className="w-4 h-4 shrink-0 text-accent-text transition-transform group-open:rotate-180" strokeWidth={2.5} />
                  </summary>
                  <div className="pb-4 pt-1 text-sm text-prose-muted leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ── Other categories ──────────────────────────────────────────── */}
        <section className="mt-12 pt-12 border-t border-soft">
          <LabelBlock as="p" className="mb-5">More Categories</LabelBlock>
          <PillFilterStrip>
            {CATEGORIES.filter((c) => c.slug !== slug).map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className={`${PILL_BASE} ${PILL_INACTIVE}`}>
                <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
                <span>{c.label}</span>
              </Link>
            ))}
          </PillFilterStrip>
        </section>

      </div>
    </>
  )
}
