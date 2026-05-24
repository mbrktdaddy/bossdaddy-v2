'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import LinkPicker, { type SourceLinks } from './LinkPicker'
import type { HashtagPreset } from './HashtagPresetsPanel'

const MediaPicker = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })

export interface Post {
  id: string
  platform: string
  content: string
  status: string
  source_type: string | null
  source_title: string | null
  link_url: string | null
  image_url: string | null
  notes: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
}

interface Props {
  post: Post
  charLimit: number | null
  sourceLinks: SourceLinks
  presets: HashtagPreset[]
  onUpdate: (post: Post) => void
  onDelete: (id: string) => void
}

// X counts every URL as 23 chars via t.co shortening
const LINK_CHAR_COST = 23

export default function SocialPostCard({ post, charLimit, sourceLinks, presets, onUpdate, onDelete }: Props) {
  const [editing, setEditing]       = useState(false)
  const [content, setContent]       = useState(post.content)
  const [linkUrl, setLinkUrl]       = useState<string | null>(post.link_url)
  const [imageUrl, setImageUrl]     = useState<string | null>(post.image_url)
  const [saving, setSaving]         = useState(false)
  const [copied, setCopied]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  // Char counting — link costs 23 chars on X when present
  const effectiveLength = content.length + (linkUrl ? LINK_CHAR_COST : 0)
  const overLimit = charLimit ? effectiveLength > charLimit : false
  const nearLimit = charLimit ? effectiveLength > charLimit * 0.88 : false
  const charColor = overLimit ? 'text-red-300' : nearLimit ? 'text-amber-300' : 'text-prose-faint'

  async function save() {
    if (overLimit) return
    setSaving(true)
    const res = await fetch(`/api/social-posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, link_url: linkUrl, image_url: imageUrl }),
    })
    const json = await res.json()
    setSaving(false)
    if (json.post) { onUpdate(json.post); setEditing(false) }
  }

  function cancelEdit() {
    setContent(post.content)
    setLinkUrl(post.link_url)
    setImageUrl(post.image_url)
    setEditing(false)
  }

  async function setStatus(status: 'draft' | 'ready' | 'posted') {
    const res = await fetch(`/api/social-posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const json = await res.json()
    if (json.post) onUpdate(json.post)
  }

  async function removeImage() {
    const res = await fetch(`/api/social-posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: null }),
    })
    const json = await res.json()
    if (json.post) { onUpdate(json.post); setImageUrl(null) }
  }

  async function remove() {
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    await fetch(`/api/social-posts/${post.id}`, { method: 'DELETE' })
    onDelete(post.id)
  }

  function copyToClipboard() {
    const text = linkUrl ? `${content}\n\n${linkUrl}` : content
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function applyPreset(preset: HashtagPreset) {
    const hashtags = preset.tags.map((t) => `#${t}`).join(' ')
    setContent((prev) => prev.trimEnd() + '\n\n' + hashtags)
    setShowPresets(false)
  }

  function handleImagePick(url: string) {
    setImageUrl(url)
    setShowImagePicker(false)
    // Persist immediately so card reflects attachment without requiring Save
    fetch(`/api/social-posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: url }),
    }).then((r) => r.json()).then((j) => { if (j.post) onUpdate(j.post) })
  }

  const statusBadge =
    post.status === 'posted' ? 'bg-blue-950/40 text-blue-300 border border-blue-700/40'
    : post.status === 'ready' ? 'bg-green-950/40 text-forest border border-green-700/40'
    : 'bg-surface-raised text-prose-muted border border-strong/40'

  return (
    <>
      <div className="bg-surface border border-soft rounded-xl p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge}`}>
              {post.status}
            </span>
            {post.source_title && (
              <span className="text-xs text-prose-faint truncate max-w-[180px]">from: {post.source_title}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {post.posted_at && (
              <span className="text-xs text-prose-faint">
                Posted {new Date(post.posted_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}
              </span>
            )}
            {!post.posted_at && (
              <span className="text-xs text-prose-faint">
                {new Date(post.created_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}
              </span>
            )}
          </div>
        </div>

        {/* Image thumbnail */}
        {(imageUrl ?? post.image_url) && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl ?? post.image_url!}
              alt=""
              className="w-full max-h-48 object-cover rounded-lg"
            />
            <button
              onClick={removeImage}
              className="absolute top-2 right-2 bg-zinc-900/60 hover:bg-zinc-900/80 text-white p-1 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        {editing ? (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full bg-surface-raised text-prose text-sm rounded-lg px-3 py-2.5 border border-strong focus:border-accent focus:outline-none resize-y"
                autoFocus
              />
              {/* Hashtag preset dropdown */}
              {presets.length > 0 && (
                <div className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => setShowPresets(!showPresets)}
                    className="text-xs text-accent-text-soft hover:text-accent transition-colors"
                  >
                    # Apply hashtag preset
                  </button>
                  {showPresets && (
                    <div className="absolute left-0 top-6 z-10 bg-surface-raised border border-strong rounded-xl shadow-xl min-w-[200px]">
                      {presets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => applyPreset(preset)}
                          className="w-full text-left px-3 py-2.5 hover:bg-zinc-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                        >
                          <p className="text-xs text-prose font-medium">{preset.name}</p>
                          <p className="text-xs text-prose-faint">{preset.tags.map((t) => `#${t}`).join(' ')}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Link picker */}
            <LinkPicker value={linkUrl} onChange={setLinkUrl} sourceLinks={sourceLinks} />

            {/* Char counter + actions */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className={`text-xs tabular-nums ${charColor}`}>
                  {effectiveLength}{charLimit ? ` / ${charLimit}` : ''}
                  {linkUrl && charLimit && (
                    <span className="text-prose-faint ml-1">(incl. 23 for link)</span>
                  )}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  className="text-xs text-prose-faint hover:text-prose px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving || overLimit}
                  className="text-xs bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-prose whitespace-pre-wrap leading-relaxed">{post.content}</p>
            {post.link_url && (
              <a
                href={post.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-accent-text-soft hover:text-accent truncate transition-colors"
              >
                ↗ {post.link_url}
              </a>
            )}
          </div>
        )}

        {/* Actions bar */}
        {!editing && (
          <div className="flex items-center gap-1 pt-1 border-t border-soft flex-wrap">
            {/* Copy */}
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 text-xs text-prose-muted hover:text-prose px-3 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
            >
              {copied ? (
                <><svg className="w-3.5 h-3.5 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-forest">Copied!</span></>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
              )}
            </button>

            {/* Edit */}
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs text-prose-muted hover:text-prose px-3 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit
            </button>

            {/* Image */}
            <button
              onClick={() => setShowImagePicker(true)}
              className="flex items-center gap-1.5 text-xs text-prose-muted hover:text-prose px-3 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              {post.image_url ? 'Swap image' : 'Add image'}
            </button>

            {/* Status actions */}
            {post.status === 'draft' && (
              <button
                onClick={() => setStatus('ready')}
                className="flex items-center gap-1.5 text-xs text-prose-muted hover:text-prose px-3 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Mark Ready
              </button>
            )}
            {post.status === 'ready' && (
              <>
                <button
                  onClick={() => setStatus('posted')}
                  className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-prose px-3 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
                  Mark Posted
                </button>
                <button
                  onClick={() => setStatus('draft')}
                  className="flex items-center gap-1.5 text-xs text-prose-muted hover:text-prose px-3 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
                >
                  Mark Draft
                </button>
              </>
            )}
            {post.status === 'posted' && (
              <button
                onClick={() => setStatus('draft')}
                className="flex items-center gap-1.5 text-xs text-prose-muted hover:text-prose px-3 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
              >
                Revert to Draft
              </button>
            )}

            {/* Delete */}
            <button
              onClick={remove}
              disabled={deleting}
              className="ml-auto flex items-center gap-1.5 text-xs text-prose-faint hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Image picker modal */}
      {showImagePicker && (
        <MediaPicker
          onSelect={(url) => handleImagePick(url)}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </>
  )
}
