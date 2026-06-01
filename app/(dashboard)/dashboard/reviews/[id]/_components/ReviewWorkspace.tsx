'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { CATEGORIES } from '@/lib/categories'
import { TESTING_DURATION_OPTIONS } from '@/lib/products'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { preserveImagesAcrossRefine } from '@/lib/inlineImages'
import { TiptapEditor } from '@/components/workspace/TiptapEditor'
import { HeroImagePanel } from '@/components/workspace/HeroImagePanel'
import { AIRefinePanel } from '@/components/workspace/AIRefinePanel'
import { ModerationInfo } from '@/components/workspace/ModerationInfo'
import { SEOPanel } from '@/components/workspace/SEOPanel'
import { SchedulePanel } from '@/components/workspace/SchedulePanel'
import { VersionHistoryPanel } from '@/components/workspace/VersionHistoryPanel'
import { InternalLinkPanel } from '@/components/workspace/InternalLinkPanel'
import { SocialPostsPanel } from '@/components/workspace/SocialPostsPanel'
import { ProductLinkPanel } from '@/components/workspace/ProductLinkPanel'
import { PrimaryProductPanel } from '@/components/workspace/PrimaryProductPanel'
import { ComparisonProductsPanel } from '@/components/workspace/ComparisonProductsPanel'
import { SpecsGradePanel } from '@/components/workspace/SpecsGradePanel'
import { parseSpecsGradeData, type SpecsGradeData } from '@/lib/reviews'

const InlineMediaPanel = dynamic(
  () => import('@/components/workspace/InlineMediaPanel').then((m) => ({ default: m.InlineMediaPanel })),
  { ssr: false, loading: () => <div className="h-32 bg-surface-sunken border border-soft rounded-xl animate-pulse" /> },
)
import { WorkspaceToolbar } from '@/components/workspace/WorkspaceToolbar'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { ListEditor } from '@/components/workspace/ListEditor'
import { TagPicker } from '@/components/workspace/TagPicker'
import { useContentWorkspace } from '@/components/workspace/useContentWorkspace'
import { ReviewDraftPreview } from '@/components/workspace/ReviewDraftPreview'
import { RefinePreviewModal } from '@/components/workspace/RefinePreviewModal'
import { ScheduleFollowupModal } from '@/components/workspace/ScheduleFollowupModal'

type VerdictChange = 'improved' | 'unchanged' | 'declined' | 'complete_reversal'
const MIN_PARENT_AGE_DAYS = 30

interface FAQ { question: string; answer: string }

interface ReviewData {
  id: string
  title: string
  product_name: string
  category: string
  excerpt: string | null
  content: string
  image_url: string | null
  rating: number | null
  pros: string[] | null
  cons: string[] | null
  has_affiliate_links: boolean | null
  disclosure_acknowledged: boolean | null
  status: string
  slug: string | null
  moderation_score: number | null
  moderation_flags: string[] | null
  created_at: string | null
  updated_at: string | null
  reading_time_minutes: number | null
  rejection_reason: string | null
  meta_title: string | null
  meta_description: string | null
  scheduled_publish_at: string | null
  product_slug: string | null
  comparison_product_slugs: string[] | null
  product_id: string | null
  tldr: string | null
  key_takeaways: string[] | null
  best_for: string[] | null
  not_for: string[] | null
  faqs: FAQ[] | null
  tags?: string[]
  testing_duration: string | null
  testing_since: string | null
  testing_note: string | null
  how_you_used_it: string | null
  standout_moment: string | null
  price_paid_cents: number | null
  score_quality: number | null
  score_value: number | null
  score_ease: number | null
  score_daily_use: number | null
  score_specs: number | null
  specs_grade_rationale: string | null
  specs_grade_data: unknown
  would_rebuy: boolean | null
  is_visible: boolean | null
  published_at: string | null
  parent_review_id: string | null
  milestone_label: string | null
  milestone_days: number | null
  previous_rating: number | null
  verdict_change: string | null
}

interface ParentSummary {
  id: string
  title: string
  slug: string | null
  rating: number | null
  published_at: string | null
}

interface WorkspaceProps {
  review: ReviewData
  parent?: ParentSummary | null
  followupCount?: number
  // Computed server-side: days between parent.published_at and now. Stale by
  // the time the page hydrates, but the API revalidates on POST.
  parentAgeDays?: number | null
}

