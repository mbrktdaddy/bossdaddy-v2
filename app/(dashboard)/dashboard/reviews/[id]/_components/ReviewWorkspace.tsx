'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CATEGORIES } from '@/lib/categories'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { preserveImagesAcrossRefine } from '@/lib/inlineImages'
import { StatusBadge } from '@/components/workspace/StatusBadge'
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

const InlineMediaPanel = dynamic(
  () => import('@/components/workspace/InlineMediaPanel').then((m) => ({ default: m.InlineMediaPanel })),
  { ssr: false, loading: () => <div className="h-32 bg-gray-950 border border-gray-800 rounded-xl animate-pulse" /> },
)
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import { WorkspaceToolbar } from '@/components/workspace/WorkspaceToolbar'
import { AutoSaveIndicator } from '@/components/workspace/AutoSaveIndicator'
import { ListEditor } from '@/components/workspace/ListEditor'
import { TagPicker } from '@/components/workspace/TagPicker'
import { useAutoSave } from '@/components/workspace/useAutoSave'
import { useKeyboardShortcuts } from '@/components/workspace/useKeyboardShortcuts'
import { ReviewDraftPreview } from '@/components/workspace/ReviewDraftPreview'
import { RefinePreviewModal } from '@/components/workspace/RefinePreviewModal'

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
  product_id: string | null
  tldr: string | null
  key_takeaways: string[] | null
  best_for: string[] | null
  not_for: string[] | null
  faqs: FAQ[] | null
  tags?: string[]
}

const RATING_OPTIONS = [
  { value: 10, label: 'Flawless' },
  { value: 9,  label: 'Outstanding' },
  { value: 8,  label: 'Great' },
  { value: 7,  label: 'Good' },
  { value: 6,  label: 'Solid' },
  { value: 5,  label: 'Average' },
  { value: 4,  label: 'Below average' },
  { value: 3,  label: 'Poor' },
  { value: 2,  label: 'Bad' },
  { value: 1,  label: 'Avoid' },
]

