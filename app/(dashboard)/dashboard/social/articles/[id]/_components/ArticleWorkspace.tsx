'use client'

import { useMemo, useState } from 'react'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WorkspaceToolbar } from '@/components/workspace/WorkspaceToolbar'
import { SchedulePanel } from '@/components/workspace/SchedulePanel'
import { TiptapEditor } from '@/components/workspace/TiptapEditor'
import { XArticlePreview } from '@/lib/x/preview'
import type { DroppedTag } from '@/lib/x/serialize'
import { useSocialArticleWorkspace } from '@/components/workspace/useSocialArticleWorkspace'

export interface ArticleRow {
  id: string
  title: string
  body_html: string | null
  cover_image_url: string | null
  source_type: string | null
  source_id: string | null
  source_title: string | null
  status: 'draft' | 'ready' | 'posted'
  scheduled_at: string | null
  external_url: string | null
  posted_at: string | null
  created_at: string
}

interface Props {
  article: ArticleRow
  initialXHtml: string
  initialDropped: DroppedTag[]
}

const SCHEDULE_NOTE =
  'A planned time to keep your posting queue organized. Posting to X is manual — nothing auto-publishes; this is a reminder only.'

export function ArticleWorkspace({ article, initialXHtml, initialDropped }: Props) {
  const [title, setTitle]           = useState(article.title)
  const [bodyHtml, setBodyHtml]     = useState(article.body_html ?? '')
  const [coverUrl, setCoverUrl]     = useState(article.cover_image_url ?? '')
  const [scheduledAt, setScheduled] = useState<string | null>(article.scheduled_at)
  const [externalUrl, setExternalUrl] = useState(article.external_url ?? '')
  const [status, setStatus]         = useState<'draft' | 'ready' | 'posted'>(article.status)

  // X-serialized preview — refreshed from every save response.
  const [xHtml, setXHtml]     = useState(initialXHtml)
  const [dropped, setDropped] = useState<DroppedTag[]>(initialDropped)

  const payload = useMemo(() => ({
    title,
    body_html: bodyHtml,
    cover_image_url: coverUrl.trim() || null,
    scheduled_at: scheduledAt,
    external_url: externalUrl.trim() || null,
  }), [title, bodyHtml, coverUrl, scheduledAt, externalUrl])

  const ws = useSocialArticleWorkspace({
    id: article.id,
    payload,
    status,
    onSaved: (d) => {
      if (typeof d.x_html === 'string') setXHtml(d.x_html)
      if (Array.isArray(d.dropped)) setDropped(d.dropped as DroppedTag[])
      const s = d.article?.status as 'draft' | 'ready' | 'posted' | undefined
      if (s) setStatus(s)
    },
  })

  const bodyIsEmpty = bodyHtml.replace(/<[^>]+>/g, '').trim().length === 0
  const readinessChecks = [
    { label: 'Title',     done: title.trim().length > 0 },
    { label: 'Body',      done: !bodyIsEmpty },
  ]
  const canPublish = readinessChecks.every((c) => c.done)
  const isPublished = status !== 'draft'

  const created = new Date(article.created_at).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
  const subtitle = `${article.source_title ? `From “${article.source_title}” · ` : ''}X Article · created ${created}`

  return (
    <WorkspaceShell
      backHref="/dashboard/social"
      backLabel="All social"
      title={title}
      subtitle={subtitle}
      status={status}
      autoSave={ws.autoSave}
      actionErr={ws.actionErr}
      actionMsg={ws.actionMsg}
      previewSlot={
        <XArticlePreview html={xHtml} dropped={dropped} title={title} coverImageUrl={coverUrl.trim() || null} />
      }
      toolbar={
        <WorkspaceToolbar
          isSaving={ws.autoSave.state === 'saving'}
          isPublishing={ws.busy}
          isDeleting={ws.deleting}
          isPublished={isPublished}
          onSave={ws.manualSave}
          onPublish={() => ws.setStatus('ready')}
          onUnpublish={() => ws.setStatus('draft')}
          onDelete={ws.handleDelete}
          canPublish={canPublish}
          publishBlockedReason={canPublish ? null : 'Add a title and body first.'}
          readinessChecks={readinessChecks}
          publishLabel="✓ Mark ready to post"
          unpublishLabel="Back to draft"
        />
      }
    >
      {/* Title */}
      <div>
        <label className="block text-xs text-prose-muted uppercase tracking-widest font-medium mb-1.5">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title"
          className="w-full px-4 py-3 bg-surface border border-strong rounded-xl text-lg font-semibold text-prose focus:outline-none focus:ring-1 focus:ring-accent-hover"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs text-prose-muted uppercase tracking-widest font-medium mb-1.5">Body</label>
        <TiptapEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Write your X Article…" targetWords={500} />
        <p className="text-xs text-prose-faint mt-1.5">
          X Articles support a narrow HTML subset. The preview flags anything X strips on paste.
        </p>
      </div>

      {/* Cover image */}
      <div>
        <label className="block text-xs text-prose-muted uppercase tracking-widest font-medium mb-1.5">Cover image URL <span className="normal-case tracking-normal text-prose-faint">(optional)</span></label>
        <input
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://…"
          className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-sm text-prose focus:outline-none focus:ring-1 focus:ring-accent-hover"
        />
      </div>

      {/* Schedule (reminder only) */}
      <SchedulePanel
        scheduledAt={scheduledAt}
        onChange={setScheduled}
        hint="Plan when to post (reminder)"
        label="Planned post time (local)"
        note={SCHEDULE_NOTE}
      />

      {/* Posting status + live URL */}
      <div className="bg-surface border border-soft rounded-xl px-4 py-4 space-y-3">
        <p className="text-sm font-semibold text-prose flex items-center gap-2">
          <span className="text-accent-text-soft">𝕏</span> Posting
        </p>
        <div>
          <label className="block text-xs text-prose-muted mb-1.5">Live X Article URL <span className="text-prose-faint">(paste after you post)</span></label>
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://x.com/…"
            className="w-full px-3 py-2 bg-surface-sunken border border-strong rounded-lg text-sm text-prose focus:outline-none focus:ring-1 focus:ring-accent-hover"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status === 'ready' && (
            <button
              type="button"
              onClick={() => ws.setStatus('posted')}
              disabled={ws.busy}
              className="px-3 py-2 bg-info-bg text-info-ink border border-info-line text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Mark posted
            </button>
          )}
          {status === 'posted' && (
            <button
              type="button"
              onClick={() => ws.setStatus('draft')}
              disabled={ws.busy}
              className="px-3 py-2 bg-surface-raised hover:bg-surface text-prose-muted text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Revert to draft
            </button>
          )}
          <span className="text-xs text-prose-faint">
            Status: <span className="font-medium text-prose-muted capitalize">{status}</span>
            {article.posted_at && ` · posted ${new Date(article.posted_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}`}
          </span>
        </div>
      </div>
    </WorkspaceShell>
  )
}
