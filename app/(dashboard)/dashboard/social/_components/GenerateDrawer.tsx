'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLATFORMS } from '@/lib/social-platforms'

interface SourceItem { id: string; title: string }

interface Props {
  reviews: SourceItem[]
  guides: SourceItem[]
  currentPlatform: string
}

interface Variant { content: string }

export default function GenerateDrawer({ reviews, guides, currentPlatform }: Props) {
  const router = useRouter()
  const [open, setOpen]           = useState(false)
  const [platform, setPlatform]   = useState(currentPlatform)
  const [sourceType, setSourceType] = useState<'review' | 'guide' | 'original'>('original')
  const [sourceId, setSourceId]   = useState('')
  const [topic, setTopic]         = useState('')
  const [format, setFormat]       = useState<'single' | 'thread'>('single')
  const [loading, setLoading]     = useState(false)
  const [variants, setVariants]   = useState<Variant[]>([])
  const [saving, setSaving]       = useState<number | null>(null)
  const [error, setError]         = useState('')

  const sourceItems = sourceType === 'review' ? reviews : sourceType === 'guide' ? guides : []
  const selectedItem = sourceItems.find((s) => s.id === sourceId)

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
    setSaving(null)
    if (res.ok) {
      router.refresh()
      setOpen(false)
      setVariants([])
    }
  }

  const platformConfig = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[0]

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
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative ml-auto w-full max-w-lg bg-surface-sunken border-l border-soft flex flex-col h-full overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-soft">
              <h2 className="text-base font-bold text-white">Generate Post</h2>
              <button onClick={() => setOpen(false)} className="text-prose-faint hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 px-5 py-5 space-y-5">

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
                        p.id === platform
                          ? 'bg-accent text-white'
                          : 'bg-surface-raised text-prose-muted hover:text-white'
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
                        t === sourceType
                          ? 'bg-gray-700 text-white'
                          : 'bg-surface-raised text-prose-muted hover:text-white'
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
                    className="w-full bg-surface border border-strong text-white text-sm rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none resize-none"
                  />
                ) : (
                  <select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="w-full bg-surface border border-strong text-white text-sm rounded-lg px-3 py-2.5 focus:border-accent focus:outline-none"
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
                          f === format
                            ? 'bg-gray-700 text-white'
                            : 'bg-surface-raised text-prose-muted hover:text-white'
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

              {error && <p className="text-sm text-red-400">{error}</p>}

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
                          <span className={`text-xs tabular-nums ${over ? 'text-red-400' : 'text-prose-faint'}`}>
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
                    className="w-full text-sm text-prose-faint hover:text-white py-2 transition-colors"
                  >
                    ↺ Regenerate 3 more
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
