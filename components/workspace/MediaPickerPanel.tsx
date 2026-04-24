'use client'

import { useState } from 'react'
import MediaPicker from '@/components/media/MediaPicker'

interface Props {
  content: string
  onInsert: (markup: string) => void
}

interface GalleryItem {
  url: string
  alt: string
}

type PickerMode = null | 'single' | 'gallery'

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function figureMarkup(url: string, alt: string, caption?: string): string {
  const safeUrl = escAttr(url)
  const safeAlt = escAttr(alt)
  const cap = caption?.trim()
  const figcap = cap ? `<figcaption>${escAttr(cap)}</figcaption>` : ''
  return `<figure><img src="${safeUrl}" alt="${safeAlt}" />${figcap}</figure>`
}

export function MediaPickerPanel({ content, onInsert }: Props) {
  const [pickerMode, setPickerMode] = useState<PickerMode>(null)
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const imageCount = (content.match(/<img\s/g) ?? []).length

  function handleSingleSelect(url: string, altText: string) {
    onInsert(figureMarkup(url, altText))
    setPickerMode(null)
  }

  function handleGalleryAdd(url: string, altText: string) {
    setGallery((g) => [...g, { url, alt: altText }])
    setPickerMode(null)
  }

  function insertGallery() {
    if (gallery.length === 0) return
    const figures = gallery.map((g) => figureMarkup(g.url, g.alt)).join('\n  ')
    const wrapped = `<div class="bd-image-grid">\n  ${figures}\n</div>`
    onInsert(wrapped)
    setGallery([])
  }

  function removeGalleryItem(idx: number) {
    setGallery((g) => g.filter((_, i) => i !== idx))
  }

  return (
    <details className="bg-gray-900 border border-gray-800 rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-purple-400">🖼</span> Insert image or gallery
        </span>
        <span className="text-xs text-gray-600">
          {imageCount === 0 ? 'No inline images yet' : `${imageCount} image${imageCount === 1 ? '' : 's'} in content`}
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPickerMode('single')}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            + Insert single image
          </button>
          <button
            type="button"
            onClick={() => setPickerMode('gallery')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors"
          >
            + Add to gallery {gallery.length > 0 ? `(${gallery.length})` : ''}
          </button>
          {gallery.length > 0 && (
            <>
              <button
                type="button"
                onClick={insertGallery}
                className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                ✓ Insert gallery of {gallery.length}
              </button>
              <button
                type="button"
                onClick={() => setGallery([])}
                className="px-3 py-1.5 bg-transparent hover:bg-gray-800 text-gray-500 text-xs rounded-lg transition-colors"
              >
                Clear
              </button>
            </>
          )}
        </div>

        {gallery.length > 0 && (
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-800">
            {gallery.map((g, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-800 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url} alt={g.alt} className="w-full h-full object-cover" loading="lazy" />
                <button
                  type="button"
                  onClick={() => removeGalleryItem(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-600 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove from gallery"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-600">
          Single images render as <code className="text-orange-400">&lt;figure&gt;</code>. Galleries render as a responsive 1→2→3 column grid (no carousel).
        </p>
      </div>

      {pickerMode === 'single' && (
        <MediaPicker
          onSelect={handleSingleSelect}
          onClose={() => setPickerMode(null)}
        />
      )}
      {pickerMode === 'gallery' && (
        <MediaPicker
          onSelect={handleGalleryAdd}
          onClose={() => setPickerMode(null)}
        />
      )}
    </details>
  )
}
