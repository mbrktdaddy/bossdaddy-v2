'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CATEGORIES } from '@/lib/categories'
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

const InlineMediaPanel = dynamic(
  () => import('@/components/workspace/InlineMediaPanel').then((m) => ({ default: m.InlineMediaPanel })),
  { ssr: false, loading: () => <div className="h-32 bg-gray-950 border border-gray-800 rounded-xl animate-pulse" /> },
)
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import { WorkspaceToolbar } from '@/components/workspace/WorkspaceToolbar'
import { AutoSaveIndicator } from '@/components/workspace/AutoSaveIndicator'
import { useAutoSave } from '@/components/workspace/useAutoSave'
import { useKeyboardShortcuts } from '@/components/workspace/useKeyboardShortcuts'

interface ArticleData {
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
  created_at: string
  updated_at: string
  reading_time_minutes: number | null
  rejection_reason: string | null
  meta_title: string | null
  meta_description: string | null
  scheduled_publish_at: string | null
}

interface Props {
  article: ArticleData
}

export function ArticleWorkspace({ article }: Props) {
  const router = useRouter()

  const [title, setTitle]           = useState(article.title)
  const [category, setCategory]     = useState(article.category)
  const [excerpt, setExcerpt]       = useState(article.excerpt ?? '')
  const [content, setContent]       = useState(article.content)
  const [imageUrl, setImageUrl]     = useState<string | null>(article.image_url)
  const [metaTitle, setMetaTitle]   = useState(article.meta_title ?? '')
  const [metaDesc, setMetaDesc]     = useState(article.meta_description ?? '')
  const [scheduledAt, setScheduled] = useState<string | null>(article.scheduled_publish_at)

  const [heroPromptSuggestion, setHeroPromptSuggestion] = useState('')

  useEffect(() => {
    const key = `bd:hero-prompt:${article.id}`
    const val = sessionStorage.getItem(key)
    if (val) { setHeroPromptSuggestion(val); sessionStorage.removeItem(key) }
  }, [article.id])

  const [refineInstruction, setRefineInstruction] = useState('')
  const [busy, setBusy]       = useState(false)
  const [actionErr, setErr]   = useState<string | null>(null)
  const [actionMsg, setMsg]   = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const status = article.status
  const isPublished = status === 'approved'

  // Payload for saves (only fields the author update schema accepts)
  const payload = useMemo(() => ({
    title, category,
    excerpt: excerpt || undefined,
    content,
    image_url: imageUrl,
    meta_title:           metaTitle || null,
    meta_description:     metaDesc  || null,
    scheduled_publish_at: scheduledAt,
  }), [title, category, excerpt, content, imageUrl, metaTitle, metaDesc, scheduledAt])

  // Auto-save — debounced 20s after last change
  const save = async (p: typeof payload) => {
    const res = await fetch(`/api/articles/${article.id}`, {
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

  async function publishOrUnpublish(action: 'approve' | 'unpublish') {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await save(payload) // save any pending changes first
      const res = await fetch(`/api/articles/${article.id}`, {
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
    if (!confirm('Delete this guide permanently? This cannot be undone.')) return
    setDeleting(true); setErr(null)
    const res = await fetch(`/api/articles/${article.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setErr(json.error ?? 'Delete failed')
      setDeleting(false)
      return
    }
    router.push('/dashboard/articles')
    router.refresh()
  }

  async function handleDuplicate() {
    setBusy(true); setErr(null)
    const res = await fetch(`/api/articles/${article.id}/duplicate`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setErr(json.error ?? 'Duplicate failed')
      setBusy(false)
      return
    }
    router.push(`/dashboard/articles/${json.article.id}`)
    router.refresh()
  }

  useKeyboardShortcuts({
    'mod+s':     () => manualSave(),
    'mod+enter': () => { if (!isPublished) publishOrUnpublish('approve') },
  })

  const previewUrl = isPublished && article.slug ? `/articles/${article.slug}` : null
  const createdAt  = new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-4 sm:p-8 max-w-4xl">

      <WorkspaceHeader
        backHref="/dashboard/articles"
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

        {/* ── CORE ─────────────────────────────────────────────────────── */}
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold">Core</p>

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
          <label className="block text-sm text-gray-300 mb-1.5">Excerpt <span className="text-gray-600">(summary shown on listing pages)</span></label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        <AIRefinePanel
          title={title}
          category={category}
          content={content}
          contentType="article"
          externalInstruction={refineInstruction}
          onExternalInstructionUsed={() => setRefineInstruction('')}
          onRefined={(draft) => {
            if (draft.title) setTitle(draft.title)
            if (draft.excerpt) setExcerpt(draft.excerpt)
            const refinedContent = [
              draft.introduction,
              ...(draft.sections ?? []).map((s) => {
                const bodyHtml = s.body.split(/\n\n+/).map((p) => `<p>${p.trim()}</p>`).join('\n')
                return `<h2>${s.heading}</h2>\n${bodyHtml}`
              }),
              draft.conclusion ? `<h2>Wrapping Up</h2>\n<p>${draft.conclusion}</p>` : '',
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

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Content <span className="text-gray-600">(HTML)</span></label>
          <ContentEditor
            value={content}
            onChange={setContent}
            targetWords={CATEGORIES.find(c => c.slug === category)?.targetWords}
          />
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
                contentType="article"
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
              contentType="article"
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
              contentType="article"
              content={content}
              onChangeContent={setContent}
            />
            <SocialPostsPanel contentType="article" contentId={article.id} />
          </div>
        </div>

        {/* ── ADMIN ────────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-gray-800/60">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Admin</p>
          <div className="space-y-6">
            <VersionHistoryPanel contentType="article" contentId={article.id} />
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
      />
    </div>
  )
}