export function ReviewWorkspace({ review }: { review: ReviewData }) {
  const router = useRouter()

  const [title, setTitle]             = useState(review.title)
  const [productName, setProductName] = useState(review.product_name)
  const [category, setCategory]       = useState(review.category)
  const [excerpt, setExcerpt]         = useState(review.excerpt ?? '')
  const [content, setContent]         = useState(review.content)
  const [imageUrl, setImageUrl]       = useState<string | null>(review.image_url)
  const [rating, setRating]           = useState<number>(review.rating ?? 7)
  const [pros, setPros]               = useState<string[]>(review.pros ?? [])
  const [cons, setCons]               = useState<string[]>(review.cons ?? [])
  const [disclosureAck, setDiscAck]   = useState<boolean>(review.disclosure_acknowledged ?? false)
  const [hasAffiliate, setHasAff]     = useState<boolean>(review.has_affiliate_links ?? false)
  const [metaTitle, setMetaTitle]     = useState(review.meta_title ?? '')
  const [metaDesc, setMetaDesc]       = useState(review.meta_description ?? '')
  const [scheduledAt, setScheduled]   = useState<string | null>(review.scheduled_publish_at)
  const [productSlug, setProductSlug] = useState<string | null>(review.product_slug)

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
    title?: string; excerpt?: string; rating?: number
    pros?: string[]; cons?: string[]
    tldr?: string; keyTakeaways?: string[]; bestFor?: string[]; notFor?: string[]
    faqs?: FAQ[]
  } | null>(null)

  useEffect(() => {
    const key = `bd:hero-prompt:${review.id}`
    const val = sessionStorage.getItem(key)
    if (val) { setHeroPromptSuggestion(val); sessionStorage.removeItem(key) }
  }, [review.id])

  const [refineInstruction, setRefineInstruction] = useState('')
  const [busy, setBusy]   = useState(false)
  const [actionErr, setErr] = useState<string | null>(null)
  const [actionMsg, setMsg] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const status = review.status
  const isPublished = status === 'approved'

  // Detect affiliate links whenever content changes; clear ack if links are removed
  useEffect(() => {
    const hasLinks = detectAffiliateLinks(content)
    setHasAff(hasLinks)
    if (!hasLinks) setDiscAck(false)
  }, [content])

  const payload = useMemo(() => ({
    title,
    product_name: productName,
    category,
    excerpt: excerpt || undefined,
    content,
    image_url: imageUrl,
    rating,
    pros: pros.filter(p => p.trim()),
    cons: cons.filter(c => c.trim()),
    disclosure_acknowledged: disclosureAck,
    meta_title:           metaTitle || null,
    meta_description:     metaDesc  || null,
    scheduled_publish_at: scheduledAt,
    product_slug:         productSlug,
    tldr:                 tldr || null,
    key_takeaways:        keyTakeaways,
    best_for:             bestFor,
    not_for:              notFor,
    faqs,
  }), [title, productName, category, excerpt, content, imageUrl, rating, pros, cons, disclosureAck, metaTitle, metaDesc, scheduledAt, productSlug, tldr, keyTakeaways, bestFor, notFor, faqs])

  const save = async (p: typeof payload) => {
    const [contentRes, tagsRes] = await Promise.all([
      fetch(`/api/reviews/${review.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      }),
      fetch(`/api/reviews/${review.id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      }),
    ])
    if (!contentRes.ok) {
      const json = await contentRes.json().catch(() => ({}))
      throw new Error(json.error ?? 'Save failed')
    }
    if (!tagsRes.ok) console.warn('Tag save failed — will retry on next save')
  }
  const autoSave = useAutoSave({ data: payload, saveFn: save, delay: 20000 })

  async function manualSave() {
    setErr(null); setMsg(null)
    try {
      await autoSave.triggerSave()
      setMsg('Saved')
      setTimeout(() => setMsg(null), 2000)
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Save failed')
    }
  }

  function applyPendingRefine() {
    if (!pendingRefine) return
    setContent(pendingRefine.content)
    if (pendingRefine.title) setTitle(pendingRefine.title)
    if (pendingRefine.excerpt) setExcerpt(pendingRefine.excerpt)
    if (pendingRefine.rating) setRating(pendingRefine.rating)
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

  const canPublish = !hasAffiliate || disclosureAck
  const publishBlockedReason = !canPublish
    ? 'Acknowledge the affiliate disclosure before publishing (see section below).'
    : null

  const readinessChecks = [
    { label: 'Title',      done: title.trim().length >= 10 },
    { label: 'Hero image', done: !!imageUrl },
    { label: 'Excerpt',    done: excerpt.trim().length > 0 },
    { label: 'Pros',       done: pros.filter(p => p.trim()).length >= 3 },
    { label: 'Cons',       done: cons.filter(c => c.trim()).length >= 2 },
    { label: 'Rating',     done: rating >= 1 },
    { label: 'Content',    done: content.replace(/<[^>]+>/g, '').trim().length >= 100 },
    { label: 'No placeholders', done: !content.includes('bd-image-placeholder') },
    ...(hasAffiliate ? [{ label: 'Disclosure', done: disclosureAck }] : []),
  ]

  async function publishOrUnpublish(action: 'approve' | 'unpublish') {
    if (action === 'approve' && !canPublish) {
      setErr(publishBlockedReason ?? 'Cannot publish yet.')
      return
    }
    setBusy(true); setErr(null); setMsg(null)
    try {
      await save(payload)
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Action failed')
      }
      setMsg(action === 'approve' ? '✓ Published' : 'Unpublished')
      setTimeout(() => router.refresh(), 600)
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Action failed')
    }
    setBusy(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this review permanently? This cannot be undone.')) return
    setDeleting(true); setErr(null)
    const res = await fetch(`/api/reviews/${review.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setErr(json.error ?? 'Delete failed')
      setDeleting(false)
      return
    }
    router.push('/dashboard/reviews')
    router.refresh()
  }

  async function handleDuplicate() {
    setBusy(true); setErr(null)
    const res = await fetch(`/api/reviews/${review.id}/duplicate`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setErr(json.error ?? 'Duplicate failed')
      setBusy(false)
      return
    }
    router.push(`/dashboard/reviews/${json.review.id}`)
    router.refresh()
  }

  useKeyboardShortcuts({
    'mod+s':     () => manualSave(),
    'mod+enter': () => { if (!isPublished) publishOrUnpublish('approve') },
  })

  const previewUrl = isPublished && review.slug ? `/reviews/${review.slug}` : null
  const createdAt  = new Date(review.created_at ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-4 sm:p-8 max-w-4xl">

      <WorkspaceHeader
        backHref="/dashboard/reviews"
        backLabel="All reviews"
        title={title || 'Untitled'}
        subtitle={`${productName || '—'} · ${rating}/10 · Created ${createdAt}${review.reading_time_minutes ? ` · ${review.reading_time_minutes} min read` : ''}`}
        rightSlot={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <AutoSaveIndicator state={autoSave.state} error={autoSave.error} />
            <StatusBadge status={status} />
          </div>
        }
      />

      {review.rejection_reason && ['draft', 'rejected'].includes(status) && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-950/40 border border-yellow-900/40">
          <p className="text-sm text-yellow-300">
            <strong>Edits requested:</strong> {review.rejection_reason}
          </p>
        </div>
      )}

      {/* Preview + edit two-column layout on xl screens */}
      <div className={previewOpen ? 'xl:flex xl:gap-6 xl:items-start' : ''}>

      {/* ── Editor column ─────────────────────────────────────────────── */}
      <div className={`space-y-6 ${previewOpen ? 'xl:flex-1 xl:min-w-0' : ''}`}>

        {/* ── STORY ────────────────────────────────────────────────────── */}
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold">Story</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Product Name</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Review Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Rating</label>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {RATING_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.value}/10 · {r.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-300 mb-1.5">Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="pt-4 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Tags</p>
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
              rating:  draft.rating ? Math.round(draft.rating) : undefined,
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
          <ListEditor label="The Good (Pros)" items={pros} onChange={setPros} placeholder="e.g. Long battery life" accent="text-green-400" />
          <ListEditor label="The Not-So-Good (Cons)" items={cons} onChange={setCons} placeholder="e.g. Runs hot under load" accent="text-red-400" />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Content</label>
          <TiptapEditor
            value={content}
            onChange={setContent}
            targetWords={CATEGORIES.find(c => c.slug === category)?.targetWords}
          />
          <p className="mt-1.5 text-xs text-gray-600">
            Primary CTA is set via Product &amp; Monetization below. Use <code className="text-orange-400">[[BUY:product-slug]]</code> inline for mid-article mentions — resolves to a link on save.
          </p>
        </div>

        {/* ── CONTENT BLOCKS ───────────────────────────────────────────── */}
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">Content Blocks</p>
          <p className="text-xs text-gray-600 mb-4">These render as structured UI elements on the public page — not prose. Generated automatically by AI drafts; edit freely.</p>
          <div className="space-y-6">

            {/* TL;DR */}
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">TL;DR <span className="text-gray-600 font-normal">— 2–3 sentence skimmer summary</span></label>
              <textarea
                value={tldr}
                onChange={(e) => setTldr(e.target.value)}
                rows={3}
                placeholder="e.g. The Enfamil Enspire Ready-to-Feed is the easiest formula I've ever used at 4 AM. The nutritional profile is the closest thing to breast milk on the market, and our daughter took to it immediately after rejecting two other brands. The price is steep, but for tired dads doing solo feedings, it's worth it."
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y text-sm"
              />
            </div>

            {/* Key Takeaways + Best/Not For */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ListEditor
                label="Key Takeaways"
                items={keyTakeaways}
                onChange={setKeyTakeaways}
                placeholder="e.g. Zero prep at 4 AM — crack and pour"
                accent="text-orange-400"
              />
              <ListEditor
                label="Best For"
                items={bestFor}
                onChange={setBestFor}
                placeholder="e.g. Dads doing solo overnight feedings"
                accent="text-green-400"
              />
              <ListEditor
                label="Not For"
                items={notFor}
                onChange={setNotFor}
                placeholder="e.g. Families on a tight formula budget"
                accent="text-red-400"
              />
            </div>

            {/* FAQs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-300">FAQs</label>
                <button
                  type="button"
                  onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  + Add question
                </button>
              </div>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-600 mt-2 shrink-0">Q</span>
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => setFaqs(faqs.map((f, j) => j === i ? { ...f, question: e.target.value } : f))}
                        placeholder="e.g. Is Enfamil Enspire Ready-to-Feed worth the price?"
                        className="flex-1 px-3 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                        className="text-gray-600 hover:text-red-400 transition-colors text-xs mt-2"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-600 mt-2 shrink-0">A</span>
                      <textarea
                        value={faq.answer}
                        onChange={(e) => setFaqs(faqs.map((f, j) => j === i ? { ...f, answer: e.target.value } : f))}
                        placeholder="2–3 sentences. Direct, specific, first-person."
                        rows={2}
                        className="flex-1 px-3 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                      />
                    </div>
                  </div>
                ))}
                {faqs.length === 0 && (
                  <p className="text-xs text-gray-600 italic">No FAQs yet. Add questions readers commonly search for — great for SEO.</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── MEDIA ────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Media</p>
          <div className="space-y-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-3">Product / hero image</p>
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
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-3">Inline images</p>
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
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Commerce</p>
          <div className="space-y-6">
            <PrimaryProductPanel value={productSlug} onChange={setProductSlug} />
            <ProductLinkPanel
              content={content}
              onChangeContent={setContent}
            />
            {hasAffiliate && (
              <div className="bg-orange-950/40 border border-orange-900/40 rounded-xl p-4">
                <p className="text-sm text-orange-300 font-semibold mb-2">⚠ Affiliate links detected</p>
                <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disclosureAck}
                    onChange={(e) => setDiscAck(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I confirm this review contains affiliate links. FTC disclosure will be auto-inserted before publishing.
                    <a href="/affiliate-disclosure" target="_blank" className="ml-1 text-orange-400 hover:text-orange-300">Learn more →</a>
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* ── DISTRIBUTION ─────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Publish &amp; Distribute</p>
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
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Admin</p>
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

        {actionErr && (
          <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{actionErr}</p>
        )}
        {actionMsg && (
          <p className="text-green-400 text-sm bg-green-950/40 border border-green-800/40 rounded-lg px-4 py-3">{actionMsg}</p>
        )}

        <p className="text-xs text-gray-600">
          ⌨ <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘S</kbd> save · <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘↵</kbd> publish · <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘Z</kbd> undo · <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘⇧Z</kbd> redo
        </p>

      </div>{/* end editor column */}

      {/* ── Live preview column (xl only) ─────────────────────────────── */}
      {previewOpen && (
        <div className="hidden xl:block w-[420px] shrink-0 sticky top-6 self-start">
          <ReviewDraftPreview
            title={title}
            productName={productName}
            rating={rating}
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
          />
        </div>
      )}

      </div>{/* end preview+edit flex wrapper */}

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

      {/* Refine diff modal — shows before/after before applying changes */}
      {pendingRefine && (
        <RefinePreviewModal
          before={content}
          after={pendingRefine.content}
          onAccept={applyPendingRefine}
          onDiscard={() => setPendingRefine(null)}
        />
      )}
    </div>
  )
}
