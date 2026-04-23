'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'
import { StatusBadge } from '@/components/workspace/StatusBadge'
import { ContentEditor } from '@/components/workspace/ContentEditor'
import { HeroImagePanel } from '@/components/workspace/HeroImagePanel'
import { AIRefinePanel } from '@/components/workspace/AIRefinePanel'
import { ModerationInfo } from '@/components/workspace/ModerationInfo'
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
}

interface Props {
  article: ArticleData
}

export function ArticleWorkspace({ article }: Props) {
  const router = useRouter()

  const [title, setTitle]       = useState(article.title)
  const [category, setCategory] = useState(article.category)
  const [excerpt, setExcerpt]   = useState(article.excerpt ?? '')
  const [content, setContent]   = useState(article.content)
  const [imageUrl, setImageUrl] = useState<string | null>(article.image_url)

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
  }), [title, category, excerpt, content, imageUrl])

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
    if (!confirm('Delete this article permanently? This cannot be undone.')) return
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
        backLabel="All articles"
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

        {/* Metadata */}
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

        {/* Hero image */}
        <HeroImagePanel
          imageUrl={imageUrl}
          onChange={setImageUrl}
          contentType="article"
          title={title}
          category={category}
          excerpt={excerpt}
        />

        {/* AI Refine */}
        <AIRefinePanel
          title={title}
          category={category}
          content={content}
          contentType="article"
          onRefined={(draft) => {
            if (draft.title) setTitle(draft.title)
            if (draft.excerpt) setExcerpt(draft.excerpt)
            setContent(
              [
                draft.introduction,
                ...(draft.sections ?? []).map((s) => {
                  const bodyHtml = s.body.split(/\n\n+/).map((p) => `<p>${p.trim()}</p>`).join('\n')
                  return `<h2>${s.heading}</h2>\n${bodyHtml}`
                }),
                draft.conclusion ? `<h2>Wrapping Up</h2>\n<p>${draft.conclusion}</p>` : '',
              ].filter(Boolean).join('\n\n')
            )
          }}
        />

        {/* Content */}
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Content <span className="text-gray-600">(HTML)</span></label>
          <ContentEditor value={content} onChange={setContent} />
        </div>

        {/* Moderation info */}
        <ModerationInfo score={article.moderation_score} flags={article.moderation_flags ?? []} />

        {/* Status messages */}
        {actionErr && (
          <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{actionErr}</p>
        )}
        {actionMsg && (
          <p className="text-green-400 text-sm bg-green-950/40 border border-green-800/40 rounded-lg px-4 py-3">{actionMsg}</p>
        )}

        <p className="text-xs text-gray-600">
          ⌨ <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘S</kbd> save · <kbd className="px-1 py-0.5 bg-gray-800 rounded">⌘↵</kbd> publish
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
