'use client'

import { useMemo, useState } from 'react'
import MediaPicker from '@/components/media/MediaPicker'

interface Slot {
  slotId: string
  prompt: string
  alt: string
  caption: string
}

interface Props {
  content: string
  onChangeContent: (next: string) => void
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Decode the data-* attribute values back out of HTML. DOMParser runs in the
// browser only — this panel is client-side, so that's fine.
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

function placeholderRegex(slotId: string): RegExp {
  // Match the full figure block — data-slot-id is unique per placeholder.
  const escaped = slotId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  return new RegExp(
    `<figure[^>]*class="bd-image-placeholder"[^>]*data-slot-id="${escaped}"[^>]*>[\\s\\S]*?<\\/figure>`,
    'g',
  )
}

function figureHtml(url: string, alt: string, caption: string): string {
  const fig = `<img src="${escAttr(url)}" alt="${escAttr(alt)}" />`
  const cap = caption.trim() ? `<figcaption>${escAttr(caption)}</figcaption>` : ''
  return `<figure>${fig}${cap}</figure>`
}

export function ImageSlotsPanel({ content, onChangeContent }: Props) {
  const slots = useMemo(() => extractSlots(content), [content])
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null)
  const [busySlotId, setBusySlotId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (slots.length === 0) return null

  function fillSlot(slotId: string, url: string, alt: string, caption: string) {
    const pattern = placeholderRegex(slotId)
    const replacement = figureHtml(url, alt, caption)
    onChangeContent(content.replace(pattern, replacement))
  }

  function removeSlot(slotId: string) {
    const pattern = placeholderRegex(slotId)
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
      fillSlot(slot.slotId, url, slot.alt || json.asset?.alt_text || '', slot.caption)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    }
    setBusySlotId(null)
  }

  function handlePickerSelect(url: string, altText: string) {
    if (!pickerSlotId) return
    const slot = slots.find((s) => s.slotId === pickerSlotId)
    if (!slot) return
    fillSlot(slot.slotId, url, slot.alt || altText, slot.caption)
    setPickerSlotId(null)
  }

  return (
    <details open className="bg-gray-900 border border-orange-900/40 rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-orange-400">🎯</span> Image slots
          <span className="px-2 py-0.5 bg-orange-950/40 border border-orange-900/40 text-orange-400 rounded-full text-xs">
            {slots.length} open
          </span>
        </span>
        <span className="text-xs text-gray-600">AI-suggested positions — fill, pick, or drop</span>
      </summary>

      <div className="px-4 pb-4 space-y-3">
        {slots.map((slot) => {
          const busy = busySlotId === slot.slotId
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
                  {busy ? '✨ Generating…' : '✨ Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerSlotId(slot.slotId)}
                  disabled={busy}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors"
                >
                  📁 Pick from library
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

        {error && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded px-3 py-2">{error}</p>
        )}
      </div>

      {pickerSlotId && (
        <MediaPicker
          onSelect={handlePickerSelect}
          onClose={() => setPickerSlotId(null)}
        />
      )}
    </details>
  )
}
