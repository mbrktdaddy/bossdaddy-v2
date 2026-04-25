'use client'

import { useMemo, useRef, useState } from 'react'
import MediaPicker from '@/components/media/MediaPicker'

interface Slot {
  slotId: string
  prompt: string
  alt: string
  caption: string
}

interface FilledSlot extends Slot {
  imageUrl: string
}

interface Props {
  content: string
  onChangeContent: (next: string) => void
  category?: string
  productId?: string
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function extractSlots(content: string): Slot[] {
  if (typeof window === 'undefined') return []
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${content}</div>`, 'text/html')
  const figs = doc.querySelectorAll('figure.bd-image-placeholder')
  return Array.from(figs).map((fig) => ({
    slotId:  fig.getAttribute('data-slot-id') ?? '',
    prompt:  fig.getAttribute('data-prompt')  ?? '',
    alt:     fig.getAttribute('data-alt')     ?? '',
    caption: fig.getAttribute('data-caption') ?? '',
  })).filter((s) => s.slotId)
}

function extractFilledSlots(content: string): FilledSlot[] {
  if (typeof window === 'undefined') return []
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${content}</div>`, 'text/html')
  const figs = doc.querySelectorAll('figure.bd-image-filled')
  return Array.from(figs).map((fig) => {
    const img = fig.querySelector('img')
    return {
      slotId:   fig.getAttribute('data-slot-id') ?? '',
      prompt:   fig.getAttribute('data-prompt')  ?? '',
      alt:      fig.getAttribute('data-alt')     ?? '',
      caption:  fig.getAttribute('data-caption') ?? '',
      imageUrl: img?.getAttribute('src') ?? '',
    }
  }).filter((s) => s.slotId)
}

// Matches any figure (placeholder or filled) by data-slot-id
function slotRegex(slotId: string): RegExp {
  const escaped = slotId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  return new RegExp(
    `<figure[^>]*data-slot-id="${escaped}"[^>]*>[\\s\\S]*?<\\/figure>`,
    'g',
  )
}

function figureHtml(url: string, alt: string, slot: Slot): string {
  const img = `<img src="${escAttr(url)}" alt="${escAttr(alt)}" />`
  const cap = slot.caption.trim() ? `<figcaption>${escAttr(slot.caption)}</figcaption>` : ''
  // Preserve slot metadata so the slot stays manageable after filling
  return `<figure class="bd-image-filled" data-slot-id="${escAttr(slot.slotId)}" data-prompt="${escAttr(slot.prompt)}" data-alt="${escAttr(slot.alt)}" data-caption="${escAttr(slot.caption)}">${img}${cap}</figure>`
}

function placeholderHtml(slot: Slot): string {
  return `<figure class="bd-image-placeholder" data-slot-id="${escAttr(slot.slotId)}" data-prompt="${escAttr(slot.prompt)}" data-alt="${escAttr(slot.alt)}" data-caption="${escAttr(slot.caption)}"><figcaption>${escAttr(slot.caption || 'Image slot')}</figcaption></figure>`
}

