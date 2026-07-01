'use client'

import { useEffect, useState } from 'react'
import { PLATFORMS, type SocialPlatform } from '@/lib/social-platforms'

interface SocialPost {
  id: string
  platform: SocialPlatform
  content: string
  status: 'draft' | 'ready' | 'posted'
}

interface Props {
  contentType: 'guide' | 'review' | 'collection'
  contentId: string
}

// Single-glyph marks for each platform (lib/social-platforms carries the label +
// char limit; the panel just adds an icon).
const ICONS: Record<SocialPlatform, string> = {
  x:         '𝕏',
  threads:   '@',
  instagram: '📸',
  facebook:  'f',
}

const PLATFORM_META: Record<SocialPlatform, { label: string; icon: string; charLimit: number | null }> =
  Object.fromEntries(
    PLATFORMS.map((p) => [p.id, { label: p.label, icon: ICONS[p.id], charLimit: p.charLimit }]),
  ) as Record<SocialPlatform, { label: string; icon: string; charLimit: number | null }>

const PLATFORM_ORDER = PLATFORMS.map((p) => p.id)
const DEFAULT_PLATFORMS: SocialPlatform[] = ['x', 'instagram', 'facebook']

export function SocialPostsPanel({ contentType, contentId }: Props) {
  const [posts,    setPosts]    = useState<SocialPost[]>([])
  const [selected, setSelected] = useState<SocialPlatform[]>(DEFAULT_PLATFORMS)
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState(false)
  const [busyPlatform, setBusyPlatform] = useState<SocialPlatform | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [instr,    setInstr]    = useState('')
  const [copied,   setCopied]   = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/social-posts?source_type=${contentType}&source_id=${contentId}`)
      .then((r) => r.ok ? r.json() : { posts: [] })
      .then((j) => { if (active) setPosts(j.posts ?? []) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [contentType, contentId])

  function togglePlatform(p: SocialPlatform) {
    setSelected((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p])
  }

  // Merge freshly generated rows into state, replacing any existing row for the
  // same platform (social-copy overwrites in the DB per platform).
  function mergePosts(incoming: SocialPost[]) {
    setPosts((prev) => {
      const platforms = new Set(incoming.map((p) => p.platform))
      return [...prev.filter((p) => !platforms.has(p.platform)), ...incoming]
    })
  }

  async function handleGenerate(platforms: SocialPlatform[], regen: boolean) {
    if (platforms.length === 0) { setError('Select at least one platform.'); return }
    setBusy(true); setError(null)
    if (platforms.length === 1) setBusyPlatform(platforms[0])
    try {
      const res = await fetch('/api/claude/social-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          content_id:   contentId,
          platforms,
          instruction:  instr.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      mergePosts((json.posts ?? []) as SocialPost[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
    setBusy(false)
    setBusyPlatform(null)
    if (!regen) setInstr('')
  }

  async function patchPost(id: string, patch: { content?: string }) {
    setError(null)
    try {
      const res = await fetch(`/api/social-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Update failed')
      setPosts((prev) => prev.map((p) => p.id === id ? json.post : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  async function deletePost(post: SocialPost) {
    if (!confirm(`Delete the ${PLATFORM_META[post.platform].label} post?`)) return
    setError(null); setBusyPlatform(post.platform)
    try {
      const res = await fetch(`/api/social-posts/${post.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Delete failed')
      }
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
    setBusyPlatform(null)
  }

  async function handleCopy(post: SocialPost) {
    try {
      await navigator.clipboard.writeText(post.content ?? '')
      setCopied(post.id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Clipboard not available — select and copy manually.')
    }
  }

  return (
    <details className="bg-surface border border-soft rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-accent-text-soft">📣</span> Social posts
          {posts.length > 0 && (
            <span className="px-2 py-0.5 bg-accent-tint border border-accent-border/40 text-accent-text-soft rounded-full text-xs">
              {posts.length} saved
            </span>
          )}
        </span>
        <span className="text-xs text-prose-faint hidden sm:block">
          AI-generate platform-native copy
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-4">

        {/* Generation controls */}
        <div className="bg-surface-sunken border border-soft rounded-xl p-4 space-y-3">
          <p className="text-xs text-prose-faint uppercase tracking-widest font-semibold">Generate for</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_ORDER.map((p) => {
              const m = PLATFORM_META[p]
              const isOn = selected.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors border min-h-[36px] ${
                    isOn
                      ? 'bg-accent hover:bg-accent-hover text-white border-accent-border'
                      : 'bg-surface hover:bg-surface-raised text-prose-muted border-soft'
                  }`}
                >
                  <span className="mr-1.5 font-bold">{m.icon}</span>{m.label}
                </button>
              )
            })}
          </div>
          <input
            type="text"
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            placeholder="Optional nudge — e.g. 'lead with the price', 'casual tone', 'focus on the kid angle'"
            className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover"
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) handleGenerate(selected, false) }}
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-prose-faint">
              {posts.length > 0 ? 'Generating again will overwrite the selected platforms.' : 'Drafts save automatically.'}
            </p>
            <button
              type="button"
              onClick={() => handleGenerate(selected, false)}
              disabled={busy || selected.length === 0}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg min-h-[36px] transition-colors"
            >
              {busy && busyPlatform === null ? 'Generating…' : posts.length > 0 ? '↺ Regenerate selected' : '✨ Generate'}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Generated posts */}
        {loading ? (
          <p className="text-xs text-prose-faint text-center py-4">Loading saved posts…</p>
        ) : posts.length === 0 ? (
          <p className="text-xs text-prose-faint text-center py-4">
            No social posts yet. Generate above to draft platform-native copy.
          </p>
        ) : (
          <div className="space-y-3">
            {posts
              // Skip posts whose platform isn't a known one (legacy/unsupported
              // values). PostCard depends on PLATFORM_META[post.platform].
              .filter((p) => PLATFORM_META[p.platform] != null)
              .sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform))
              .map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  busy={busyPlatform === post.platform}
                  copied={copied === post.id}
                  onCopy={() => handleCopy(post)}
                  onCommit={(next) => patchPost(post.id, { content: next })}
                  onRegenerate={() => handleGenerate([post.platform], true)}
                  onDelete={() => deletePost(post)}
                />
              ))}
          </div>
        )}
      </div>
    </details>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
