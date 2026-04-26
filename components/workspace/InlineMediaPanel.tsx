'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import MediaPicker from '@/components/media/MediaPicker'
import {
  type InlineSlot,
  type InsertPosition,
  buildFilledFigure,
  buildPlaceholderFigure,
  extractH2Headings,
  extractSlots,
  fillSlot,
  insertAtPosition,
  moveSlotToPosition,
  promoteUntaggedFigures,
  removeSlot,
  revertSlot,
  updateSlotMeta,
} from '@/lib/inlineImages'

interface Props {
  content: string
  onChangeContent: (next: string) => void
  category?: string
  productId?: string
}

type AddMode = 'generate' | 'library' | 'upload' | 'placeholder'

export function InlineMediaPanel({ content, onChangeContent, category, productId }: Props) {

  // ── Auto-promote untagged <figure> elements ONCE per mount ──────────────
  const promotedRef = useRef(false)
  useEffect(() => {
    if (promotedRef.current) return
    promotedRef.current = true
    const promoted = promoteUntaggedFigures(content)
    if (promoted !== content) onChangeContent(promoted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const slots    = useMemo(() => extractSlots(content),       [content])
  const headings = useMemo(() => extractH2Headings(content),  [content])
  const filledCount = slots.filter(s => s.filled).length
  const openCount   = slots.length - filledCount

  // ── Add-image form state ────────────────────────────────────────────────
  const [showAdd, setShowAdd]       = useState(false)
  const [addMode, setAddMode]       = useState<AddMode>('generate')
  const [addPrompt, setAddPrompt]   = useState('')
  const [addCaption, setAddCaption] = useState('')
  const [addAlt, setAddAlt]         = useState('')
  const [addPosKey, setAddPosKey]   = useState<string>('end') // 'start' | 'end' | 'h-<index>'
  const [addBusy, setAddBusy]       = useState(false)

  // ── Per-slot UI state ───────────────────────────────────────────────────
  const [pickerSlot, setPickerSlot]     = useState<InlineSlot | null>(null)
  const [pickerForNew, setPickerForNew] = useState(false)
  const [uploadSlotId, setUploadSlotId] = useState<string | null>(null)
  const [uploadingForNew, setUploadingForNew] = useState(false)
  const [busySlotId, setBusySlotId]     = useState<string | null>(null)
  const [bulkBusy, setBulkBusy]         = useState<{ done: number; total: number } | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Empty placeholder slots that have an AI prompt ready — eligible for bulk fill.
  const fillableSlots = slots.filter((s) => !s.filled && s.prompt.trim())

  function resolveAddPosition(): InsertPosition {
    if (addPosKey === 'start') return { kind: 'start' }
    if (addPosKey === 'end')   return { kind: 'end' }
    const idx = Number(addPosKey.replace('h-', ''))
    return { kind: 'afterHeading', index: idx }
  }

  function resetAddForm() {
    setShowAdd(false)
    setAddMode('generate')
    setAddPrompt('')
    setAddCaption('')
    setAddAlt('')
    setAddPosKey('end')
    setAddBusy(false)
  }

  // ── Per-slot operations ─────────────────────────────────────────────────

  function handleMove(slotId: string, targetPos: number) {
    onChangeContent(moveSlotToPosition(content, slotId, targetPos))
  }
  function handleRemove(slotId: string) {
    if (!confirm('Remove this image from the article?')) return
    onChangeContent(removeSlot(content, slotId))
  }
  function handleRevert(slotId: string) {
    onChangeContent(revertSlot(content, slotId))
  }
  function handleFieldChange(slotId: string, field: 'caption' | 'alt' | 'prompt', value: string) {
    onChangeContent(updateSlotMeta(content, slotId, { [field]: value }))
  }

  async function handleFillAllEmpty() {
    const targets = fillableSlots
    if (targets.length === 0) return
    setError(null); setBulkBusy({ done: 0, total: targets.length })

    // Run sequentially to keep DALL-E load and content-update collisions sane
    let working = content
    for (let i = 0; i < targets.length; i++) {
      const slot = targets[i]
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
        working = fillSlot(working, slot.slotId, url, slot.alt || json.asset?.alt_text || '')
        onChangeContent(working)
      } catch (err) {
        setError(`Slot ${i + 1}: ${err instanceof Error ? err.message : 'Image generation failed'}`)
        break
      }
      setBulkBusy({ done: i + 1, total: targets.length })
    }
    setBulkBusy(null)
  }

  async function handleRegenerate(slot: InlineSlot) {
    const prompt = slot.prompt.trim()
    if (!prompt) {
      setError('Add an image prompt first, then click Regenerate.')
      return
    }
    setBusySlotId(slot.slotId); setError(null)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          size: '1792x1024',
          alt_text: slot.alt || slot.caption || prompt.slice(0, 120),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Image generation failed')
      const url = json.asset?.url as string | undefined
      if (!url) throw new Error('Generator returned no URL')
      onChangeContent(fillSlot(content, slot.slotId, url, slot.alt || json.asset?.alt_text || ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    }
    setBusySlotId(null)
  }

  async function uploadFileForSlot(file: File, slot: InlineSlot) {
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
      onChangeContent(fillSlot(content, slot.slotId, json.asset.url, slot.alt || json.asset.alt_text || ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setBusySlotId(null)
    setUploadSlotId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handlePickerSelect(url: string, altText: string) {
    if (pickerSlot) {
      onChangeContent(fillSlot(content, pickerSlot.slotId, url, pickerSlot.alt || altText))
      setPickerSlot(null)
    } else if (pickerForNew) {
      const markup = buildFilledFigure({
        imageUrl: url,
        alt: addAlt || altText || addCaption || addPrompt || 'Inline image',
        caption: addCaption,
        prompt: addPrompt,
      })
      onChangeContent(insertAtPosition(content, markup, resolveAddPosition()))
      setPickerForNew(false)
      resetAddForm()
    }
  }

  // ── Add-image form actions ─────────────────────────────────────────────

  async function handleAddSubmit() {
    setError(null)
    const position = resolveAddPosition()

    if (addMode === 'placeholder') {
      const markup = buildPlaceholderFigure({
        prompt: addPrompt,
        alt: addAlt,
        caption: addCaption,
      })
      onChangeContent(insertAtPosition(content, markup, position))
      resetAddForm()
      return
    }

    if (addMode === 'library') {
      setPickerForNew(true)
      return
    }

    if (addMode === 'upload') {
      setUploadingForNew(true)
      fileInputRef.current?.click()
      return
    }

    // generate
    if (!addPrompt.trim()) {
      setError('Enter a prompt for the AI to generate the image.')
      return
    }
    setAddBusy(true)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: addPrompt.trim(),
          size: '1792x1024',
          alt_text: addAlt || addCaption || addPrompt.slice(0, 120),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Image generation failed')
      const url = json.asset?.url as string | undefined
      if (!url) throw new Error('Generator returned no URL')
      const markup = buildFilledFigure({
        imageUrl: url,
        alt: addAlt || json.asset?.alt_text || addPrompt.slice(0, 120),
        caption: addCaption,
        prompt: addPrompt,
      })
      onChangeContent(insertAtPosition(content, markup, position))
      resetAddForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    }
    setAddBusy(false)
  }

  async function handleNewUploadFile(file: File) {
    setError(null); setAddBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const altText = addAlt || addCaption || addPrompt
      if (altText) fd.append('alt_text', altText)
      if (productId) fd.append('product_id', productId)
      if (category)  fd.append('category', category)
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      const markup = buildFilledFigure({
        imageUrl: json.asset.url,
        alt: addAlt || json.asset.alt_text || 'Inline image',
        caption: addCaption,
        prompt: addPrompt,
      })
      onChangeContent(insertAtPosition(content, markup, resolveAddPosition()))
      resetAddForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setAddBusy(false)
    setUploadingForNew(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (uploadingForNew) { handleNewUploadFile(file); return }
    if (uploadSlotId) {
      const slot = slots.find(s => s.slotId === uploadSlotId)
      if (slot) uploadFileForSlot(file, slot)
    }
  }

  // ── Position-picker options ─────────────────────────────────────────────
  const positionOptions = [
    { value: 'start', label: 'Start of article' },
    ...headings.map((h, i) => ({
      value: `h-${i}`,
      label: `After: ${h.text.length > 40 ? h.text.slice(0, 40) + '…' : h.text}`,
    })),
    { value: 'end', label: 'End of article' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <details open className="bg-gray-900 border border-orange-900/40 rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-orange-400">🎨</span> Inline images
          {filledCount > 0 && (
            <span className="px-2 py-0.5 bg-green-950/40 border border-green-900/40 text-green-400 rounded-full text-xs">
              {filledCount} filled
            </span>
          )}
          {openCount > 0 && (
            <span className="px-2 py-0.5 bg-orange-950/40 border border-orange-900/40 text-orange-400 rounded-full text-xs">
              {openCount} open
            </span>
          )}
          {slots.length === 0 && (
            <span className="text-xs text-gray-500 font-normal">none yet</span>
          )}
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Bulk fill ───────────────────────────────────────────────── */}
        {!showAdd && fillableSlots.length > 0 && (
          <button
            type="button"
            onClick={handleFillAllEmpty}
            disabled={bulkBusy !== null}
            className="w-full px-4 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors min-h-[44px]"
            title="Run DALL-E for every empty slot using its current prompt"
          >
            {bulkBusy
              ? `✨ Generating ${bulkBusy.done}/${bulkBusy.total}…`
              : `✨ Fill ${fillableSlots.length} empty slot${fillableSlots.length === 1 ? '' : 's'} with AI`}
          </button>
        )}

        {/* ── Add image button + form ─────────────────────────────────── */}
        {!showAdd ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={bulkBusy !== null}
            className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors min-h-[44px]"
          >
            + Add inline image
          </button>
        ) : (
          <div className="p-3 bg-gray-950 border border-orange-900/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">New inline image</p>
              <button
                type="button"
                onClick={resetAddForm}
                className="text-gray-500 hover:text-gray-300 text-xs"
              >Cancel</button>
            </div>

            {/* Mode tabs */}
            <div className="flex flex-wrap gap-1.5">
              {([
                { v: 'generate',    l: '✨ AI generate' },
                { v: 'library',     l: '📁 Library' },
                { v: 'upload',      l: '⬆ Upload' },
                { v: 'placeholder', l: '🎯 Empty slot' },
              ] as Array<{ v: AddMode; l: string }>).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setAddMode(opt.v)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg min-h-[36px] transition-colors ${
                    addMode === opt.v
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >{opt.l}</button>
              ))}
            </div>

            {/* Prompt — needed for generate + placeholder, optional otherwise */}
            {(addMode === 'generate' || addMode === 'placeholder') && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Image prompt {addMode === 'generate' && <span className="text-red-400">*</span>}
                </label>
                <textarea
                  value={addPrompt}
                  onChange={(e) => setAddPrompt(e.target.value)}
                  rows={2}
                  placeholder="e.g. close-up of a worn cordless drill on a workbench, warm natural light, editorial"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Caption (optional)</label>
                <input
                  type="text"
                  value={addCaption}
                  onChange={(e) => setAddCaption(e.target.value)}
                  placeholder="Shown under the image"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Alt text (SEO)</label>
                <input
                  type="text"
                  value={addAlt}
                  onChange={(e) => setAddAlt(e.target.value)}
                  placeholder="Short description for screen readers"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Insert at position</label>
              <select
                value={addPosKey}
                onChange={(e) => setAddPosKey(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {positionOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleAddSubmit}
              disabled={addBusy || (addMode === 'generate' && !addPrompt.trim())}
              className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors min-h-[44px]"
            >
              {addBusy
                ? 'Working…'
                : addMode === 'generate'    ? '✨ Generate & insert'
                : addMode === 'library'     ? '📁 Pick from library'
                : addMode === 'upload'      ? '⬆ Choose file & insert'
                                            : '🎯 Insert empty slot'}
            </button>
          </div>
        )}

        {/* ── Slot cards ──────────────────────────────────────────────── */}
        {slots.map((slot, idx) => (
          <SlotCard
            key={slot.slotId}
            slot={slot}
            position={idx + 1}
            total={slots.length}
            busy={busySlotId === slot.slotId}
            onMove={(toPos) => handleMove(slot.slotId, toPos)}
            onRemove={() => handleRemove(slot.slotId)}
            onRevert={() => handleRevert(slot.slotId)}
            onFieldChange={(field, value) => handleFieldChange(slot.slotId, field, value)}
            onRegenerate={() => handleRegenerate(slot)}
            onPickReplace={() => setPickerSlot(slot)}
            onUpload={() => { setUploadSlotId(slot.slotId); fileInputRef.current?.click() }}
          />
        ))}

        {error && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded px-3 py-2">{error}</p>
        )}
      </div>

      {/* Hidden file input — shared between "new image upload" and "replace slot upload" */}
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
      {pickerForNew && (
        <MediaPicker
          onSelect={handlePickerSelect}
          onClose={() => { setPickerForNew(false); setAddBusy(false) }}
          defaultProductId={productId}
          defaultCategory={category}
        />
      )}
    </details>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotCard — one card per inline image, with full per-image controls

interface SlotCardProps {
  slot: InlineSlot
  position: number
  total: number
  busy: boolean
  onMove: (toPos: number) => void
  onRemove: () => void
  onRevert: () => void
  onFieldChange: (field: 'caption' | 'alt' | 'prompt', value: string) => void
  onRegenerate: () => void
  onPickReplace: () => void
  onUpload: () => void
}

function SlotCard(p: SlotCardProps) {
  const { slot, position, total, busy } = p
  const filled = slot.filled

  return (
    <div className={`p-3 rounded-lg space-y-3 ${
      filled
        ? 'bg-gray-950 border border-green-900/30'
        : 'bg-gray-950 border border-orange-900/30'
    }`}>

      {/* Header: position + reorder + remove */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${filled ? 'text-green-400' : 'text-orange-400'}`}>
            {filled ? '✓ Image' : '🎯 Slot'}
          </span>
          <select
            value={position}
            onChange={(e) => p.onMove(Number(e.target.value))}
            disabled={busy || total <= 1}
            className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white min-h-[36px] focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
            title="Move to position"
          >
            {Array.from({ length: total }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Position {n} of {total}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => p.onMove(position - 1)}
            disabled={busy || position === 1}
            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move up"
          >↑</button>
          <button
            type="button"
            onClick={() => p.onMove(position + 1)}
            disabled={busy || position === total}
            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move down"
          >↓</button>
          <button
            type="button"
            onClick={p.onRemove}
            disabled={busy}
            className="px-2.5 py-1.5 bg-transparent hover:bg-red-950/40 text-gray-500 hover:text-red-400 text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Remove image"
          >🗑</button>
        </div>
      </div>

      {/* Body: thumbnail + editable fields */}
      <div className="flex gap-3 items-start">
        {filled && slot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.imageUrl}
            alt={slot.alt || slot.caption}
            className="w-20 h-16 sm:w-24 sm:h-20 object-cover rounded-lg border border-gray-800 shrink-0"
          />
        ) : (
          <div className="w-20 h-16 sm:w-24 sm:h-20 bg-gray-900 border border-dashed border-gray-700 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-2xl">🖼</span>
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <EditableField
            label="Caption"
            value={slot.caption}
            placeholder="Shown under the image"
            onCommit={(v) => p.onFieldChange('caption', v)}
            disabled={busy}
          />
          <EditableField
            label="Alt text"
            value={slot.alt}
            placeholder="Short description for screen readers"
            onCommit={(v) => p.onFieldChange('alt', v)}
            disabled={busy}
          />
          <EditableField
            label="AI prompt"
            value={slot.prompt}
            placeholder="Describe the image — used by Regenerate"
            onCommit={(v) => p.onFieldChange('prompt', v)}
            disabled={busy}
            multiline
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-800/60">
        <button
          type="button"
          onClick={p.onRegenerate}
          disabled={busy || !slot.prompt.trim()}
          className="px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg min-h-[36px] transition-colors"
          title={!slot.prompt.trim() ? 'Add an AI prompt first' : 'Regenerate with current prompt'}
        >
          {busy ? '✨ Working…' : filled ? '🔄 Regenerate' : '✨ Generate'}
        </button>
        <button
          type="button"
          onClick={p.onPickReplace}
          disabled={busy}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg min-h-[36px] transition-colors"
        >
          📁 {filled ? 'Replace' : 'Library'}
        </button>
        <button
          type="button"
          onClick={p.onUpload}
          disabled={busy}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg min-h-[36px] transition-colors"
        >
          ⬆ Upload {filled ? 'new' : ''}
        </button>
        {filled && (
          <button
            type="button"
            onClick={p.onRevert}
            disabled={busy}
            className="px-3 py-2 bg-transparent hover:bg-yellow-950/40 text-gray-500 hover:text-yellow-400 text-xs rounded-lg min-h-[36px] transition-colors"
            title="Convert back to empty slot (keeps prompt + caption)"
          >
            ↩ Revert
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableField — local-state input that commits on blur or Enter

interface EditableFieldProps {
  label: string
  value: string
  placeholder?: string
  multiline?: boolean
  disabled?: boolean
  onCommit: (next: string) => void
}

function EditableField({ label, value, placeholder, multiline, disabled, onCommit }: EditableFieldProps) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])

  function commit() {
    if (local !== value) onCommit(local)
  }

  const cls = 'w-full px-2.5 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50'

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{label}</label>
      {multiline ? (
        <textarea
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          rows={2}
          placeholder={placeholder}
          disabled={disabled}
          className={cls + ' resize-none'}
        />
      ) : (
        <input
          type="text"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder={placeholder}
          disabled={disabled}
          className={cls}
        />
      )}
    </div>
  )
}
