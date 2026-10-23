'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { CATEGORIES } from '@/lib/categories'
import { assembleDraftHtml } from '@/lib/content/html'
import { preserveBlocksAcrossRefine } from '@/lib/content/markers'
import { replaceSectionProse, splitSections } from '@/lib/content/sections'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { TiptapEditor } from '@/components/workspace/TiptapEditor'
import { HeroImagePanel } from '@/components/workspace/HeroImagePanel'
import { AIRefinePanel } from '@/components/workspace/AIRefinePanel'
import { ModerationInfo } from '@/components/workspace/ModerationInfo'
import { SEOPanel } from '@/components/workspace/SEOPanel'
import { SchedulePanel } from '@/components/workspace/SchedulePanel'
import { FollowupIntentPanel } from '@/components/workspace/FollowupIntentPanel'
import { VersionHistoryPanel } from '@/components/workspace/VersionHistoryPanel'
import { InternalLinkPanel } from '@/components/workspace/InternalLinkPanel'
import { SocialPostsPanel } from '@/components/workspace/SocialPostsPanel'
import { ProductLinkPanel } from '@/components/workspace/ProductLinkPanel'
import { WorkspaceToolbar } from '@/components/workspace/WorkspaceToolbar'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { ListEditor } from '@/components/workspace/ListEditor'
import { TagPicker } from '@/components/workspace/TagPicker'
import { RefinePreviewModal } from '@/components/workspace/RefinePreviewModal'
import { useContentWorkspace } from '@/components/workspace/useContentWorkspace'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'

const InlineMediaPanel = dynamic(
  () => import('@/components/workspace/InlineMediaPanel').then((m) => ({ default: m.InlineMediaPanel })),
  { ssr: false, loading: () => <Card tone="sunken" className="h-32 animate-pulse" /> },
)

interface FAQ { question: string; answer: string }

interface GuideData {
  /** Inquiry register tri-state (mig 164); null = pillar default. */
  inquiry_mode?: boolean | null
  id: string
  title: string
  category: string
  excerpt: string | null
  content: string
  image_url: string | null
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
  tldr: string | null
  key_takeaways: string[] | null
  faqs: FAQ[] | null
  tags?: string[]
  // Freshness (mig 167): the refresh plan + the last "still current" check.
  followup_intent_at: string | null
  last_verified_at: string | null
}

interface Props {
  guide: GuideData
  /** Sum of the generations behind this piece, for the header (null = none logged). */
  generationCostUsd?: number | null
}