export function ImageSlotsPanel({ content, onChangeContent, category, productId }: Props) {
  const slots       = useMemo(() => extractSlots(content),       [content])
  const filledSlots = useMemo(() => extractFilledSlots(content), [content])

  const [pickerSlot,  setPickerSlot]  = useState<Slot | null>(null)
  const [busySlotId,  setBusySlotId]  = useState<string | null>(null)
  const [uploadSlotId, setUploadSlotId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (slots.length === 0 && filledSlots.length === 0) return null

  function fillSlot(slot: Slot, url: string, userAlt: string) {
    const pattern = slotRegex(slot.slotId)
    onChangeContent(content.replace(pattern, figureHtml(url, userAlt || slot.alt, slot)))
  }

  function revertSlot(slot: Slot) {
    const pattern = slotRegex(slot.slotId)
    onChangeContent(content.replace(pattern, placeholderHtml(slot)).replace(/\n{3,}/g, '\n\n'))
  }

  function removeSlot(slotId: string) {
    const pattern = slotRegex(slotId)
    onChangeContent(content.replace(pattern, '').replace(/\n{3,}/g, '\n\n'))
  }

  async function generateForSlot(slot: Slot) {
    setBusySlotId(slot.slotId); setError(null)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: slot.prompt,
          size: '1792x1024',
          alt_text: slot.alt || slot.caption || slot.prompt.slice(0, 120),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Image generation failed')
      const url = json.asset?.url as string | undefined
      if (!url) throw new Error('Generator returned no URL')
      fillSlot(slot, url, slot.alt || json.asset?.alt_text || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    }
    setBusySlotId(null)
  }

  async function handleUploadFile(file: File, slot: Slot) {
    setBusySlotId(slot.slotId); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (slot.alt || slot.caption) fd.append('alt_text', slot.alt || slot.caption)
      if (productId) fd.append('product_id', productId)
      if (category)  fd.append('category', category)
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      fillSlot(slot, json.asset.url, slot.alt || json.asset.alt_text || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setBusySlotId(null)
    setUploadSlotId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadSlotId) return
    const slot = ([...slots, ...filledSlots] as Slot[]).find((s) => s.slotId === uploadSlotId)
    if (!slot) return
    handleUploadFile(file, slot)
  }

  function handlePickerSelect(url: string, altText: string) {
    if (!pickerSlot) return
    fillSlot(pickerSlot, url, pickerSlot.alt || altText)
    setPickerSlot(null)
  }

  return (
    <details open className="bg-gray-900 border border-orange-900/40 rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-orange-400">🎯</span> Image slots
          {slots.length > 0 && (
            <span className="px-2 py-0.5 bg-orange-950/40 border border-orange-900/40 text-orange-400 rounded-full text-xs">
              {slots.length} open
            </span>
          )}
          {filledSlots.length > 0 && (
            <span className="px-2 py-0.5 bg-green-950/40 border border-green-900/40 text-green-400 rounded-full text-xs">
              {filledSlots.length} filled
            </span>
          )}
        </span>
        <span className="text-xs text-gray-600 hidden sm:block">
          {slots.length > 0 ? 'fill, pick, or upload' : 'all slots filled'}
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-3">

        {/* Open slots */}
        {slots.map((slot) => {
          const busy = busySlotId === slot.slotId
          const uploading = busy && uploadSlotId === slot.slotId
          return (
            <div key={slot.slotId} className="p-3 bg-gray-950 border border-gray-800 rounded-lg space-y-2">
              <div>
                <p className="text-xs text-gray-400 italic">{slot.caption || '(no caption)'}</p>
                <p className="text-xs text-gray-600 mt-1">
                  <span className="text-gray-500">Prompt: </span>{slot.prompt}
                </p>
                {slot.alt && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    <span className="text-gray-500">Alt: </span>{slot.alt}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => generateForSlot(slot)}
                  disabled={busy}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {busy && !uploading ? '✨ Generating…' : '✨ Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerSlot(slot)}
                  disabled={busy}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  📁 Library
                </button>
                <button
                  type="button"
                  onClick={() => { setUploadSlotId(slot.slotId); fileInputRef.current?.click() }}
                  disabled={busy}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  {uploading ? 'Uploading…' : '⬆ Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => removeSlot(slot.slotId)}
                  disabled={busy}
                  className="px-3 py-1.5 bg-transparent hover:bg-red-950/40 text-gray-500 hover:text-red-400 text-xs rounded-lg transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          )
        })}

        {/* Filled slots */}
        {filledSlots.length > 0 && (
          <>
            {slots.length > 0 && (
              <p className="text-xs text-gray-600 pt-1 border-t border-gray-800">Filled slots</p>
            )}
            {filledSlots.map((slot) => {
              const busy = busySlotId === slot.slotId
              const uploading = busy && uploadSlotId === slot.slotId
              return (
                <div key={slot.slotId} className="p-3 bg-gray-950 border border-green-900/20 rounded-lg space-y-2">
                  <div className="flex gap-3 items-start">
                    {slot.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slot.imageUrl}
                        alt={slot.alt || slot.caption}
                        className="w-16 h-12 object-cover rounded-lg border border-gray-800 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-green-400 font-semibold">✓ Filled</p>
                      <p className="text-xs text-gray-400 italic truncate">{slot.caption || '(no caption)'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPickerSlot(slot)}
                      disabled={busy}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors"
                    >
                      📁 Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUploadSlotId(slot.slotId); fileInputRef.current?.click() }}
                      disabled={busy}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors"
                    >
                      {uploading ? 'Uploading…' : '⬆ Upload new'}
                    </button>
                    <button
                      type="button"
                      onClick={() => revertSlot(slot)}
                      disabled={busy}
                      className="px-3 py-1.5 bg-transparent hover:bg-yellow-950/40 text-gray-500 hover:text-yellow-400 text-xs rounded-lg transition-colors"
                    >
                      ↩ Revert to slot
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSlot(slot.slotId)}
                      disabled={busy}
                      className="px-3 py-1.5 bg-transparent hover:bg-red-950/40 text-gray-500 hover:text-red-400 text-xs rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded px-3 py-2">{error}</p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {pickerSlot && (
        <MediaPicker
          onSelect={handlePickerSelect}
          onClose={() => setPickerSlot(null)}
          defaultProductId={productId}
          defaultCategory={category}
        />
      )}
    </details>
  )
}