export function ReviewWorkspace({ review, parent = null, followupCount = 0, parentAgeDays = null }: WorkspaceProps) {
  const [title, setTitle]             = useState(review.title)
  const [productName, setProductName] = useState(review.product_name)
  const [category, setCategory]       = useState(review.category)
  const [excerpt, setExcerpt]         = useState(review.excerpt ?? '')
  const [content, setContent]         = useState(review.content)
  const [imageUrl, setImageUrl]       = useState<string | null>(review.image_url)
  const [pros, setPros]               = useState<string[]>(review.pros ?? [])
  const [cons, setCons]               = useState<string[]>(review.cons ?? [])
  const [disclosureAck, setDiscAck]   = useState<boolean>(review.disclosure_acknowledged ?? false)
  const [metaTitle, setMetaTitle]     = useState(review.meta_title ?? '')
  const [metaDesc, setMetaDesc]       = useState(review.meta_description ?? '')
  const [scheduledAt, setScheduled]   = useState<string | null>(review.scheduled_publish_at)
  const [productSlug, setProductSlug] = useState<string | null>(review.product_slug)
  const [comparisonSlugs, setComparisonSlugs] = useState<string[]>(review.comparison_product_slugs ?? [])

  const [testingDuration, setTestingDuration] = useState(review.testing_duration ?? '')
  const [testingSince, setTestingSince]       = useState(review.testing_since ?? '')
  const [testingNote, setTestingNote]         = useState(review.testing_note ?? '')
  const [howYouUsedIt, setHowYouUsedIt]       = useState(review.how_you_used_it ?? '')
  const [standoutMoment, setStandoutMoment]   = useState(review.standout_moment ?? '')
  const [pricePaidCents, setPricePaidCents]   = useState(
    review.price_paid_cents != null ? String(review.price_paid_cents) : ''
  )

  const [scoreQuality, setScoreQuality]   = useState<number | null>(review.score_quality ?? null)
  const [scoreValue, setScoreValue]       = useState<number | null>(review.score_value ?? null)
  const [scoreEase, setScoreEase]         = useState<number | null>(review.score_ease ?? null)
  const [scoreDailyUse, setScoreDailyUse] = useState<number | null>(review.score_daily_use ?? null)
  const [scoreSpecs, setScoreSpecs]       = useState<number | null>(review.score_specs ?? null)
  const [specsRationale, setSpecsRationale] = useState(review.specs_grade_rationale ?? '')
  const [specsData, setSpecsData]         = useState<SpecsGradeData>(parseSpecsGradeData(review.specs_grade_data))
  const [wouldRebuy, setWouldRebuy]       = useState<boolean | null>(review.would_rebuy ?? null)
  const [verdictChange, setVerdictChange] = useState<VerdictChange | null>(
    (review.verdict_change as VerdictChange | null) ?? null
  )

  // Follow-up scheduling — modal opens from the Distribution section button.
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const isFollowup = review.parent_review_id !== null
  const canScheduleFollowup =
    !isFollowup &&
    review.status === 'approved' &&
    review.is_visible === true &&
    parentAgeDays !== null &&
    parentAgeDays >= MIN_PARENT_AGE_DAYS

  // Computed overall — average of the four sub-scores. Null until all four are
  // populated. This is the source of truth; the DB stores the same generated value.
  // Present-only average, mirroring the DB generated column: requires the 4
  // experiential scores; folds in the specs axis only when it's graded.
  const computedRating = useMemo<number | null>(() => {
    if (scoreQuality == null || scoreValue == null || scoreEase == null || scoreDailyUse == null) return null
    const base = scoreQuality + scoreValue + scoreEase + scoreDailyUse
    return scoreSpecs != null ? (base + scoreSpecs) / 5 : base / 4
  }, [scoreQuality, scoreValue, scoreEase, scoreDailyUse, scoreSpecs])

  const [tags, setTags]                   = useState<string[]>(review.tags ?? [])
  const [tldr, setTldr]                   = useState(review.tldr ?? '')
  const [keyTakeaways, setKeyTakeaways]   = useState<string[]>(review.key_takeaways ?? [])
  const [bestFor, setBestFor]             = useState<string[]>(review.best_for ?? [])
  const [notFor, setNotFor]               = useState<string[]>(review.not_for ?? [])
  const [faqs, setFaqs]                   = useState<FAQ[]>(review.faqs ?? [])

  const [heroPromptSuggestion, setHeroPromptSuggestion] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  // Pending refine — holds proposed content before user accepts or discards
  const [pendingRefine, setPendingRefine] = useState<{
    content: string
    title?: string; excerpt?: string
    subScores?: { quality?: number; value?: number; ease?: number; dailyUse?: number }
    pros?: string[]; cons?: string[]
    tldr?: string; keyTakeaways?: string[]; bestFor?: string[]; notFor?: string[]
    faqs?: FAQ[]
  } | null>(null)

  useEffect(() => {
    const key = `bd:hero-prompt:${review.id}`
    const val = sessionStorage.getItem(key)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (val) { setHeroPromptSuggestion(val); sessionStorage.removeItem(key) }
  }, [review.id])

  const [refineInstruction, setRefineInstruction] = useState('')

  const status = review.status
  const isPublished = status === 'approved'

  // hasAffiliate is pure derived state — content fully determines it. Avoids
  // the cascading render → effect → setState pattern the React 19 lint flagged.
  //
  // We intentionally do NOT auto-clear disclosureAck when hasAffiliate flips
  // false: the publish gate (`!hasAffiliate || disclosureAck`) and the
  // readiness checklist both already condition on hasAffiliate, and the
  // checkbox UI is hidden when hasAffiliate=false. Preserving the user's
  // explicit acknowledgment across link-toggle cycles is the cleaner UX
  // anyway — they don't have to re-check if they remove a link and add
  // another one back.
  const hasAffiliate = useMemo(() => detectAffiliateLinks(content), [content])

  const payload = useMemo(() => ({
    title,
    product_name: productName,
    category,
    excerpt: excerpt || undefined,
    content,
    image_url: imageUrl,
    pros: pros.filter(p => p.trim()),
    cons: cons.filter(c => c.trim()),
    disclosure_acknowledged: disclosureAck,
    meta_title:           metaTitle || null,
    meta_description:     metaDesc  || null,
    scheduled_publish_at: scheduledAt,
    product_slug:         productSlug,
    comparison_product_slugs: comparisonSlugs,
    tldr:                 tldr || null,
    key_takeaways:        keyTakeaways,
    best_for:             bestFor,
    not_for:              notFor,
    faqs,
    testing_duration:     testingDuration || null,
    testing_since:        testingDuration === 'custom' && testingSince ? testingSince : null,
    testing_note:         testingDuration === 'custom' && testingNote.trim() ? testingNote.trim() : null,
    how_you_used_it:      howYouUsedIt.trim() || null,
    standout_moment:      standoutMoment.trim() || null,
    price_paid_cents:     pricePaidCents.trim() && !isNaN(parseInt(pricePaidCents, 10))
                            ? parseInt(pricePaidCents, 10) : null,
    score_quality:        scoreQuality,
    score_value:          scoreValue,
    score_ease:           scoreEase,
    score_daily_use:      scoreDailyUse,
    score_specs:          scoreSpecs,
    specs_grade_rationale: specsRationale.trim() || null,
    specs_grade_data:     specsData,
    would_rebuy:          wouldRebuy,
    verdict_change:       isFollowup ? verdictChange : undefined,
  }), [title, productName, category, excerpt, content, imageUrl, pros, cons, disclosureAck, metaTitle, metaDesc, scheduledAt, productSlug, comparisonSlugs, tldr, keyTakeaways, bestFor, notFor, faqs, testingDuration, testingSince, testingNote, howYouUsedIt, standoutMoment, pricePaidCents, scoreQuality, scoreValue, scoreEase, scoreDailyUse, scoreSpecs, specsRationale, specsData, wouldRebuy, verdictChange, isFollowup])

  const canPublish = !hasAffiliate || disclosureAck
  const publishBlockedReason = !canPublish
    ? 'Acknowledge the affiliate disclosure before publishing (see section below).'
    : null

  const { busy, actionErr, actionMsg, setMsg, deleting, autoSave, manualSave, publishOrUnpublish, handleDelete, handleDuplicate } =
    useContentWorkspace({ id: review.id, contentType: 'review', payload, tags, isPublished, canPublish, publishBlockedReason })

  function applyPendingRefine() {
    if (!pendingRefine) return
    setContent(pendingRefine.content)
    if (pendingRefine.title) setTitle(pendingRefine.title)
    if (pendingRefine.excerpt) setExcerpt(pendingRefine.excerpt)
    if (pendingRefine.subScores) {
      if (typeof pendingRefine.subScores.quality  === 'number') setScoreQuality(pendingRefine.subScores.quality)
      if (typeof pendingRefine.subScores.value    === 'number') setScoreValue(pendingRefine.subScores.value)
      if (typeof pendingRefine.subScores.ease     === 'number') setScoreEase(pendingRefine.subScores.ease)
      if (typeof pendingRefine.subScores.dailyUse === 'number') setScoreDailyUse(pendingRefine.subScores.dailyUse)
    }
    if (pendingRefine.pros) setPros(pendingRefine.pros)
    if (pendingRefine.cons) setCons(pendingRefine.cons)
    if (pendingRefine.tldr) setTldr(pendingRefine.tldr)
    if (pendingRefine.keyTakeaways) setKeyTakeaways(pendingRefine.keyTakeaways)
    if (pendingRefine.bestFor) setBestFor(pendingRefine.bestFor)
    if (pendingRefine.notFor) setNotFor(pendingRefine.notFor)
    if (pendingRefine.faqs) setFaqs(pendingRefine.faqs)
    setPendingRefine(null)
    setMsg('Changes applied')
    setTimeout(() => setMsg(null), 3000)
  }

  // "Weave into review" — compose a refine instruction from the specs grade
  // (score + rationale + the models it compared against) and drop it into the
  // AI Refine box, then jump there. The author clicks Apply and reviews the
  // staged diff before anything changes — same accept/discard path as any refine.
  function handleWeaveSpecs() {
    if (scoreSpecs == null) return
    const rivals = specsData.comparedAgainst
      .map((c) => (c.brand ? `${c.brand} ${c.name}` : c.name).trim())
      .filter(Boolean)
      .slice(0, 5)
    const rivalText = rivals.length ? ` versus ${rivals.join(', ')}` : ''
    const basis = specsRationale.trim().slice(0, 550)
    const instruction = (
      `In my voice, work the spec comparison into the review${rivalText}: it scored ${scoreSpecs}/10 on specs. ` +
      (basis ? `Basis: ${basis} ` : '') +
      `Add a sentence or two in the most relevant section drawing the key contrasts — no spec dump, no invented numbers, keep it natural.`
    ).slice(0, 1000)
    setRefineInstruction(instruction)
    const el = document.getElementById('ai-refine-instruction')
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus()
  }

  const readinessChecks = [
    { label: 'Title',      done: title.trim().length >= 10 },
    { label: 'Hero image', done: !!imageUrl },
    { label: 'Excerpt',    done: excerpt.trim().length > 0 },
    { label: 'Pros',       done: pros.filter(p => p.trim()).length >= 3 },
    { label: 'Cons',       done: cons.filter(c => c.trim()).length >= 2 },
    { label: 'Sub-scores', done: computedRating != null },
    { label: 'Content',    done: content.replace(/<[^>]+>/g, '').trim().length >= 100 },
    { label: 'No placeholders', done: !content.includes('bd-image-placeholder') },
    ...(hasAffiliate ? [{ label: 'Disclosure', done: disclosureAck }] : []),
  ]

  const previewUrl = isPublished && review.slug ? `/reviews/${review.slug}` : null
  const createdAt  = new Date(review.created_at ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <WorkspaceShell
      backHref="/dashboard/reviews"
      backLabel="All reviews"
      title={title}
      subtitle={`${productName || '—'} · ${computedRating != null ? `${computedRating.toFixed(1)}/10` : '—/10'} · Created ${createdAt}${review.reading_time_minutes ? ` · ${review.reading_time_minutes} min read` : ''}`}
      status={status}
      autoSave={autoSave}
      rejectionReason={review.rejection_reason}
      actionErr={actionErr}
      actionMsg={actionMsg}
      previewSlot={previewOpen ? (
        <ReviewDraftPreview
          title={title}
          productName={productName}
          rating={computedRating ?? 0}
          category={category}
          excerpt={excerpt}
          content={content}
          imageUrl={imageUrl}
          pros={pros.filter(p => p.trim())}
          cons={cons.filter(c => c.trim())}
          tldr={tldr}
          keyTakeaways={keyTakeaways}
          bestFor={bestFor}
          notFor={notFor}
          faqs={faqs}
          author="Boss Daddy"
          pricePaidCents={pricePaidCents.trim() && !isNaN(parseInt(pricePaidCents, 10)) ? parseInt(pricePaidCents, 10) : null}
          testingDuration={testingDuration || null}
          testingSince={testingDuration === 'custom' && testingSince ? testingSince : null}
          testingNote={testingDuration === 'custom' && testingNote.trim() ? testingNote.trim() : null}
          scoreQuality={scoreQuality}
          scoreValue={scoreValue}
          scoreEase={scoreEase}
          scoreDailyUse={scoreDailyUse}
          wouldRebuy={wouldRebuy}
        />
      ) : undefined}
      toolbar={
        <WorkspaceToolbar
          isSaving={autoSave.state === 'saving' || busy}
          isPublishing={busy}
          isDeleting={deleting}
          isPublished={isPublished}
          onSave={manualSave}
          onPublish={() => publishOrUnpublish('approve')}
          onUnpublish={() => publishOrUnpublish('unpublish')}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          previewUrl={previewUrl}
          canPublish={canPublish}
          publishBlockedReason={publishBlockedReason}
          readinessChecks={readinessChecks}
          previewOpen={previewOpen}
          onTogglePreview={() => setPreviewOpen(p => !p)}
        />
      }
      modals={
        <>
          {pendingRefine && (
            <RefinePreviewModal
              before={content}
              after={pendingRefine.content}
              onAccept={applyPendingRefine}
              onDiscard={() => setPendingRefine(null)}
            />
          )}
          {scheduleOpen && (
            <ScheduleFollowupModal
              reviewId={review.id}
              onClose={() => setScheduleOpen(false)}
            />
          )}
        </>
      }
    >

        {/* ── FOLLOW-UP CONTEXT (only when this review is itself a follow-up) ── */}
        {isFollowup && (
          <div className="bg-accent-tint border border-accent-border/40 rounded-xl p-4 sm:p-5">
            <p className="text-xs text-accent-text-soft uppercase tracking-widest font-semibold mb-2">
              Follow-up Review
            </p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3 text-sm">
              <span className="text-prose font-semibold">
                {review.milestone_label ?? 'Update'}
              </span>
              {review.milestone_days != null && (
                <span className="text-prose-muted">{review.milestone_days} days after the original</span>
              )}
              {review.previous_rating != null && (
                <span className="text-prose-muted">
                  · Original verdict {Number(review.previous_rating).toFixed(1)}/10
                </span>
              )}
            </div>

            {parent ? (
              <p className="text-xs text-prose-muted mb-4">
                Updating:{' '}
                {parent.slug ? (
                  <a
                    href={`/reviews/${parent.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-text-soft hover:text-accent underline underline-offset-2"
                  >
                    {parent.title}
                  </a>
                ) : (
                  <span className="text-prose-muted">{parent.title}</span>
                )}
                <a
                  href={`/dashboard/reviews/${parent.id}`}
                  className="ml-2 text-prose-faint hover:text-prose"
                >
                  (open original workspace →)
                </a>
              </p>
            ) : (
              <p className="text-xs text-prose-faint italic mb-4">
                Original review unavailable — it may have been deleted.
              </p>
            )}

            <div>
              <p className="block text-sm text-prose-muted mb-2">Verdict change vs. original</p>
              <div className="flex gap-2 flex-wrap">
                {([
                  ['Improved',          'improved',           '↑'],
                  ['Unchanged',         'unchanged',          '→'],
                  ['Declined',          'declined',           '↓'],
                  ['Complete reversal', 'complete_reversal',  '↺'],
                ] as const).map(([label, val, icon]) => {
                  const active = verdictChange === val
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setVerdictChange(active ? null : val)}
                      className={`px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold border transition-colors ${
                        active
                          ? 'bg-accent border-accent text-white'
                          : 'bg-surface border-strong text-prose-muted hover:bg-surface-raised'
                      }`}
                    >
                      <span className="mr-1.5">{icon}</span>{label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-prose-faint">
                Editorial judgment — drives the badge color on the public timeline. Tap again to clear.
              </p>
            </div>
          </div>
        )}

        {/* ── STORY ────────────────────────────────────────────────────── */}
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">Story</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-prose-muted mb-1.5">Product Name</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
            />
          </div>
          <div>
            <label className="block text-sm text-prose-muted mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
            >
              {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Review Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-prose-muted mb-1.5">Overall Rating</label>
            <div className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg flex items-baseline gap-1.5 min-h-[42px]">
              {computedRating != null ? (
                <>
                  <span className="text-xl font-black text-accent-text-soft tabular-nums">{computedRating.toFixed(2)}</span>
                  <span className="text-sm font-semibold text-prose-faint">/10</span>
                </>
              ) : (
                <span className="text-xs text-prose-faint italic">Set all 4 sub-scores below</span>
              )}
            </div>
            <p className="mt-1 text-xs text-prose-faint">Computed from the 4 sub-scores. Adjust those to change.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-prose-muted mb-1.5">Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
            />
          </div>
        </div>

        {/* ── Your Experience ───────────────────────────────────────────── */}
        <div className="pt-4 border-t border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Your Experience</p>
          <p className="text-xs text-prose-faint mb-3">Backfill testing context — used to drive future AI refines and stored on the review.</p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-prose-muted mb-1.5">How long tested</label>
                <select
                  value={testingDuration}
                  onChange={(e) => setTestingDuration(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
                >
                  <option value="">— not set —</option>
                  {TESTING_DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-prose-muted mb-1.5">Price paid (cents)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pricePaidCents}
                  onChange={(e) => setPricePaidCents(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 2999 = $29.99"
                  className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
                />
                {pricePaidCents && !isNaN(parseInt(pricePaidCents, 10)) && (
                  <p className="mt-1 text-xs text-accent-text-soft">${(parseInt(pricePaidCents, 10) / 100).toFixed(2)}</p>
                )}
              </div>
            </div>
            {testingDuration === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-prose-muted mb-1.5">Testing since (date)</label>
                  <input
                    type="date"
                    value={testingSince}
                    onChange={(e) => setTestingSince(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover"
                  />
                </div>
                <div>
                  <label className="block text-sm text-prose-muted mb-1.5">Or describe it</label>
                  <input
                    type="text"
                    value={testingNote}
                    onChange={(e) => setTestingNote(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. 2 summers of camping"
                    className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm text-prose-muted mb-1.5">How did you use it?</label>
              <textarea
                value={howYouUsedIt}
                onChange={(e) => setHowYouUsedIt(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="e.g. Built a backyard deck over 3 weekends — pilot holes, screws, mixing grout."
                className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-prose-muted mb-1.5">Standout moment</label>
              <textarea
                value={standoutMoment}
                onChange={(e) => setStandoutMoment(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="e.g. Battery lasted the entire weekend — never had to stop and charge."
                className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Verdict Breakdown ────────────────────────────────────────── */}
        <div className="pt-4 border-t border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Verdict Breakdown</p>
          <p className="text-xs text-prose-faint mb-3">Four 1–10 sub-scores that defend the overall rating, plus the honest re-buy signal. All render on the public Verdict Card.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['Quality',     scoreQuality,  setScoreQuality]  as const,
              ['Value',       scoreValue,    setScoreValue]    as const,
              ['Ease of Use', scoreEase,     setScoreEase]     as const,
              ['Daily Use',   scoreDailyUse, setScoreDailyUse] as const,
            ]).map(([label, value, setter]) => (
              <div key={label}>
                <label className="block text-xs text-prose-muted mb-1.5">{label}</label>
                <select
                  value={value ?? ''}
                  onChange={(e) => setter(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover text-sm"
                >
                  <option value="">—</option>
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <option key={n} value={n}>{n}/10</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="block text-sm text-prose-muted mb-1.5">Would you buy it again?</p>
            <div className="flex gap-2 flex-wrap">
              {([
                ['Yes', true],
                ['No', false],
                ['Not set', null],
              ] as const).map(([label, val]) => {
                const active = wouldRebuy === val
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setWouldRebuy(val)}
                    className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold border transition-colors ${
                      active
                        ? 'bg-accent border-accent text-white'
                        : 'bg-surface border-strong text-prose-muted hover:bg-surface-raised'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="pt-4 border-t border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Tags</p>
          <TagPicker selected={tags} onChange={setTags} />
        </div>

        <AIRefinePanel
          title={title}
          category={category}
          content={content}
          productName={productName}
          contentType="review"
          externalInstruction={refineInstruction}
          onExternalInstructionUsed={() => setRefineInstruction('')}
          onRefined={(draft) => {
            const d = draft as Record<string, unknown>
            const refinedContent = [
              draft.introduction,
              ...(draft.sections ?? []).map((s) => {
                const bodyHtml = s.body.split(/\n\n+/).map((p) => `<p>${p.trim()}</p>`).join('\n')
                return `<h2>${s.heading}</h2>\n${bodyHtml}`
              }),
              draft.verdict ? `<h2>The Verdict</h2>\n<p>${draft.verdict}</p>` : '',
            ].filter(Boolean).join('\n\n')
            const { content: merged } = preserveImagesAcrossRefine(content, refinedContent)
            // Stage for review — don't apply until user accepts
            setPendingRefine({
              content: merged,
              title:   draft.title,
              excerpt: draft.excerpt,
              subScores: d.subScores as { quality?: number; value?: number; ease?: number; dailyUse?: number } | undefined,
              pros:    draft.pros?.length ? draft.pros : undefined,
              cons:    draft.cons?.length ? draft.cons : undefined,
              tldr:          d.tldr as string | undefined,
              keyTakeaways:  d.keyTakeaways as string[] | undefined,
              bestFor:       d.bestFor as string[] | undefined,
              notFor:        d.notFor as string[] | undefined,
              faqs:          d.faqs as FAQ[] | undefined,
            })
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ListEditor label="The Good (Pros)" items={pros} onChange={setPros} placeholder="e.g. Long battery life" accent="text-forest" />
          <ListEditor label="The Not-So-Good (Cons)" items={cons} onChange={setCons} placeholder="e.g. Runs hot under load" accent="text-danger-ink" />
        </div>

        <div>
          <label className="block text-sm text-prose-muted mb-1.5">Content</label>
          <TiptapEditor
            value={content}
            onChange={setContent}
            targetWords={CATEGORIES.find(c => c.slug === category)?.targetWords}
          />
          <p className="mt-1.5 text-xs text-prose-faint">
            Primary CTA is set via Product &amp; Monetization below. Use <code className="text-accent-text-soft">[[BUY:product-slug]]</code> inline for mid-article mentions — resolves to a link on save.
          </p>
        </div>

        {/* ── CONTENT BLOCKS ───────────────────────────────────────────── */}
        <div className="pt-6 border-t border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Content Blocks</p>
          <p className="text-xs text-prose-faint mb-4">These render as structured UI elements on the public page — not prose. Generated automatically by AI drafts; edit freely.</p>
          <div className="space-y-6">

            {/* TL;DR */}
            <div>
              <label className="block text-sm text-prose-muted mb-1.5">TL;DR <span className="text-prose-faint font-normal">— 2–3 sentence skimmer summary</span></label>
              <textarea
                value={tldr}
                onChange={(e) => setTldr(e.target.value)}
                rows={3}
                placeholder="e.g. The Enfamil Enspire Ready-to-Feed is the easiest formula I've ever used at 4 AM. The nutritional profile is the closest thing to breast milk on the market, and our daughter took to it immediately after rejecting two other brands. The price is steep, but for tired dads doing solo feedings, it's worth it."
                className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-y text-sm"
              />
            </div>

            {/* Key Takeaways + Best/Not For */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ListEditor
                label="Key Takeaways"
                items={keyTakeaways}
                onChange={setKeyTakeaways}
                placeholder="e.g. Zero prep at 4 AM — crack and pour"
                accent="text-accent-text-soft"
              />
              <ListEditor
                label="Best For"
                items={bestFor}
                onChange={setBestFor}
                placeholder="e.g. Dads doing solo overnight feedings"
                accent="text-forest"
              />
              <ListEditor
                label="Not For"
                items={notFor}
                onChange={setNotFor}
                placeholder="e.g. Families on a tight formula budget"
                accent="text-danger-ink"
              />
            </div>

            {/* FAQs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-prose-muted">FAQs</label>
                <button
                  type="button"
                  onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
                  className="text-xs text-accent-text-soft hover:text-accent transition-colors"
                >
                  + Add question
                </button>
              </div>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-surface border border-soft rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-prose-faint mt-2 shrink-0">Q</span>
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => setFaqs(faqs.map((f, j) => j === i ? { ...f, question: e.target.value } : f))}
                        placeholder="e.g. Is Enfamil Enspire Ready-to-Feed worth the price?"
                        className="flex-1 px-3 py-1.5 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover"
                      />
                      <button
                        type="button"
                        onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                        className="text-prose-faint hover:text-danger-ink transition-colors text-xs mt-2"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-prose-faint mt-2 shrink-0">A</span>
                      <textarea
                        value={faq.answer}
                        onChange={(e) => setFaqs(faqs.map((f, j) => j === i ? { ...f, answer: e.target.value } : f))}
                        placeholder="2–3 sentences. Direct, specific, first-person."
                        rows={2}
                        className="flex-1 px-3 py-1.5 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover resize-none"
                      />
                    </div>
                  </div>
                ))}
                {faqs.length === 0 && (
                  <p className="text-xs text-prose-faint italic">No FAQs yet. Add questions readers commonly search for — great for SEO.</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── MEDIA ────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Media</p>
          <div className="space-y-4">
            <div className="bg-surface/50 border border-soft rounded-xl p-4">
              <p className="text-xs text-prose-faint font-medium uppercase tracking-widest mb-3">Product / hero image</p>
              <HeroImagePanel
                imageUrl={imageUrl}
                onChange={setImageUrl}
                contentType="review"
                title={title}
                category={category}
                excerpt={excerpt}
                productName={productName}
                label="Product Image"
                initialPrompt={heroPromptSuggestion}
              />
            </div>
            <div className="bg-surface/50 border border-soft rounded-xl p-4">
              <p className="text-xs text-prose-faint font-medium uppercase tracking-widest mb-3">Inline images</p>
              <InlineMediaPanel
                content={content}
                onChangeContent={setContent}
                category={category}
                productId={review.product_id ?? undefined}
              />
            </div>
          </div>
        </div>

        {/* ── COMMERCE ─────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Commerce</p>
          <div className="space-y-6">
            <PrimaryProductPanel value={productSlug} onChange={setProductSlug} />
            <ComparisonProductsPanel
              value={comparisonSlugs}
              onChange={setComparisonSlugs}
              category={category}
              primarySlug={productSlug}
            />
            <SpecsGradePanel
              productName={productName}
              category={category}
              productSlug={productSlug}
              competitorSlugs={comparisonSlugs}
              score={scoreSpecs}
              rationale={specsRationale}
              data={specsData}
              onScore={setScoreSpecs}
              onRationale={setSpecsRationale}
              onData={setSpecsData}
              onWeave={content.trim() ? handleWeaveSpecs : undefined}
            />
            <ProductLinkPanel
              content={content}
              onChangeContent={setContent}
            />
            {hasAffiliate && (
              <div className="bg-accent-tint border border-accent-border/40 rounded-xl p-4">
                <p className="text-sm text-accent-text font-semibold mb-2">⚠ Affiliate links detected</p>
                <label className="flex items-start gap-2 text-sm text-prose-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disclosureAck}
                    onChange={(e) => setDiscAck(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I confirm this review contains affiliate links. FTC disclosure will be auto-inserted before publishing.
                    <a href="/affiliate-disclosure" target="_blank" rel="noopener noreferrer" className="ml-1 text-accent-text-soft hover:text-accent">Learn more →</a>
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* ── DISTRIBUTION ─────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Publish &amp; Distribute</p>
          <div className="space-y-6">
            <SEOPanel
              metaTitle={metaTitle}
              metaDescription={metaDesc}
              fallbackTitle={title}
              fallbackDescription={excerpt}
              slug={review.slug}
              contentType="review"
              productName={productName}
              category={category}
              excerpt={excerpt}
              content={content}
              onChangeTitle={setMetaTitle}
              onChangeDescription={setMetaDesc}
            />
            {!isPublished && (
              <SchedulePanel scheduledAt={scheduledAt} onChange={setScheduled} />
            )}

            {/* Schedule follow-up — top-level published reviews only */}
            {!isFollowup && isPublished && review.is_visible && (
              <div className="bg-surface/50 border border-soft rounded-xl p-4">
                <p className="text-xs text-prose-faint font-medium uppercase tracking-widest mb-2">
                  Follow-up Reviews
                </p>
                <p className="text-sm text-prose-muted mb-1">
                  {followupCount === 0
                    ? 'No follow-ups scheduled yet.'
                    : `${followupCount} follow-up${followupCount === 1 ? '' : 's'} already in the timeline.`}
                </p>
                <p className="text-xs text-prose-faint mb-3">
                  A follow-up is a longform update — what changed, what you got wrong, would you buy it again.
                </p>
                {canScheduleFollowup ? (
                  <button
                    type="button"
                    onClick={() => setScheduleOpen(true)}
                    className="px-4 py-2.5 min-h-[44px] rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors"
                  >
                    + Schedule follow-up
                  </button>
                ) : (
                  <p className="text-xs text-prose-faint italic">
                    {parentAgeDays === null
                      ? 'Available once this review is published.'
                      : `Available in ${MIN_PARENT_AGE_DAYS - parentAgeDays} more day${MIN_PARENT_AGE_DAYS - parentAgeDays === 1 ? '' : 's'} (parent must be at least ${MIN_PARENT_AGE_DAYS} days old).`}
                  </p>
                )}
              </div>
            )}
            <InternalLinkPanel
              title={title}
              excerpt={excerpt}
              category={category}
              currentId={review.id}
              contentType="review"
              content={content}
              onChangeContent={setContent}
            />
            <SocialPostsPanel contentType="review" contentId={review.id} />
          </div>
        </div>

        {/* ── ADMIN ────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Admin</p>
          <div className="space-y-6">
            <VersionHistoryPanel contentType="review" contentId={review.id} />
            <ModerationInfo
              score={review.moderation_score}
              flags={review.moderation_flags ?? []}
              onAddressFlag={(flag) => {
                setRefineInstruction(`Address this moderation flag: ${flag}`)
                document.getElementById('ai-refine-instruction')?.focus()
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </div>
        </div>

    </WorkspaceShell>
  )
}
