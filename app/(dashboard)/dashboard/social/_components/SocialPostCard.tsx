'use client'

import { useState, useRef } from 'react'

interface Post {
  id: string
  platform: string
  content: string
  status: string
  source_type: string | null
  source_title: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface Props {
  post: Post
  charLimit: number | null
  onUpdate: (post: Post) => void
  onDelete: (id: string) => void
}

export default function SocialPostCard({ post, charLimit, onUpdate, onDelete }: Props) {
  const [editing, setEditing]   = useState(false)
  const [content, setContent]   = useState(post.content)
  const [saving, setSaving]     = useState(false)
  const [copied, setCopied]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const textareaRef             = useRef<HTMLTextAreaElement>(null)

  const overLimit = charLimit ? content.length > charLimit : false
  const charColor = overLimit
    ? 'text-red-400'
    : charLimit && content.length > charLimit * 0.9
    ? 'text-yellow-400'
    : 'text-gray-500'

  async function save() {
    if (overLimit) return
    setSaving(true)
    const res = await fetch(`/api/social-posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const json = await res.json()
    setSaving(false)
    if (json.post) { onUpdate(json.post); setEditing(false) }
  }

  async function toggleStatus() {
    const next = post.status === 'draft' ? 'ready' : 'draft'
    const res = await fetch(`/api/social-posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    const json = await res.json()
    if (json.post) onUpdate(json.post)
  }

  async function remove() {
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    await fetch(`/api/social-posts/${post.id}`, { method: 'DELETE' })
    onDelete(post.id)
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusBadge = post.status === 'ready'
    ? 'bg-green-900/40 text-green-400 border border-green-700/40'
    : 'bg-gray-800 text-gray-400 border border-gray-700/40'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge}`}>
            {post.status}
          </span>
          {post.source_title && (
            <span className="text-xs text-gray-500 truncate max-w-[200px]">
              from: {post.source_title}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-600 shrink-0">
          {new Date(post.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Content — edit or display */}
      {editing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-orange-600 focus:outline-none resize-y"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs tabular-nums ${charColor}`}>
              {content.length}{charLimit ? ` / ${charLimit}` : ''}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => { setContent(post.content); setEditing(false) }}
                className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || overLimit}
                className="text-xs bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{content}</p>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-800/60">
          {/* Copy */}
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>

          {/* Edit */}
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>

          {/* Mark ready / draft */}
          <button
            onClick={toggleStatus}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {post.status === 'ready' ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mark Draft
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mark Ready
              </>
            )}
          </button>

          {/* Delete */}
          <button
            onClick={remove}
            disabled={deleting}
            className="ml-auto flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