export function GuideWorkspace({ guide: article, generationCostUsd = null }: Props) {
  const [title, setTitle]           = useState(article.title)
  const [category, setCategory]     = useState(article.category)
  const [excerpt, setExcerpt]       = useState(article.excerpt ?? '')
  const [content, setContent]       = useState(article.content)
  const [imageUrl, setImageUrl]     = useState<string | null>(article.image_url)
  const [metaTitle, setMetaTitle]   = useState(article.meta_title ?? '')
  const [metaDesc, setMetaDesc]     = useState(article.meta_description ?? '')
  const [scheduledAt, setScheduled] = useState<string | null>(article.scheduled_publish_at)
  const [followupIntentAt, setFollowupIntentAt] = useState<string | null>(article.followup_intent_at)
  const [lastVerifiedAt, setLastVerifiedAt]     = useState<string | null>(article.last_verified_at)
  const [disclosureAck, setDiscAck] = useState<boolean>(article.disclosure_acknowledged ?? false)

  const [tags, setTags]                 = useState<string[]>(article.tags ?? [])
  const [tldr, setTldr]                 = useState(article.tldr ?? '')
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>(article.key_takeaways ?? [])
  const [faqs, setFaqs]                 = useState<FAQ[]>(article.faqs ?? [])

  const [heroPromptSuggestion, setHeroPromptSuggestion] = useState('')

  useEffect(() => {
    const key = `bd:hero-prompt:${article.id}`
    const val = sessionStorage.getItem(key)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (val) { setHeroPromptSuggestion(val); sessionStorage.removeItem(key) }
  }, [article.id])

  const [pendingRefine, setPendingRefine] = useState<{
    content: string
    title?: string; excerpt?: string
    tldr?: string; keyTakeaways?: string[]; faqs?: FAQ[]
    // Preview framing: a section refine shows just that section; whole-piece
    // refines list the blocks they would overwrite.
    before?: string; after?: string; heading?: string; warnings?: string[]
    blockChanges?: { label: string; before: string; after: string }[]
  } | null>(null)

  // Set when a refine is accepted; rides on the next save as `revision_label`
  // so the snapshot of the pre-refine state is marked in version history, then
  // clears once that save lands. A ref, not state: the payload memo already
  // recomputes on the content change, and clearing must not trigger a save.
  const revisionLabelRef = useRef<'pre-ai-refine' | null>(null)

  const [refineInstruction, setRefineInstruction] = useState('')

  const status = article.status
  const isPublished = status === 'approved'

  // Derived, not stored — content fully determines it, and the server
  // recomputes the same thing with `detectAffiliateLinks` on every save. Mirrors
  // ReviewWorkspace, including the decision NOT to auto-clear disclosureAck when
  // this flips false: the publish gate and the checklist both already condition
  // on hasAffiliate, and preserving an explicit acknowledgement across
  // link-toggle cycles is the better UX.
  const hasAffiliate = useMemo(() => detectAffiliateLinks(content), [content])

  const payload = useMemo(() => ({
    title,
    category,
    excerpt:              excerpt || undefined,
    content,
    image_url:            imageUrl,
    meta_title:           metaTitle || null,
    meta_description:     metaDesc  || null,
    scheduled_publish_at: scheduledAt,
    followup_intent_at:   followupIntentAt,
    last_verified_at:     lastVerifiedAt,
    tldr:                 tldr || null,
    key_takeaways:        keyTakeaways,
    faqs,
    disclosure_acknowledged: disclosureAck,
  }), [title, category, excerpt, content, imageUrl, metaTitle, metaDesc, scheduledAt, followupIntentAt, lastVerifiedAt, tldr, keyTakeaways, faqs, disclosureAck])

  const { busy, actionErr, actionMsg, setMsg, deleting, autoSave, manualSave, publishOrUnpublish, handleDelete, handleDuplicate } =
    useContentWorkspace({
      id: article.id, contentType: 'guide', payload, tags, isPublished,
      extraPayload: () => (revisionLabelRef.current ? { revision_label: revisionLabelRef.current } : {}),
      onSaved: () => { revisionLabelRef.current = null },
    })

  function applyPendingRefine() {
    if (!pendingRefine) return
    revisionLabelRef.current = 'pre-ai-refine'
    setContent(pendingRefine.content)
    if (pendingRefine.title)        setTitle(pendingRefine.title)
    if (pendingRefine.excerpt)      setExcerpt(pendingRefine.excerpt)
    if (pendingRefine.tldr)         setTldr(pendingRefine.tldr)
    if (pendingRefine.keyTakeaways) setKeyTakeaways(pendingRefine.keyTakeaways)
    if (pendingRefine.faqs)         setFaqs(pendingRefine.faqs)
    setPendingRefine(null)
    setMsg('Changes applied')
    setTimeout(() => setMsg(null), 3000)
  }

  const readinessChecks = [
    { label: 'Title',      done: title.trim().length >= 10 },
    { label: 'Hero image', done: !!imageUrl },
    { label: 'Excerpt',    done: excerpt.trim().length > 0 },
    { label: 'TL;DR',      done: tldr.trim().length > 0 },
    { label: 'Content',    done: content.replace(/<[^>]+>/g, '').trim().length >= 100 },
    { label: 'No placeholders', done: !content.includes('bd-image-placeholder') },
    ...(hasAffiliate ? [{ label: 'Disclosure', done: disclosureAck }] : []),
  ]

  const previewUrl = isPublished && article.slug ? `/guides/${article.slug}` : null
  const createdAt  = new Date(article.created_at ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <WorkspaceShell
      backHref="/dashboard/guides"
      backLabel="All guides"
      title={title}
      subtitle={`Created ${createdAt}${article.reading_time_minutes ? ` · ${article.reading_time_minutes} min read` : ''}${generationCostUsd != null ? ` · $${generationCostUsd.toFixed(2)} to draft` : ''}`}
      status={status}
      autoSave={autoSave}
      rejectionReason={article.rejection_reason}
      actionErr={actionErr}
      actionMsg={actionMsg}
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
          readinessChecks={readinessChecks}
        />
      }
      modals={
        pendingRefine && (
          <RefinePreviewModal
            before={pendingRefine.before ?? content}
            after={pendingRefine.after ?? pendingRefine.content}
            heading={pendingRefine.heading}
            warnings={pendingRefine.warnings}
            blockChanges={pendingRefine.blockChanges}
            onAccept={applyPendingRefine}
            onDiscard={() => setPendingRefine(null)}
          />
        )
      }
    >

      {/* ── STORY ────────────────────────────────────────────────────── */}
      <Eyebrow>Story</Eyebrow>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm text-prose-muted mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
            {CATEGORIES.map(c => (
              <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">Excerpt <span className="text-prose-faint">(shown on listing pages)</span></label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover resize-none"
        />
      </div>

      {/* Tags */}
      <div className="pt-4 border-t border-soft">
        <Eyebrow className="mb-3">Tags</Eyebrow>
        <TagPicker selected={tags} onChange={setTags} />
      </div>

      <AIRefinePanel
        title={title}
        category={category}
        content={content}
        contentType="guide"
        externalInstruction={refineInstruction}
        onExternalInstructionUsed={() => setRefineInstruction('')}
        contentId={article.id}
        inquiryMode={article.inquiry_mode}
        blocks={{ tldr, keyTakeaways, faqs }}
        onRefinedSection={({ index, text, warnings }) => {
          // One section rewritten in place; everything else is byte-identical.
          const next = replaceSectionProse(content, index, text)
          const was = splitSections(content)[index]
          setPendingRefine({
            content: next,
            before: was?.html ?? content,
            after: splitSections(next)[index]?.html ?? next,
            heading: `Section: ${was?.heading ?? 'Introduction'}`,
            warnings,
          })
        }}
        onRefined={(draft) => {
          const d = draft as Record<string, unknown>
          const refinedContent = assembleDraftHtml({
            introduction: draft.introduction,
            sections: draft.sections,
            closing: draft.conclusion ? { heading: 'Wrapping Up', body: draft.conclusion } : null,
          })
          // Figures, galleries, embeds and cross-link cards survive the rewrite.
          const { content: merged } = preserveBlocksAcrossRefine(content, refinedContent)

          // Every block the refine would overwrite, shown in the preview.
          const faqText = (f: FAQ[]) => f.map((x) => `Q: ${x.question}\nA: ${x.answer}`).join('\n\n')
          const changes: { label: string; before: string; after: string }[] = []
          if (draft.title && draft.title !== title) changes.push({ label: 'Title', before: title, after: draft.title })
          if (draft.excerpt && draft.excerpt !== excerpt) changes.push({ label: 'Excerpt', before: excerpt, after: draft.excerpt })
          if (typeof d.tldr === 'string' && d.tldr !== tldr) changes.push({ label: 'TL;DR', before: tldr, after: d.tldr })
          if (Array.isArray(d.keyTakeaways) && JSON.stringify(d.keyTakeaways) !== JSON.stringify(keyTakeaways)) changes.push({ label: 'Key takeaways', before: keyTakeaways.join('\n'), after: (d.keyTakeaways as string[]).join('\n') })
          if (Array.isArray(d.faqs) && JSON.stringify(d.faqs) !== JSON.stringify(faqs)) changes.push({ label: 'FAQs', before: faqText(faqs), after: faqText(d.faqs as FAQ[]) })

          setPendingRefine({
            content: merged,
            blockChanges: changes,
            title:        draft.title,
            excerpt:      draft.excerpt,
            tldr:         d.tldr as string | undefined,
            keyTakeaways: d.keyTakeaways as string[] | undefined,
            faqs:         d.faqs as FAQ[] | undefined,
          })
        }}
      />

      <div>
        <label className="block text-sm text-prose-muted mb-1.5">Content</label>
        <TiptapEditor
          value={content}
          onChange={setContent}
          targetWords={CATEGORIES.find(c => c.slug === category)?.targetWords}
          enableCollectionEmbed
          enableCrossLink
        />
        <p className="mt-1.5 text-xs text-prose-faint">
          Use <code className="text-accent-text-soft">[[BUY:product-slug]]</code> inline for product mentions — resolves to a link on save.
        </p>
      </div>

      {/* ── CONTENT BLOCKS ───────────────────────────────────────────── */}
      <div className="pt-6 border-t border-soft">
        <Eyebrow className="mb-1">Content Blocks</Eyebrow>
        <p className="text-xs text-prose-faint mb-4">Render as structured UI elements on the public page — not prose. Generated by AI drafts; edit freely.</p>
        <div className="space-y-6">

          {/* TL;DR */}
          <div>
            <label className="block text-sm text-prose-muted mb-1.5">TL;DR <span className="text-prose-faint font-normal">— 2–3 sentence skimmer summary</span></label>
            <textarea
              value={tldr}
              onChange={(e) => setTldr(e.target.value)}
              rows={3}
              placeholder="e.g. Choosing the right formula comes down to three things: your baby's digestive needs, your budget, and how they respond in the first week. Most healthy full-term babies do fine on any standard formula. If you see gassiness or fussiness, a gentle or sensitive version is worth trying before going straight to specialty."
              className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover resize-y text-sm"
            />
          </div>

          {/* Key Takeaways */}
          <div>
            <ListEditor
              label="Key Takeaways"
              items={keyTakeaways}
              onChange={setKeyTakeaways}
              placeholder="e.g. Most babies don't need specialty formula — start with standard"
              accent="text-accent-text-soft"
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
                <Card key={i} className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-prose-faint mt-2 shrink-0">Q</span>
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => setFaqs(faqs.map((f, j) => j === i ? { ...f, question: e.target.value } : f))}
                      placeholder="e.g. How do I know if my baby needs a different formula?"
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
                      placeholder="2–3 sentences. Direct and practical."
                      rows={2}
                      className="flex-1 px-3 py-1.5 bg-surface-sunken border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover resize-none"
                    />
                  </div>
                </Card>
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
        <Eyebrow className="mb-4">Media</Eyebrow>
        <div className="space-y-4">
          <Card tone="faint" className="p-4 space-y-1.5">
            <p className="text-xs text-prose-faint font-medium uppercase tracking-widest mb-3">Hero image</p>
            <HeroImagePanel
              imageUrl={imageUrl}
              onChange={setImageUrl}
              contentType="guide"
              sourceId={article.id}
              title={title}
              category={category}
              excerpt={excerpt}
              initialPrompt={heroPromptSuggestion}
            />
          </Card>
          <Card tone="faint" className="p-4">
            <p className="text-xs text-prose-faint font-medium uppercase tracking-widest mb-3">Inline images</p>
            <InlineMediaPanel
              content={content}
              onChangeContent={setContent}
              category={category}
              contentType="guide"
              contentId={article.id}
            />
          </Card>
        </div>
      </div>

      {/* ── PRODUCT & MONETIZATION ───────────────────────────────────── */}
      <div className="pt-6 border-t border-soft">
        <Eyebrow className="mb-4">Product &amp; Monetization</Eyebrow>
        <ProductLinkPanel
          content={content}
          onChangeContent={setContent}
        />
        {hasAffiliate && (
          <div className="mt-4 bg-accent-tint border border-accent-border/40 rounded-xl p-4">
            <p className="text-sm text-accent-text font-semibold mb-2">⚠ Affiliate links detected</p>
            <label className="flex items-start gap-2 text-sm text-prose-muted cursor-pointer">
              <input
                type="checkbox"
                checked={disclosureAck}
                onChange={(e) => setDiscAck(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I confirm this guide contains affiliate links. FTC disclosure will be auto-inserted before publishing.
                <a href="/affiliate-disclosure" target="_blank" rel="noopener noreferrer" className="ml-1 text-accent-text-soft hover:text-accent">Learn more →</a>
              </span>
            </label>
          </div>
        )}
      </div>

      {/* ── DISTRIBUTION ─────────────────────────────────────────────── */}
      <div className="pt-6 border-t border-soft">
        <Eyebrow className="mb-4">Distribution</Eyebrow>
        <div className="space-y-6">
          <SEOPanel
            metaTitle={metaTitle}
            metaDescription={metaDesc}
            fallbackTitle={title}
            fallbackDescription={excerpt}
            slug={article.slug}
            contentType="guide"
            onChangeTitle={setMetaTitle}
            onChangeDescription={setMetaDesc}
          />
          {!isPublished && (
            <SchedulePanel scheduledAt={scheduledAt} onChange={setScheduled} />
          )}
          {/* Refresh plan — any status (set it while the context is fresh) */}
          <FollowupIntentPanel
            contentType="guide"
            intentAt={followupIntentAt}
            onChangeIntent={setFollowupIntentAt}
            lastVerifiedAt={lastVerifiedAt}
            onMarkVerified={() => setLastVerifiedAt(new Date().toISOString())}
            disabled={busy}
          />
          <InternalLinkPanel
            title={title}
            excerpt={excerpt}
            category={category}
            currentId={article.id}
            contentType="guide"
            content={content}
            onChangeContent={setContent}
          />
          <SocialPostsPanel contentType="guide" contentId={article.id} />
        </div>
      </div>

      {/* ── ADMIN ────────────────────────────────────────────────────── */}
      <div className="pt-6 border-t border-soft">
        <Eyebrow className="mb-4">Admin</Eyebrow>
        <div className="space-y-6">
          <VersionHistoryPanel contentType="guide" contentId={article.id} />
          <ModerationInfo
            score={article.moderation_score}
            flags={article.moderation_flags ?? []}
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