interface PostCardProps {
  post: SocialPost
  busy: boolean
  copied: boolean
  onCopy: () => void
  onCommit: (next: string) => void
  onRegenerate: () => void
  onDelete: () => void
}

function PostCard({ post, busy, copied, onCopy, onCommit, onRegenerate, onDelete }: PostCardProps) {
  const m = PLATFORM_META[post.platform]
  const [content, setContent] = useState(post.content ?? '')

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setContent(post.content ?? '') }, [post.content])

  const total = content.length
  const overLimit = m.charLimit != null && total > m.charLimit

  function commit() {
    if (content.trim() && content !== post.content) onCommit(content)
    else if (!content.trim()) setContent(post.content ?? '')
  }

  return (
    <div className="p-3 bg-surface-sunken border border-soft rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-prose-muted flex items-center gap-2">
          <span className="text-accent-text-soft font-bold">{m.icon}</span>
          {m.label}
          {m.charLimit != null && (
            <span className={`text-xs font-mono ${overLimit ? 'text-red-700' : 'text-prose-faint'}`}>
              {total}/{m.charLimit}
            </span>
          )}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            disabled={busy}
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-surface text-prose-muted hover:text-prose text-xs rounded-lg min-h-[36px] transition-colors"
            title="Copy to clipboard"
          >{copied ? '✓ Copied' : 'Copy'}</button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={busy}
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-surface text-prose-muted text-xs rounded-lg min-h-[36px] transition-colors"
            title="Regenerate just this platform"
          >{busy ? '…' : '🔄'}</button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="px-2.5 py-1.5 bg-transparent hover:bg-red-50 text-prose-faint hover:text-red-700 text-xs rounded-lg min-h-[36px] transition-colors"
            title="Delete this post"
          >🗑</button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={commit}
        rows={Math.max(3, Math.min(12, content.split('\n').length))}
        disabled={busy}
        className="w-full px-3 py-2 bg-surface border border-soft rounded-lg text-sm text-prose leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent-hover resize-y"
      />
    </div>
  )
}
