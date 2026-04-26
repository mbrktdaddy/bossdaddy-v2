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
  contentType: 'article' | 'review'
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
  const [error,    setError]    = useState<string | null>(null)
  const [instr,    setInstr]    = useState('')
  const [copied,   setCopied]   = useState<Platform | null>(null)

  // Initial fetch — load any saved posts
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

  async function handleGenerate() {
    if (selected.length === 0) { setError('Select at least one platform.'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/claude/social-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          content_id:   contentId,
          platforms:    selected,
          instruction:  instr.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      // Merge new posts with existing ones (replacing same-platform)
      setPosts((prev) => {
        const map = new Map(prev.map((p) => [p.platform, p]))
        for (const p of (json.posts ?? []) as SocialPost[]) map.set(p.platform, p)
        return Array.from(map.values())
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    }
    setBusy(false)
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
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
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) handleGenerate() }}
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-600">
              {posts.length > 0 ? 'Generating again will overwrite the selected platforms.' : 'Drafts save automatically.'}
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy || selected.length === 0}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {busy ? 'Generating…' : posts.length > 0 ? '↺ Regenerate' : '✨ Generate'}
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
              .map((post) => {
                const m = PLATFORM_META[post.platform]
                const total = post.body.length + (post.hashtags.length > 0 ? post.hashtags.join(' ').length + post.hashtags.length + 2 : 0)
                const overLimit = m.charLimit != null && total > m.charLimit
                return (
                  <div key={post.platform} className="p-3 bg-gray-950 border border-gray-800 rounded-lg space-y-2">
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
                      <button
                        type="button"
                        onClick={() => handleCopy(post)}
                        className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-md transition-colors"
                      >
                        {copied === post.platform ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{post.body}</p>
                    {post.hashtags.length > 0 && (
                      <p className="text-xs text-orange-400/70 font-mono">
                        {post.hashtags.map((t) => `#${t}`).join(' ')}
                      </p>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </details>
  )
}
