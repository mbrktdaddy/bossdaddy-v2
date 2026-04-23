'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const MediaPicker = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })

interface Props {
  imageUrl: string | null
  onChange: (url: string | null) => void
  label?: string
  contentType: 'article' | 'review'
  // For generating: we pass title/category so image gen has context
  title?: string
  category?: string
  excerpt?: string
  productName?: string
}

export function HeroImagePanel({
  imageUrl, onChange, label = 'Hero Image',
  contentType, title, category, excerpt, productName,
}: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!title && !productName) { setError('Need a title first to generate an image.'); return }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/images/hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title ?? productName ?? '',
          category: category ?? 'other',
          excerpt: excerpt ?? null,
          content_type: contentType,
          product_name: productName ?? null,
          custom_prompt: imagePrompt.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Image generation failed')
      onChange(json.imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-300 font-medium">{label}</label>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors"
        >
          📁 Library
        </button>
      </div>

      {imageUrl ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Hero" className="w-full h-56 object-cover rounded-xl border border-gray-700" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 p-1.5 bg-gray-900/80 hover:bg-red-900/80 text-gray-400 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Remove image"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center">
          <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className="text-sm text-gray-500">No image yet — generate below or pick from library</p>
        </div>
      )}

      {/* Inline generate */}
      <div className="flex gap-2">
        <input
          type="text"
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          placeholder="Custom prompt (optional — leave blank to auto-generate from title/category)"
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || (!title && !productName)}
          className="shrink-0 text-xs px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
        >
          {generating ? 'Generating…' : imageUrl ? '↺ Regenerate' : 'Generate'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {showPicker && (
        <MediaPicker
          onSelect={(url) => { onChange(url); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
