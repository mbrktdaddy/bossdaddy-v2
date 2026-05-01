'use client'

import { useState } from 'react'

interface Props {
  metaTitle: string
  metaDescription: string
  fallbackTitle: string
  fallbackDescription: string
  slug: string | null
  contentType: 'guide' | 'review'
  productName?: string
  category?: string
  excerpt?: string
  content?: string
  onChangeTitle: (v: string) => void
  onChangeDescription: (v: string) => void
  defaultOpen?: boolean
}

function countLabel(value: string, recommended: number) {
  const len = value.length
  const state = len === 0
    ? 'empty'
    : len > recommended
      ? 'over'
      : len > recommended * 0.9
        ? 'close'
        : 'ok'
  const color = {
    empty: 'text-gray-600',
    ok:    'text-gray-500',
    close: 'text-yellow-500',
    over:  'text-red-400',
  }[state]
  return <span className={`text-xs font-mono ${color}`}>{len}/{recommended}</span>
}

export function SEOPanel({
  metaTitle, metaDescription, fallbackTitle, fallbackDescription, slug, contentType,
  productName, category, excerpt, content,
  onChangeTitle, onChangeDescription, defaultOpen = true,
}: Props) {
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/claude/seo-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fallbackTitle, product_name: productName,
          category, excerpt, content, content_type: contentType,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      if (json.metaTitle) onChangeTitle(json.metaTitle)
      if (json.metaDescription) onChangeDescription(json.metaDescription)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    }
    setGenerating(false)
  }

  const displayTitle       = metaTitle.trim()       || fallbackTitle       || 'Untitled'
  const displayDescription = metaDescription.trim() || fallbackDescription || ''
  const previewUrl = `bossdaddylife.com/${contentType}s/${slug ?? 'slug-goes-here'}`

  const suggestedTitle = fallbackTitle.slice(0, 60)
  const suggestedDesc  = fallbackDescription.slice(0, 160)

  return (
    <details className="bg-gray-900 border border-gray-800 rounded-xl" open={defaultOpen}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-blue-400">🔍</span> SEO
          {(!metaTitle && !metaDescription) && (
            <span className="text-xs text-yellow-500/80 font-normal">· not filled in</span>
          )}
        </span>
        <span className="text-xs text-gray-600">meta_title + meta_description</span>
      </summary>

      <div className="px-4 pb-4 space-y-4">

        {/* AI generate */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs px-3 py-1.5 bg-orange-950/50 hover:bg-orange-900/50 disabled:opacity-50 text-orange-400 border border-orange-900/40 rounded-lg transition-colors font-medium"
          >
            {generating ? 'Generating…' : '✨ Generate with AI'}
          </button>
          {genError && <span className="text-xs text-red-400">{genError}</span>}
        </div>

        {/* Meta title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-gray-300">Meta title</label>
            <div className="flex items-center gap-2">
              {!metaTitle && suggestedTitle && (
                <button
                  type="button"
                  onClick={() => onChangeTitle(suggestedTitle)}
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  ← Use title
                </button>
              )}
              {countLabel(metaTitle, 60)}
            </div>
          </div>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder={`Defaults to: ${fallbackTitle.slice(0, 50)}${fallbackTitle.length > 50 ? '…' : ''}`}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <p className="text-xs text-gray-600 mt-1">Shows in browser tab and Google results. Aim for 50–60 chars.</p>
        </div>

        {/* Meta description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-gray-300">Meta description</label>
            <div className="flex items-center gap-2">
              {!metaDescription && suggestedDesc && (
                <button
                  type="button"
                  onClick={() => onChangeDescription(suggestedDesc)}
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  ← Use excerpt
                </button>
              )}
              {countLabel(metaDescription, 160)}
            </div>
          </div>
          <textarea
            value={metaDescription}
            onChange={(e) => onChangeDescription(e.target.value)}
            rows={2}
            placeholder={`Defaults to excerpt: ${fallbackDescription.slice(0, 80)}${fallbackDescription.length > 80 ? '…' : ''}`}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
          />
          <p className="text-xs text-gray-600 mt-1">Shows as the snippet under your title in search results. 140–160 chars is ideal.</p>
        </div>

        {/* Google search preview */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Search preview</p>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-1">
            <p className="text-xs text-gray-500 font-mono truncate">{previewUrl}</p>
            <p className="text-base text-blue-400 leading-tight line-clamp-1">{displayTitle}</p>
            <p className="text-xs text-gray-400 leading-snug line-clamp-2">{displayDescription || <span className="italic text-gray-600">Add a description to see the full preview</span>}</p>
          </div>
        </div>

      </div>
    </details>
  )
}
