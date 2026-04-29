'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CATEGORIES } from '@/lib/categories'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { preserveImagesAcrossRefine } from '@/lib/inlineImages'
import { StatusBadge } from '@/components/workspace/StatusBadge'
import { ContentEditor } from '@/components/workspace/ContentEditor'
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
import { useAutoSave } from '@/components/workspace/useAutoSave'
import { useKeyboardShortcuts } from '@/components/workspace/useKeyboardShortcuts'

interface ReviewData {
  id: string
  title: string
  product_name: string
  category: string
  excerpt: string | null
  content: string
  image_url: string | null
  rating: number
  pros: string[] | null
  cons: string[] | null
  has_affiliate_links: boolean
  disclosure_acknowledged: boolean
  status: string
  slug: string | null
  moderation_score: number | null
  moderation_flags: string[] | null
  created_at: string
  updated_at: string
  reading_time_minutes: number | null
  rejection_reason: string | null
  meta_title: string | null
  meta_description: string | null
  scheduled_publish_at: string | null
  product_slug: string | null
  product_id: string | null
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

  const [heroPromptSuggestion, setHeroPromptSuggestion] = useState('')

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

  // Detect affiliate links whenever content changes
  useEffect(() => { setHasAff(detectAffiliateLinks(content)) }, [content])

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
  }), [title, productName, category, excerpt, content, imageUrl, rating, pros, cons, disclosureAck, metaTitle, metaDesc, scheduledAt, productSlug])

  const save = async (p: typeof payload) => {
    const res = await fetch(`/api/reviews/${review.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error ?? 'Save failed')
    }
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

  const canPublish = !hasAffiliate || disclosureAck
  const publishBlockedReason = !canPublish
    ? 'Acknowledge the affiliate disclosure before publishing (see section below).'
    : null

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
  const createdAt  = new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

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

      <div className="space-y-6">

        {/* ── CORE ─────────────────────────────────────────────────────── */}
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold">Core</p>

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

        <AIRefinePanel
          title={title}
          category={category}
          content={content}
          productName={productName}
          contentType="review"
          externalInstruction={refineInstruction}
          onExternalInstructionUsed={() => setRefineInstruction('')}
          onRefined={(draft) => {
            if (draft.title) setTitle(draft.title)
            if (draft.excerpt) setExcerpt(draft.excerpt)
            if (draft.rating) setRating(Math.round(draft.rating))
            if (draft.pros?.length) setPros(draft.pros)
            if (draft.cons?.length) setCons(draft.cons)
            const refinedContent = [
              draft.introduction,
              ...(draft.sections ?? []).map((s) => {
                const bodyHtml = s.body.split(/\n\n+/).map((p) => `<p>${p.trim()}</p>`).join('\n')
                return `<h2>${s.heading}</h2>\n${bodyHtml}`
              }),
              draft.verdict ? `<h2>The Verdict</h2>\n<p>${draft.verdict}</p>` : '',
            ].filter(Boolean).join('\n\n')
            const { content: merged, preservedCount, appendedCount } = preserveImagesAcrossRefine(content, refinedContent)
            setContent(merged)
            if (preservedCount > 0) {
              const note = appendedCount > 0
                ? `Refined • Preserved ${preservedCount} inline image${preservedCount === 1 ? '' : 's'} (${appendedCount} appended at end — re-position from the panel)`
                : `Refined • Preserved ${preservedCount} inline image${preservedCount === 1 ? '' : 's'}`
              setMsg(note)
              setTimeout(() => setMsg(null), 5000)
            }
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ListEditor label="The Good (Pros)" items={pros} onChange={setPros} placeholder="e.g. Long battery life" accent="text-green-400" />
          <ListEditor label="The Not-So-Good (Cons)" items={cons} onChange={setCons} placeholder="e.g. Runs hot under load" accent="text-red-400" />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Content <span className="text-gray-600">(HTML)</span></label>
          <ContentEditor
            value={content}
            onChange={setContent}
            targetWords={CATEGORIES.find(c => c.slug === category)?.targetWords}
          />
          <p className="mt-1.5 text-xs text-gray-600">
            Primary CTA is set via the Product &amp; Monetization section below. Use <code className="text-orange-400">[[BUY:product-slug]]</code> inline only for natural mid-article mentions.
          </p>
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

        {/* ── PRODUCT & MONETIZATION ───────────────────────────────────── */}
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Product &amp; Monetization</p>
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
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Distribution</p>
          <div className="space-y-6">
            <SEOPanel
              metaTitle={metaTitle}
              metaDescription={metaDesc}
              fallbackTitle={title}
              fallbackDescription={excerpt}
              slug={review.slug}
              contentType="review"
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
          ⌨ <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘S</kbd> save · <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘↵</kbd> publish · <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘⇧P</kbd> toggle preview
        </p>

      </div>

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
      />
    </div>
  )
}
