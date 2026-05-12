'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { CATEGORIES } from '@/lib/categories'
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
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import { WorkspaceToolbar } from '@/components/workspace/WorkspaceToolbar'
import { AutoSaveIndicator } from '@/components/workspace/AutoSaveIndicator'
import { ListEditor } from '@/components/workspace/ListEditor'
import { TagPicker } from '@/components/workspace/TagPicker'
import { RefinePreviewModal } from '@/components/workspace/RefinePreviewModal'
import { useContentWorkspace } from '@/components/workspace/useContentWorkspace'

const InlineMediaPanel = dynamic(
  () => import('@/components/workspace/InlineMediaPanel').then((m) => ({ default: m.InlineMediaPanel })),
  { ssr: false, loading: () => <div className="h-32 bg-gray-950 border border-gray-800 rounded-xl animate-pulse" /> },
)

interface FAQ { question: string; answer: string }

interface GuideData {
  id: string
  title: string
  category: string
  excerpt: string | null
  content: string
  image_url: string | null
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
}

interface Props {
  guide: GuideData
}

export function GuideWorkspace({ guide: article }: Props) {
  const [title, setTitle]           = useState(article.title)
  const [category, setCategory]     = useState(article.category)
  const [excerpt, setExcerpt]       = useState(article.excerpt ?? '')
  const [content, setContent]       = useState(article.content)
  const [imageUrl, setImageUrl]     = useState<string | null>(article.image_url)
  const [metaTitle, setMetaTitle]   = useState(article.meta_title ?? '')
  const [metaDesc, setMetaDesc]     = useState(article.meta_description ?? '')
  const [scheduledAt, setScheduled] = useState<string | null>(article.scheduled_publish_at)

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
  } | null>(null)

  const [refineInstruction, setRefineInstruction] = useState('')

  const status = article.status
  const isPublished = status === 'approved'

  const payload = useMemo(() => ({
    title,
    category,
    excerpt:              excerpt || undefined,
    content,
    image_url:            imageUrl,
    meta_title:           metaTitle || null,
    meta_description:     metaDesc  || null,
    scheduled_publish_at: scheduledAt,
    tldr:                 tldr || null,
    key_takeaways:        keyTakeaways,
    faqs,
  }), [title, category, excerpt, content, imageUrl, metaTitle, metaDesc, scheduledAt, tldr, keyTakeaways, faqs])

  const { busy, actionErr, actionMsg, setMsg, deleting, autoSave, manualSave, publishOrUnpublish, handleDelete, handleDuplicate } =
    useContentWorkspace({ id: article.id, contentType: 'guide', payload, tags, isPublished })

  function applyPendingRefine() {
    if (!pendingRefine) return
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
  ]

  const previewUrl = isPublished && article.slug ? `/guides/${article.slug}` : null
  // timeZone: 'UTC' prevents the React 19 hydration mismatch — server (UTC)
  // and client (local TZ) must produce identical strings.
  const createdAt  = new Date(article.created_at ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className="p-4 sm:p-8 max-w-4xl">

      <WorkspaceHeader
        backHref="/dashboard/guides"
        backLabel="All guides"
        title={title || 'Untitled'}
        subtitle={`Created ${createdAt}${article.reading_time_minutes ? ` · ${article.reading_time_minutes} min read` : ''}`}
        rightSlot={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <AutoSaveIndicator state={autoSave.state} error={autoSave.error} />
            <StatusBadge status={status} />
          </div>
        }
      />

      {article.rejection_reason && ['draft', 'rejected'].includes(status) && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-950/40 border border-yellow-900/40">
          <p className="text-sm text-yellow-300">
            <strong>Edits requested:</strong> {article.rejection_reason}
          </p>
        </div>
      )}

      <div className="space-y-6">

        {/* ── STORY ────────────────────────────────────────────────────── */}
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold">Story</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-300 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              {CATEGORIES.map(c => (
                <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Excerpt <span className="text-gray-600">(shown on listing pages)</span></label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
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
          contentType="guide"
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
              draft.conclusion ? `<h2>Wrapping Up</h2>\n<p>${draft.conclusion}</p>` : '',
            ].filter(Boolean).join('\n\n')
            const { content: merged } = preserveImagesAcrossRefine(content, refinedContent)
            setPendingRefine({
              content: merged,
              title:        draft.title,
              excerpt:      draft.excerpt,
              tldr:         d.tldr as string | undefined,
              keyTakeaways: d.keyTakeaways as string[] | undefined,
              faqs:         d.faqs as FAQ[] | undefined,
            })
          }}
        />

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Content</label>
          <TiptapEditor
            value={content}
            onChange={setContent}
            targetWords={CATEGORIES.find(c => c.slug === category)?.targetWords}
          />
          <p className="mt-1.5 text-xs text-gray-600">
            Use <code className="text-orange-400">[[BUY:product-slug]]</code> inline for product mentions — resolves to a link on save.
          </p>
        </div>

        {/* ── CONTENT BLOCKS ───────────────────────────────────────────── */}
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">Content Blocks</p>
          <p className="text-xs text-gray-600 mb-4">Render as structured UI elements on the public page — not prose. Generated by AI drafts; edit freely.</p>
          <div className="space-y-6">

            {/* TL;DR */}
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">TL;DR <span className="text-gray-600 font-normal">— 2–3 sentence skimmer summary</span></label>
              <textarea
                value={tldr}
                onChange={(e) => setTldr(e.target.value)}
                rows={3}
                placeholder="e.g. Choosing the right formula comes down to three things: your baby's digestive needs, your budget, and how they respond in the first week. Most healthy full-term babies do fine on any standard formula. If you see gassiness or fussiness, a gentle or sensitive version is worth trying before going straight to specialty."
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y text-sm"
              />
            </div>

            {/* Key Takeaways */}
            <div>
              <ListEditor
                label="Key Takeaways"
                items={keyTakeaways}
                onChange={setKeyTakeaways}
                placeholder="e.g. Most babies don't need specialty formula — start with standard"
                accent="text-orange-400"
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
                        placeholder="e.g. How do I know if my baby needs a different formula?"
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
                        placeholder="2–3 sentences. Direct and practical."
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
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 space-y-1.5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-3">Hero image</p>
              <HeroImagePanel
                imageUrl={imageUrl}
                onChange={setImageUrl}
                contentType="guide"
                title={title}
                category={category}
                excerpt={excerpt}
                initialPrompt={heroPromptSuggestion}
              />
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-3">Inline images</p>
              <InlineMediaPanel
                content={content}
                onChangeContent={setContent}
                category={category}
              />
            </div>
          </div>
        </div>

        {/* ── PRODUCT & MONETIZATION ───────────────────────────────────── */}
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Product &amp; Monetization</p>
          <ProductLinkPanel
            content={content}
            onChangeContent={setContent}
          />
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
              slug={article.slug}
              contentType="guide"
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
              currentId={article.id}
              contentType="guide"
              content={content}
              onChangeContent={setContent}
            />
            <SocialPostsPanel contentType="guide" contentId={article.id} />
          </div>
        </div>

        {/* ── ADMIN ────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Admin</p>
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

        {actionErr && (
          <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{actionErr}</p>
        )}
        {actionMsg && (
          <p className="text-green-400 text-sm bg-green-950/40 border border-green-800/40 rounded-lg px-4 py-3">{actionMsg}</p>
        )}

        <p className="text-xs text-gray-600">
          ⌨ <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘S</kbd> save · <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘↵</kbd> publish · <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘Z</kbd> undo · <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘⇧Z</kbd> redo
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
        readinessChecks={readinessChecks}
      />

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
