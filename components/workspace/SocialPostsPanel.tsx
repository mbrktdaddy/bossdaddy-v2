'use client'

import { useEffect, useState } from 'react'

type Platform = 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'threads'

interface SocialPost {
  platform: Platform
  body: string
  hashtags: string[]
  generated_at?: string
}

interface Props {
  contentType: 'guide' | 'review'
  contentId: string
}

const PLATFORM_META: Record<Platform, { label: string; icon: string; charLimit: number | null }> = {
  twitter:   { label: 'Twitter / X',  icon: '𝕏',  charLimit: 280  },
  threads:   { label: 'Threads',      icon: '@',  charLimit: 500  },
  instagram: { label: 'Instagram',    icon: '📸', charLimit: 2200 },
  facebook:  { label: 'Facebook',     icon: 'f',  charLimit: null },
  linkedin:  { label: 'LinkedIn',     icon: 'in', charLimit: null },
}

const DEFAULT_PLATFORMS: Platform[] = ['twitter', 'instagram', 'facebook']

export function SocialPostsPanel({ contentType, contentId }: Props) {
  const [posts,    setPosts]    = useState<SocialPost[]>([])
  const [selected, setSelected] = useState<Platform[]>(DEFAULT_PLATFORMS)
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState(false)
  const [busyPlatform, setBusyPlatform] = useState<Platform | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [instr,    setInstr]    = useState('')
  const [copied,   setCopied]   = useState<Platform | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/social-posts?content_type=${contentType}&content_id=${contentId}`)
      .then((r) => r.ok ? r.json() : { posts: [] })
      .then((j) => { if (active) setPosts(j.posts ?? []) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [contentType, contentId])

  function togglePlatform(p: Platform) {
    setSelected((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p])
  }

  async function handleGenerate(platforms: Platform[], regen: boolean) {
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
      setPosts((prev) => {
        const map = new Map(prev.map((p) => [p.platform, p]))
        for (const p of (json.posts ?? []) as SocialPost[]) map.set(p.platform, p)
        return Array.from(map.values())
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
    setBusy(false)
    setBusyPlatform(null)
    if (!regen) setInstr('')
  }

  async function patchPost(platform: Platform, patch: Partial<Pick<SocialPost, 'body' | 'hashtags'>>) {
    setError(null)
    try {
      const res = await fetch('/api/social-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: contentType, content_id: contentId, platform, ...patch }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Update failed')
      setPosts((prev) => prev.map((p) => p.platform === platform ? json.post : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  async function deletePost(platform: Platform) {
    if (!confirm(`Delete the ${PLATFORM_META[platform].label} post?`)) return
    setError(null); setBusyPlatform(platform)
    try {
      const res = await fetch('/api/social-posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: contentType, content_id: contentId, platform }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Delete failed')
      }
      setPosts((prev) => prev.filter((p) => p.platform !== platform))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
    setBusyPlatform(null)
  }

  async function handleCopy(post: SocialPost) {
    const text = post.hashtags.length > 0
      ? `${post.body}\n\n${post.hashtags.map((t) => `#${t}`).join(' ')}`
      : post.body
    try {
      await navigator.clipboard.writeText(text)
      setCopied(post.platform)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Clipboard not available — select and copy manually.')
    }
  }

  return (
    <details className="bg-gray-900 border border-gray-800 rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-orange-400">📣</span> Social posts
          {posts.length > 0 && (
            <span className="px-2 py-0.5 bg-orange-950/40 border border-orange-900/40 text-orange-400 rounded-full text-xs">
              {posts.length} saved
            </span>
          )}
        </span>
        <span className="text-xs text-gray-600 hidden sm:block">
          AI-generate platform-native copy
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-4">

        {/* Generation controls */}
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Generate for</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PLATFORM_META) as Platform[]).map((p) => {
              const m = PLATFORM_META[p]
              const isOn = selected.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors border min-h-[36px] ${
                    isOn
                      ? 'bg-orange-600 hover:bg-orange-500 text-white border-orange-700'
                      : 'bg-gray-900 hover:bg-gray-800 text-gray-400 border-gray-800'
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
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) handleGenerate(selected, false) }}
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-600">
              {posts.length > 0 ? 'Generating again will overwrite the selected platforms.' : 'Drafts save automatically.'}
            </p>
            <button
              type="button"
              onClick={() => handleGenerate(selected, false)}
              disabled={busy || selected.length === 0}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg min-h-[36px] transition-colors"
            >
              {busy && busyPlatform === null ? 'Generating…' : posts.length > 0 ? '↺ Regenerate selected' : '✨ Generate'}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Generated posts */}
        {loading ? (
          <p className="text-xs text-gray-500 text-center py-4">Loading saved posts…</p>
        ) : posts.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">
            No social posts yet. Generate above to draft platform-native copy.
          </p>
        ) : (
          <div className="space-y-3">
            {posts
              .sort((a, b) => Object.keys(PLATFORM_META).indexOf(a.platform) - Object.keys(PLATFORM_META).indexOf(b.platform))
              .map((post) => (
                <PostCard
                  key={post.platform}
                  post={post}
                  busy={busyPlatform === post.platform}
                  copied={copied === post.platform}
                  onCopy={() => handleCopy(post)}
                  onBodyCommit={(next) => patchPost(post.platform, { body: next })}
                  onHashtagsCommit={(next) => patchPost(post.platform, { hashtags: next })}
                  onRegenerate={() => handleGenerate([post.platform], true)}
                  onDelete={() => deletePost(post.platform)}
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
  onBodyCommit: (next: string) => void
  onHashtagsCommit: (next: string[]) => void
  onRegenerate: () => void
  onDelete: () => void
}

function PostCard({ post, busy, copied, onCopy, onBodyCommit, onHashtagsCommit, onRegenerate, onDelete }: PostCardProps) {
  const m = PLATFORM_META[post.platform]
  const [body, setBody]       = useState(post.body)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => { setBody(post.body) }, [post.body])

  const total = body.length + (post.hashtags.length > 0
    ? post.hashtags.join(' ').length + post.hashtags.length + 2  // " #" prefixes + leading "\n\n"
    : 0)
  const overLimit = m.charLimit != null && total > m.charLimit

  function commitBody() {
    if (body.trim() && body !== post.body) onBodyCommit(body)
    else if (!body.trim()) setBody(post.body)
  }
  function addTag() {
    const t = tagInput.trim().replace(/^#/, '')
    if (!t || post.hashtags.includes(t)) { setTagInput(''); return }
    onHashtagsCommit([...post.hashtags, t])
    setTagInput('')
  }
  function removeTag(t: string) {
    onHashtagsCommit(post.hashtags.filter((x) => x !== t))
  }

  return (
    <div className="p-3 bg-gray-950 border border-gray-800 rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-gray-300 flex items-center gap-2">
          <span className="text-orange-400 font-bold">{m.icon}</span>
          {m.label}
          {m.charLimit != null && (
            <span className={`text-xs font-mono ${overLimit ? 'text-red-400' : 'text-gray-600'}`}>
              {total}/{m.charLimit}
            </span>
          )}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            disabled={busy}
            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs rounded-lg min-h-[36px] transition-colors"
            title="Copy body + hashtags to clipboard"
          >{copied ? '✓ Copied' : 'Copy'}</button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={busy}
            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg min-h-[36px] transition-colors"
            title="Regenerate just this platform"
          >{busy ? '…' : '🔄'}</button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="px-2.5 py-1.5 bg-transparent hover:bg-red-950/40 text-gray-500 hover:text-red-400 text-xs rounded-lg min-h-[36px] transition-colors"
            title="Delete this post"
          >🗑</button>
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={commitBody}
        rows={Math.max(3, Math.min(10, body.split('\n').length))}
        disabled={busy}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-orange-500 resize-y"
      />

      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Hashtags</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {post.hashtags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-1 bg-orange-950/40 border border-orange-900/40 text-orange-400 text-xs rounded-full"
            >
              <span className="font-mono">#{t}</span>
              <button
                type="button"
                onClick={() => removeTag(t)}
                disabled={busy}
                className="text-orange-300 hover:text-red-400 -mr-0.5 px-1"
                title={`Remove #${t}`}
              >×</button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                e.preventDefault()
                addTag()
              }
            }}
            onBlur={() => { if (tagInput.trim()) addTag() }}
            placeholder="+ tag"
            disabled={busy}
            className="px-2 py-1 bg-gray-900 border border-gray-800 rounded-full text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 w-20"
          />
        </div>
      </div>
    </div>
  )
}
