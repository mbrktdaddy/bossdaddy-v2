'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLATFORMS } from '@/lib/social-platforms'
import { XArticlePreview } from '@/lib/x/preview'
import type { DroppedTag } from '@/lib/x/serialize'

interface SourceItem { id: string; title: string }

interface Props {
  reviews: SourceItem[]
  guides: SourceItem[]
  currentPlatform: string
}

interface Variant { content: string }

interface RepurposeResult {
  article: { title: string; body_html: string; x_html: string; dropped: DroppedTag[] }
  thread:  { title: string; tweets: string[] }
  posts:   string[]
}

const X_LIMIT = PLATFORMS.find((p) => p.id === 'x')?.charLimit ?? 280

export default function GenerateDrawer({ reviews, guides, currentPlatform }: Props) {
  const router = useRouter()
  const [open, setOpen]           = useState(false)
  const [mode, setMode]           = useState<'quick' | 'repurpose'>('quick')
  const [platform, setPlatform]   = useState(currentPlatform)
  const [sourceType, setSourceType] = useState<'review' | 'guide' | 'original'>('original')
  const [sourceId, setSourceId]   = useState('')
  const [topic, setTopic]         = useState('')
  const [format, setFormat]       = useState<'single' | 'thread'>('single')
  const [loading, setLoading]     = useState(false)
  const [variants, setVariants]   = useState<Variant[]>([])
  const [saving, setSaving]       = useState<number | null>(null)
  const [error, setError]         = useState('')

  // Repurpose-to-X state
  const [repInstruction, setRepInstruction] = useState('')
  const [repModel, setRepModel]             = useState<'sonnet' | 'opus'>('sonnet')
  const [repLoading, setRepLoading]         = useState(false)
  const [repResult, setRepResult]           = useState<RepurposeResult | null>(null)
  const [repSaving, setRepSaving]           = useState<number | null>(null)
  const [copied, setCopied]                 = useState('')

  const sourceItems = sourceType === 'review' ? reviews : sourceType === 'guide' ? guides : []
  const selectedItem = sourceItems.find((s) => s.id === sourceId)

  function switchMode(next: 'quick' | 'repurpose') {
    setMode(next)
    setError('')
    setVariants([])
    setRepResult(null)
    // Repurpose needs a real source — bump off 'original'.
    if (next === 'repurpose' && sourceType === 'original') { setSourceType('review'); setSourceId('') }
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(''), 1500)
    } catch { /* clipboard unavailable */ }
  }

  async function generate() {
    setError('')
    setVariants([])
    setLoading(true)

    const res = await fetch('/api/social-posts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        source_type: sourceType,
        source_id: sourceId || undefined,
        source_title: selectedItem?.title || topic || undefined,
        topic: sourceType === 'original' ? topic : undefined,
        format,
      }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Generation failed'); return }
    setVariants(json.variants ?? [])
  }

  async function repurpose() {
    setError('')
    setRepResult(null)
    setRepLoading(true)

    const res = await fetch('/api/claude/repurpose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_type: sourceType === 'guide' ? 'guide' : 'review',
        source_id: sourceId,
        instruction: repInstruction.trim() || undefined,
        model: repModel,
      }),
    })
    const json = await res.json()
    setRepLoading(false)
    if (!res.ok) { setError(json.error ?? 'Repurpose failed'); return }
    setRepResult(json.repurpose ?? null)
  }

  async function savePost(index: number, content: string, sourceTitle: string) {
    setRepSaving(index)
    const res = await fetch('/api/social-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'x',
        content,
        status: 'draft',
        source_type: sourceType === 'guide' ? 'guide' : 'review',
        source_id: sourceId || undefined,
        source_title: sourceTitle || undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setRepSaving(null)
    if (!res.ok) { setError(json.error ?? 'Save failed'); return }
    router.refresh()
  }

  async function saveVariant(index: number, content: string) {
    setSaving(index)
    const res = await fetch('/api/social-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        content,
        status: 'draft',
        source_type: sourceType,
        source_id: sourceId || undefined,
        source_title: selectedItem?.title || topic || undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(null)
    if (!res.ok) { setError(json.error ?? 'Save failed'); return }
    router.refresh()
    setOpen(false)
    setVariants([])
  }

  const platformConfig = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[0]

  // In repurpose mode the source picker is review/guide only.
  const repSourceType = sourceType === 'guide' ? 'guide' : 'review'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Generate
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-zinc-900/60" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label="Generate social content" className="relative ml-auto w-full max-w-lg bg-surface-sunken border-l border-soft flex flex-col h-full overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-soft">
              <h2 className="text-base font-bold text-prose">{mode === 'quick' ? 'Generate Post' : 'Repurpose to X'}</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-prose-faint hover:text-prose p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 px-5 pt-4">
              {([['quick', 'Quick post'], ['repurpose', 'Repurpose to X']] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    m === mode ? 'bg-accent text-white' : 'bg-surface-raised text-prose-muted hover:text-prose'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 px-5 py-5 space-y-5">

              {mode === 'quick' ? (
                <>
                  {/* Platform */}
                  <div>
                    <label className="text-xs text-prose-muted uppercase tracking-widest font-medium block mb-2">Platform</label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPlatform(p.id)}
                          disabled={p.id !== 'x'}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            p.id === platform ? 'bg-accent text-white' : 'bg-surface-raised text-prose-muted hover:text-prose'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Source */}
                  <div>
                    <label className="text-xs text-prose-muted uppercase tracking-widest font-medium block mb-2">Source</label>
                    <div className="flex gap-2 mb-3">
                      {(['original', 'review', 'guide'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setSourceType(t); setSourceId('') }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                            t === sourceType ? 'bg-zinc-800 text-prose' : 'bg-surface-raised text-prose-muted hover:text-prose'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {sourceType === 'original' ? (
                      <textarea
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="What's this post about? (e.g. 'best hiking backpacks for dads', 'morning routine tips')"
                        rows={3}
                        className="w-full bg-surface border border-strong text-prose text-sm rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none resize-none"
                      />
                    ) : (
                      <select
                        value={sourceId}
                        onChange={(e) => setSourceId(e.target.value)}
                        className="w-full bg-surface border border-strong text-prose text-sm rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none"
                      >
                        <option value="">— Select a {sourceType} —</option>
                        {sourceItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.title}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Format */}
                  {platformConfig.supportsThreads && (
                    <div>
                      <label className="text-xs text-prose-muted uppercase tracking-widest font-medium block mb-2">Format</label>
                      <div className="flex gap-2">
                        {(['single', 'thread'] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setFormat(f)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                              f === format ? 'bg-zinc-800 text-prose' : 'bg-surface-raised text-prose-muted hover:text-prose'
                            }`}
                          >
                            {f === 'thread' ? 'Thread (3–4 posts)' : 'Single post'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generate button */}
                  <button
                    onClick={generate}
                    disabled={loading || (sourceType !== 'original' && !sourceId) || (sourceType === 'original' && !topic.trim())}
                    className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors text-sm"
                  >
                    {loading ? 'Generating 3 variants…' : 'Generate 3 Variants'}
                  </button>

                  {error && <p className="text-sm text-danger-ink">{error}</p>}

                  {/* Variants */}
                  {variants.length > 0 && (
                    <div className="space-y-4 pt-2">
                      <p className="text-xs text-prose-muted uppercase tracking-widest font-medium">Pick a variant to save</p>
                      {variants.map((v, i) => {
                        const len = v.content.length
                        const over = platformConfig.charLimit ? len > platformConfig.charLimit : false
                        return (
                          <div key={i} className="bg-surface border border-strong rounded-xl p-4 space-y-3">
                            <p className="text-sm text-prose whitespace-pre-wrap leading-relaxed">{v.content}</p>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs tabular-nums ${over ? 'text-danger-ink' : 'text-prose-faint'}`}>
                                {len}{platformConfig.charLimit ? ` / ${platformConfig.charLimit}` : ''}
                              </span>
                              <button
                                onClick={() => saveVariant(i, v.content)}
                                disabled={saving === i || over}
                                className="text-xs bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
                              >
                                {saving === i ? 'Saving…' : 'Save as Draft'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      <button
                        onClick={generate}
                        disabled={loading}
                        className="w-full text-sm text-prose-faint hover:text-prose py-2 transition-colors"
                      >
                        ↺ Regenerate 3 more
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Repurpose source */}
                  <div>
                    <label className="text-xs text-prose-muted uppercase tracking-widest font-medium block mb-2">Source</label>
                    <div className="flex gap-2 mb-3">
                      {(['review', 'guide'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setSourceType(t); setSourceId(''); setRepResult(null) }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                            t === repSourceType ? 'bg-zinc-800 text-prose' : 'bg-surface-raised text-prose-muted hover:text-prose'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <select
                      value={sourceId}
                      onChange={(e) => { setSourceId(e.target.value); setRepResult(null) }}
                      className="w-full bg-surface border border-strong text-prose text-sm rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none"
                    >
                      <option value="">— Select a {repSourceType} —</option>
                      {(repSourceType === 'review' ? reviews : guides).map((item) => (
                        <option key={item.id} value={item.id}>{item.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Optional angle */}
                  <div>
                    <label className="text-xs text-prose-muted uppercase tracking-widest font-medium block mb-2">Angle <span className="text-prose-faint normal-case tracking-normal">(optional)</span></label>
                    <input
                      value={repInstruction}
                      onChange={(e) => setRepInstruction(e.target.value)}
                      placeholder="e.g. lead with the budget angle"
                      className="w-full bg-surface border border-strong text-prose text-sm rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="text-xs text-prose-muted uppercase tracking-widest font-medium block mb-2">Model</label>
                    <div className="flex gap-2">
                      {([['sonnet', 'Sonnet', 'fast'], ['opus', 'Opus', 'best']] as const).map(([m, label, hint]) => (
                        <button
                          key={m}
                          onClick={() => setRepModel(m)}
                          className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            m === repModel ? 'bg-zinc-800 text-prose' : 'bg-surface-raised text-prose-muted hover:text-prose'
                          }`}
                        >
                          {label} <span className="text-xs opacity-50">{hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={repurpose}
                    disabled={repLoading || !sourceId}
                    className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors text-sm"
                  >
                    {repLoading ? 'Repurposing…' : 'Repurpose to X'}
                  </button>

                  {error && <p className="text-sm text-danger-ink">{error}</p>}

                  {repResult && (
                    <div className="space-y-6 pt-2">
                      {/* Article */}
                      <section className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-prose-muted uppercase tracking-widest font-medium">X Article</p>
                          <button
                            onClick={() => copyText('article', repResult.article.x_html)}
                            className="text-xs bg-surface-raised hover:bg-surface text-prose-muted hover:text-prose px-3 py-1 rounded-lg font-medium transition-colors"
                          >
                            {copied === 'article' ? 'Copied!' : 'Copy X-ready HTML'}
                          </button>
                        </div>
                        <XArticlePreview
                          html={repResult.article.x_html}
                          dropped={repResult.article.dropped}
                          title={repResult.article.title}
                        />
                      </section>

                      {/* Thread */}
                      <section className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-prose-muted uppercase tracking-widest font-medium">Thread ({repResult.thread.tweets.length})</p>
                          <button
                            onClick={() => copyText('thread', repResult.thread.tweets.map((t, i) => `${i + 1}/${repResult.thread.tweets.length} ${t}`).join('\n\n'))}
                            className="text-xs bg-surface-raised hover:bg-surface text-prose-muted hover:text-prose px-3 py-1 rounded-lg font-medium transition-colors"
                          >
                            {copied === 'thread' ? 'Copied!' : 'Copy thread'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {repResult.thread.tweets.map((t, i) => {
                            const over = t.length > X_LIMIT
                            return (
                              <div key={i} className="bg-surface border border-strong rounded-lg p-3">
                                <p className="text-sm text-prose whitespace-pre-wrap leading-relaxed">
                                  <span className="text-prose-faint tabular-nums">{i + 1}/{repResult.thread.tweets.length}</span> {t}
                                </p>
                                <span className={`text-[11px] tabular-nums ${over ? 'text-danger-ink' : 'text-prose-faint'}`}>{t.length} / {X_LIMIT}</span>
                              </div>
                            )
                          })}
                        </div>
                      </section>

                      {/* Standalone posts */}
                      <section className="space-y-2">
                        <p className="text-xs text-prose-muted uppercase tracking-widest font-medium">Standalone posts</p>
                        {repResult.posts.map((p, i) => {
                          const over = p.length > X_LIMIT
                          return (
                            <div key={i} className="bg-surface border border-strong rounded-xl p-4 space-y-3">
                              <p className="text-sm text-prose whitespace-pre-wrap leading-relaxed">{p}</p>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs tabular-nums ${over ? 'text-danger-ink' : 'text-prose-faint'}`}>{p.length} / {X_LIMIT}</span>
                                <button
                                  onClick={() => savePost(i, p, repResult.article.title)}
                                  disabled={repSaving === i || over}
                                  className="text-xs bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
                                >
                                  {repSaving === i ? 'Saving…' : 'Save as Draft'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </section>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
