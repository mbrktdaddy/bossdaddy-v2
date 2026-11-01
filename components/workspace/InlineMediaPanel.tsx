'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { compressImage } from '@/lib/compress-image'
import { fetchAssetAsFile } from '@/lib/images/derive-crop'
import ImageCropper from '@/components/ui/ImageCropper'
import MediaPicker, { type MultiSelectItem } from '@/components/media/MediaPicker'
import {
  type H2Heading,
  type InlineItem,
  type InlineSlot,
  type InsertPosition,
  addToGallery,
  buildFilledFigure,
  buildGalleryWrapper,
  buildPlaceholderFigure,
  detachFromGallery,
  extractH2Headings,
  extractItems,
  fillSlot,
  insertAtPosition,
  moveChildInGallery,
  moveItemToPosition,
  moveSlotToSection,
  promoteUntaggedFigures,
  removeItem,
  removeSlot,
  revertSlot,
  updateSlotMeta,
} from '@/lib/inlineImages'
import { buttonVariants } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { TrashIcon } from '@/components/icons'
import { PromptAssist } from '@/components/workspace/PromptAssist'
import { ContactSheetPicker } from '@/components/workspace/ContactSheetPicker'
import type { PeoplePolicy } from '@/lib/images/safety'
import { FIGURE_ASPECTS, isFigureAspect, type FigureAspect } from '@/lib/images/doctrine'
import { IMAGE_TIERS } from '@/lib/images/tiers'
import type { ImageLook } from '@/lib/images/style'
import type { FigureImageMeta } from '@/lib/inlineImages'

interface Props {
  content: string
  onChangeContent: (next: string) => void
  category?: string
  productId?: string
  /** The piece these figures belong to — links generated assets + puts their cost on the piece's chip. */
  contentType?: 'review' | 'guide'
  contentId?: string
  /** The piece's default look: 'illustration' for Table Duty / Watch Duty essays (brand guide §2). */
  defaultLook?: ImageLook
}

type AddMode = 'generate' | 'library' | 'upload' | 'placeholder' | 'gallery'

/** What the generator reported about a slot's last image (vision QA / refusal). */
export type SlotNote = { tone: 'warn' | 'fail' | 'policy' | 'error'; text: string }

/** What Prompt help hands back when the author uses a result (components/workspace/PromptAssist.tsx). */
type AssistPick = { prompt: string; aspect?: string | null; altText?: string; caption?: string }

type GenerateResponse = {
  asset?: { url?: string; alt_text?: string | null; width?: number | null; height?: number | null; origin?: string | null }
  qa?: { judgement?: { verdict: 'pass' | 'warn' | 'fail'; reasons: string[] } } | null
  attempts?: number
  /** mode 'sheet': the cheap drafts to pick a composition from. */
  sheet?: { drafts: Array<{ url: string; filename: string }> }
  error?: string
  code?: string
}

/** One slot's open contact sheet: the drafts, the pick, and what is in flight. */
type SheetState = {
  drafts: Array<{ url: string; filename: string }>
  picked: string | null
  busy: 'finalizing' | 'rerolling' | null
}

class GenerateError extends Error {
  constructor(message: string, readonly code?: string) { super(message) }
}

const LOOK_OPTIONS: { value: ImageLook; label: string }[] = [
  { value: 'photo',        label: 'Photo' },
  { value: 'illustration', label: 'Illustration' },
]

const PEOPLE_OPTIONS: { value: PeoplePolicy; label: string }[] = [
  { value: 'none',      label: 'No people' },
  { value: 'anonymous', label: 'Anonymous' },
  { value: 'allowed',   label: 'Faces OK' },
]

// The figure shape (data-aspect). 3:2 is what a slot without one has always been.
const DEFAULT_ASPECT: FigureAspect = '3:2'
const ASPECT_OPTIONS: { value: FigureAspect; label: string }[] = FIGURE_ASPECTS.map((a) => ({ value: a, label: a }))

// Bulk fill runs this many slots at once: three slots in the time of one. The
// per-user limiter is 60 images an hour, so three in flight never trips it on
// its own; more would just queue behind the provider.
const CONCURRENCY = 3

// How a figure shape becomes a generate request. 3:2 and 1:1 are image sizes in
// their own right; 4:5 is generated on the 1024x1536 portrait and centre-cropped
// by the route (aspect '4:5'), so the stored file IS the framing the reader sees.
const GENERATE_REQUEST: Record<FigureAspect, { size: '1536x1024' | '1024x1024' | '1024x1536'; aspect?: '4:5' }> = {
  '3:2': { size: '1536x1024' },
  '1:1': { size: '1024x1024' },
  '4:5': { size: '1024x1536', aspect: '4:5' },
}

export function InlineMediaPanel({ content, onChangeContent, category, productId, contentType, contentId, defaultLook = 'photo' }: Props) {

  // ── Auto-promote untagged <figure> elements ONCE per mount ──────────────
  const promotedRef = useRef(false)
  useEffect(() => {
    if (promotedRef.current) return
    promotedRef.current = true
    const promoted = promoteUntaggedFigures(content)
    if (promoted !== content) onChangeContent(promoted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items    = useMemo(() => extractItems(content),       [content])
  const headings = useMemo(() => extractH2Headings(content),  [content])

  // Flat slot list for bulk-fill and summary counts
  const allSlots     = useMemo(() => items.flatMap(i => i.kind === 'single' ? [i.slot] : i.children), [items])
  const filledCount  = allSlots.filter(s => s.filled).length
  const openCount    = allSlots.length - filledCount
  const fillableSlots = allSlots.filter(s => !s.filled && s.prompt.trim())
  // Owned slots the author has not given a prompt: waiting for his own photo, and skipped by bulk fill.
  const ownedWaiting  = allSlots.filter(s => !s.filled && s.need === 'owned' && !s.prompt.trim()).length

  // ── Add-image form state ────────────────────────────────────────────────
  const [showAdd, setShowAdd]       = useState(false)
  const [addMode, setAddMode]       = useState<AddMode>('generate')
  const [addPrompt, setAddPrompt]   = useState('')
  const [addCaption, setAddCaption] = useState('')
  const [addAlt, setAddAlt]         = useState('')
  const [addAspect, setAddAspect]   = useState<FigureAspect>(DEFAULT_ASPECT)
  const [addPosKey, setAddPosKey]   = useState<string>('end')
  const [addBusy, setAddBusy]       = useState(false)

  // ── Picker / upload state ────────────────────────────────────────────────
  const [pickerSlot, setPickerSlot]           = useState<InlineSlot | null>(null)   // replace existing slot
  const [pickerForNew, setPickerForNew]       = useState(false)                      // add single from library
  const [pickerForGallery, setPickerForGallery] = useState(false)                   // create new gallery (multi)
  const [addToGalleryId, setAddToGalleryId]   = useState<string | null>(null)       // add 1 image to existing gallery
  const [uploadSlotId, setUploadSlotId]       = useState<string | null>(null)
  const [cropPending, setCropPending]         = useState<File | null>(null)
  // Apply-time crop for a filled slot/child (incl. AI-generated inline images).
  const [cropSlotFile, setCropSlotFile]       = useState<File | null>(null)
  const [cropSlotTarget, setCropSlotTarget]   = useState<InlineSlot | null>(null)
  const [uploadingForNew, setUploadingForNew] = useState(false)
  const [busySlotId, setBusySlotId]           = useState<string | null>(null)
  const [bulkBusy, setBulkBusy]               = useState<{ done: number; total: number } | null>(null)
  // Publication tier by default (lib/images/tiers.ts pins the models); drop to
  // the Draft tier to rough out a composition, then regenerate for the page.
  const [premium, setPremium]                 = useState(true)
  // Lane knobs (lib/images/safety.ts EDITORIAL): people anonymous, no text.
  const [people, setPeople]                   = useState<PeoplePolicy>('anonymous')
  const [allowText, setAllowText]             = useState(false)
  // 'low' loosens only the image model's own filter (benign dad-life scenes).
  const [moderation, setModeration]           = useState<'auto' | 'low'>('auto')
  // Photograph or editorial illustration (lib/images/style.ts); essays default to illustration.
  const [look, setLook]                       = useState<ImageLook>(defaultLook)
  const moderationId = useId()
  // Open contact sheets, keyed by slotId.
  const [sheets, setSheets]                   = useState<Record<string, SheetState>>({})
  // Per-slot notes from the generator: QA warnings, a refusal, an error.
  const [slotNotes, setSlotNotes]             = useState<Record<string, SlotNote>>({})
  const [error, setError]                     = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Generation plumbing ──────────────────────────────────────────────────

  /** The body every image request shares (single, sheet, finalize). */
  function generateBody(prompt: string, subject: string, aspect: FigureAspect) {
    const target = GENERATE_REQUEST[aspect]
    return {
      prompt,
      size: target.size,
      ...(target.aspect ? { aspect: target.aspect } : {}),
      alt_text: subject.slice(0, 200),
      subject: subject.slice(0, 400),
      premium,
      lane: 'editorial',
      people,
      no_text: !allowText,
      moderation,
      look,
      source_type: contentType ?? null,
      source_id: contentId ?? null,
    }
  }

  async function postGenerate(body: Record<string, unknown>): Promise<GenerateResponse> {
    const res = await fetch('/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => ({}))) as GenerateResponse
    if (!res.ok) throw new GenerateError(json.error ?? 'Image generation failed', json.code)
    return json
  }

  async function callGenerate(prompt: string, subject: string, aspect: FigureAspect = DEFAULT_ASPECT): Promise<GenerateResponse> {
    const json = await postGenerate({ ...generateBody(prompt, subject, aspect), mode: 'single' })
    if (!json.asset?.url) throw new GenerateError('Generator returned no URL')
    return json
  }

  /** Three cheap drafts of one prompt (Draft tier; `premium` is ignored by the route). */
  async function callSheet(prompt: string, subject: string, aspect: FigureAspect = DEFAULT_ASPECT): Promise<SheetState['drafts']> {
    const json = await postGenerate({ ...generateBody(prompt, subject, aspect), mode: 'sheet' })
    const drafts = json.sheet?.drafts
    if (!drafts || drafts.length === 0) throw new GenerateError('Generator returned no drafts')
    return drafts.map((d) => ({ url: d.url, filename: d.filename }))
  }

  /** Render the picked draft at the Publication tier; the route deletes the unpicked siblings. */
  async function callFinalize(
    prompt: string, subject: string, aspect: FigureAspect, draftFilename: string, discardFilenames: string[],
  ): Promise<GenerateResponse> {
    const json = await postGenerate({
      ...generateBody(prompt, subject, aspect),
      premium: true,
      mode: 'finalize',
      draft_filename: draftFilename,
      discard_filenames: discardFilenames,
    })
    if (!json.asset?.url) throw new GenerateError('Generator returned no URL')
    return json
  }

  /** Delete drafts nobody will finalize. Fire-and-forget: a failed cleanup must never block the author. */
  function discardDrafts(filenames: string[]) {
    if (filenames.length === 0) return
    void fetch('/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'discard', discard_filenames: filenames }),
    }).catch(() => {})
  }

  function noteFor(json: GenerateResponse): SlotNote | null {
    const j = json.qa?.judgement
    if (!j || j.verdict === 'pass') return null
    const retried = (json.attempts ?? 1) > 1 ? ' Regenerated once automatically; this is the second try.' : ''
    return {
      tone: j.verdict,
      text: `${j.verdict === 'fail' ? 'Check this image' : 'Heads up'}: ${j.reasons.join('; ')}.${retried}`,
    }
  }

  function noteForError(err: unknown): SlotNote {
    if (err instanceof GenerateError && err.code === 'content_policy') return { tone: 'policy', text: err.message }
    return { tone: 'error', text: err instanceof Error ? err.message : 'Image generation failed' }
  }

  function setNote(slotId: string, note: SlotNote | null) {
    setSlotNotes((prev) => {
      const next = { ...prev }
      if (note) next[slotId] = note
      else delete next[slotId]
      return next
    })
  }

  function patchSheet(slotId: string, patch: Partial<SheetState>) {
    setSheets((prev) => (prev[slotId] ? { ...prev, [slotId]: { ...prev[slotId], ...patch } } : prev))
  }
  function clearSheet(slotId: string) {
    setSheets((prev) => {
      if (!prev[slotId]) return prev
      const next = { ...prev }
      delete next[slotId]
      return next
    })
  }
  /** The slot is being removed, reverted or replaced: discard its drafts and close its sheet. */
  function dropSheet(slotId: string) {
    const sheet = sheets[slotId]
    if (!sheet) return
    discardDrafts(sheet.drafts.map((d) => d.filename))
    clearSheet(slotId)
  }

  function metaOf(json: GenerateResponse): FigureImageMeta {
    return { width: json.asset?.width ?? null, height: json.asset?.height ?? null, origin: json.asset?.origin ?? 'ai' }
  }

  /** Upload responses carry the same facts (mig 166); origin is whatever the route recorded. */
  function uploadMeta(asset: { width?: number | null; height?: number | null; origin?: string | null } | undefined): FigureImageMeta {
    return { width: asset?.width ?? null, height: asset?.height ?? null, origin: asset?.origin ?? null }
  }

  function resolveAddPosition(): InsertPosition {
    if (addPosKey === 'start') return { kind: 'start' }
    if (addPosKey === 'end')   return { kind: 'end' }
    const idx = Number(addPosKey.replace('h-', ''))
    return { kind: 'afterHeading', index: idx }
  }

  // Prompt help context. The H2 a figure sits under: the last heading that
  // ends before the figure starts.
  function headingBefore(start: number): string | undefined {
    let text: string | undefined
    for (const h of headings) {
      if (h.end <= start) text = h.text
    }
    return text
  }
  // The draft the prompt route reads for title, category and the prose under
  // `afterHeading` (matched by heading text).
  function assistSource(afterHeading?: string) {
    return contentType && contentId ? { type: contentType, id: contentId, afterHeading } : undefined
  }
  // The section the add form inserts under, when the author picked one.
  const addHeading = addPosKey.startsWith('h-') ? headings[Number(addPosKey.replace('h-', ''))]?.text : undefined

  function resetAddForm() {
    setShowAdd(false)
    setAddMode('generate')
    setAddPrompt('')
    setAddCaption('')
    setAddAlt('')
    setAddAspect(DEFAULT_ASPECT)
    setAddPosKey('end')
    setAddBusy(false)
  }

  // ── Item-level operations ────────────────────────────────────────────────

  function handleMoveItem(slotId: string, targetPos: number) {
    onChangeContent(moveItemToPosition(content, slotId, targetPos))
  }
  function handleMoveToSection(slotId: string, position: InsertPosition) {
    onChangeContent(moveSlotToSection(content, slotId, position))
  }
  function handleRemoveItem(slotId: string) {
    if (!confirm('Remove this image (or gallery) from the article?')) return
    dropSheet(slotId)
    onChangeContent(removeItem(content, slotId))
  }

  // ── Single-slot operations ───────────────────────────────────────────────

  function handleRevert(slotId: string) {
    dropSheet(slotId)
    onChangeContent(revertSlot(content, slotId))
  }
  function handleFieldChange(slotId: string, field: 'caption' | 'alt' | 'prompt', value: string) {
    onChangeContent(updateSlotMeta(content, slotId, { [field]: value }))
  }
  function handleAspectChange(slotId: string, aspect: FigureAspect) {
    onChangeContent(updateSlotMeta(content, slotId, { aspect }))
  }
  // Prompt help picked a prompt for a slot. Alt text and caption fill only where
  // the author left them empty; a returned shape lands only if it is a figure aspect.
  function handleUsePrompt(slot: InlineSlot, p: AssistPick) {
    const next = updateSlotMeta(content, slot.slotId, {
      prompt: p.prompt,
      ...(slot.alt ? {} : p.altText ? { alt: p.altText } : {}),
      ...(slot.caption ? {} : p.caption ? { caption: p.caption } : {}),
      ...(p.aspect && isFigureAspect(p.aspect) ? { aspect: p.aspect } : {}),
    })
    onChangeContent(next)
  }

  // ── Gallery child operations ─────────────────────────────────────────────

  function handleMoveChild(gallerySlotId: string, childSlotId: string, direction: 'up' | 'down') {
    onChangeContent(moveChildInGallery(content, gallerySlotId, childSlotId, direction))
  }
  function handleDetachChild(childSlotId: string) {
    onChangeContent(detachFromGallery(content, childSlotId))
  }
  function handleRemoveChild(childSlotId: string) {
    if (!confirm('Remove this image from the gallery?')) return
    onChangeContent(removeSlot(content, childSlotId))
  }

  // ── Bulk fill ────────────────────────────────────────────────────────────

  async function handleFillAllEmpty() {
    const targets = fillableSlots
    if (targets.length === 0) return
    setError(null); setBulkBusy({ done: 0, total: targets.length })

    // Skip-and-continue: one refused or failed slot must not strand the rest.
    // A worker pool: CONCURRENCY workers pull the next unclaimed slot off a
    // shared index until none are left.
    let working = content
    const failedAt: number[] = []
    let nextIndex = 0
    let done = 0

    async function worker() {
      while (nextIndex < targets.length) {
        const i = nextIndex++
        const slot = targets[i]
        try {
          const json = await callGenerate(slot.prompt, slot.alt || slot.caption || slot.prompt.slice(0, 120), slot.aspect ?? DEFAULT_ASPECT)
          // JS is single-threaded: each continuation after an await runs to
          // completion before another starts, so every worker applies its slot
          // on the latest `working` and no fill is lost to a stale copy.
          // The alt from the pixels (QA) beats the pre-generation guess.
          working = fillSlot(working, slot.slotId, json.asset!.url!, json.asset?.alt_text || slot.alt || '', metaOf(json))
          onChangeContent(working)
          setNote(slot.slotId, noteFor(json))
        } catch (err) {
          setNote(slot.slotId, noteForError(err))
          failedAt.push(i + 1)
        }
        done++
        setBulkBusy({ done, total: targets.length })
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()))
    setBulkBusy(null)
    if (failedAt.length) {
      failedAt.sort((x, y) => x - y)
      setError(`${failedAt.length} of ${targets.length} slots did not fill (${failedAt.map((n) => `slot ${n}`).join(', ')}) — see the notes on each.`)
    }
  }

  // ── Per-slot AI/upload operations ────────────────────────────────────────

  async function handleRegenerate(slot: InlineSlot) {
    const prompt = slot.prompt.trim()
    if (!prompt) { setError('Add an image prompt first, then click Regenerate.'); return }
    setBusySlotId(slot.slotId); setError(null)
    try {
      const json = await callGenerate(prompt, slot.alt || slot.caption || prompt.slice(0, 120), slot.aspect ?? DEFAULT_ASPECT)
      onChangeContent(fillSlot(content, slot.slotId, json.asset!.url!, json.asset?.alt_text || slot.alt || '', metaOf(json)))
      setNote(slot.slotId, noteFor(json))
    } catch (err) {
      setNote(slot.slotId, noteForError(err))
      setError(err instanceof Error ? err.message : 'Image generation failed')
    }
    setBusySlotId(null)
  }

  // ── Contact sheet: three cheap drafts, pick one, finalize at Publication ──

  async function handleSheet(slot: InlineSlot) {
    const prompt = slot.prompt.trim()
    if (!prompt) { setError('Add an image prompt first, then click Contact sheet.'); return }
    setBusySlotId(slot.slotId); setError(null)
    try {
      const old = sheets[slot.slotId]
      const drafts = await callSheet(prompt, slot.alt || slot.caption || prompt.slice(0, 120), slot.aspect ?? DEFAULT_ASPECT)
      if (old) discardDrafts(old.drafts.map((d) => d.filename))
      setSheets((prev) => ({ ...prev, [slot.slotId]: { drafts, picked: null, busy: null } }))
      setNote(slot.slotId, null)
    } catch (err) {
      setNote(slot.slotId, noteForError(err))
      setError(err instanceof Error ? err.message : 'Image generation failed')
    }
    setBusySlotId(null)
  }

  function handlePick(slotId: string, filename: string) {
    patchSheet(slotId, { picked: filename })
  }

  async function handleFinalize(slot: InlineSlot) {
    const sheet = sheets[slot.slotId]
    const prompt = slot.prompt.trim()
    if (!sheet || !sheet.picked || !prompt) return
    const picked = sheet.picked
    setBusySlotId(slot.slotId); setError(null)
    patchSheet(slot.slotId, { busy: 'finalizing' })
    try {
      const json = await callFinalize(
        prompt,
        slot.alt || slot.caption || prompt.slice(0, 120),
        slot.aspect ?? DEFAULT_ASPECT,
        picked,
        sheet.drafts.map((d) => d.filename).filter((f) => f !== picked),
      )
      onChangeContent(fillSlot(content, slot.slotId, json.asset!.url!, json.asset?.alt_text || slot.alt || '', metaOf(json)))
      setNote(slot.slotId, noteFor(json))
      clearSheet(slot.slotId)
    } catch (err) {
      // Keep the sheet so he can retry or pick another draft.
      setNote(slot.slotId, noteForError(err))
      setError(err instanceof Error ? err.message : 'Image generation failed')
      patchSheet(slot.slotId, { busy: null })
    }
    setBusySlotId(null)
  }

  async function handleReroll(slot: InlineSlot) {
    const sheet = sheets[slot.slotId]
    const prompt = slot.prompt.trim()
    if (!sheet) return
    if (!prompt) { setError('Add an image prompt first, then reroll.'); return }
    setBusySlotId(slot.slotId); setError(null)
    patchSheet(slot.slotId, { busy: 'rerolling' })
    try {
      const drafts = await callSheet(prompt, slot.alt || slot.caption || prompt.slice(0, 120), slot.aspect ?? DEFAULT_ASPECT)
      // The old drafts go only once the new ones exist, so a failed reroll leaves a usable sheet.
      discardDrafts(sheet.drafts.map((d) => d.filename))
      setSheets((prev) => ({ ...prev, [slot.slotId]: { drafts, picked: null, busy: null } }))
      setNote(slot.slotId, null)
    } catch (err) {
      setNote(slot.slotId, noteForError(err))
      setError(err instanceof Error ? err.message : 'Image generation failed')
      patchSheet(slot.slotId, { busy: null })
    }
    setBusySlotId(null)
  }

  function handleDiscardSheet(slotId: string) {
    dropSheet(slotId)
  }

  // Reframe a filled slot's current image (AI-generated, library, or uploaded).
  // Loads the image into the free cropper; the result is saved as a NEW asset
  // and written back into the same slot — the source asset is never mutated.
  async function handleCropSlot(slot: InlineSlot) {
    if (!slot.imageUrl) return
    setError(null)
    try {
      const file = await fetchAssetAsFile(slot.imageUrl)
      setCropSlotTarget(slot)
      setCropSlotFile(file)
    } catch {
      setError('Could not load image for cropping — try again')
    }
  }

  async function handleCropSlotDone(blob: Blob) {
    const slot = cropSlotTarget
    setCropSlotFile(null); setCropSlotTarget(null)
    if (!slot) return
    setBusySlotId(slot.slotId); setError(null)
    try {
      const file = new File([blob], 'crop.webp', { type: 'image/webp' })
      const fd = new FormData()
      fd.append('file', file)
      if (slot.alt || slot.caption) fd.append('alt_text', slot.alt || slot.caption)
      if (productId) fd.append('product_id', productId)
      if (category)  fd.append('category', category)
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Crop save failed')
      onChangeContent(fillSlot(content, slot.slotId, json.asset.url, slot.alt || json.asset.alt_text || '', uploadMeta(json.asset)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop save failed')
    } finally {
      setBusySlotId(null)
    }
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
      onChangeContent(fillSlot(content, slot.slotId, json.asset.url, slot.alt || json.asset.alt_text || '', uploadMeta(json.asset)))
      setNote(slot.slotId, null)
      dropSheet(slot.slotId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setBusySlotId(null)
    setUploadSlotId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Picker select handlers ────────────────────────────────────────────────

  function handlePickerSelect(url: string, altText: string) {
    if (pickerSlot) {
      dropSheet(pickerSlot.slotId)
      onChangeContent(fillSlot(content, pickerSlot.slotId, url, pickerSlot.alt || altText))
      setPickerSlot(null)
    } else if (addToGalleryId) {
      const child = buildFilledFigure({ imageUrl: url, alt: altText })
      onChangeContent(addToGallery(content, addToGalleryId, child))
      setAddToGalleryId(null)
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

  function handleMultiSelect(selected: MultiSelectItem[]) {
    const children = selected.map(item =>
      buildFilledFigure({ imageUrl: item.url, alt: item.altText })
    )
    const galleryMarkup = buildGalleryWrapper(children)
    onChangeContent(insertAtPosition(content, galleryMarkup, resolveAddPosition()))
    setPickerForGallery(false)
    resetAddForm()
  }

  // ── Add-image form actions ────────────────────────────────────────────────

  async function handleAddSubmit() {
    setError(null)
    const position = resolveAddPosition()

    if (addMode === 'placeholder') {
      onChangeContent(insertAtPosition(content, buildPlaceholderFigure({ prompt: addPrompt, alt: addAlt, caption: addCaption, aspect: addAspect }), position))
      resetAddForm()
      return
    }
    if (addMode === 'library') {
      setPickerForNew(true)
      return
    }
    if (addMode === 'gallery') {
      setPickerForGallery(true)
      return
    }
    if (addMode === 'upload') {
      setUploadingForNew(true)
      fileInputRef.current?.click()
      return
    }

    // generate
    if (!addPrompt.trim()) { setError('Enter a prompt for the AI to generate the image.'); return }
    setAddBusy(true)
    try {
      const json = await callGenerate(addPrompt.trim(), addAlt || addCaption || addPrompt.slice(0, 120), addAspect)
      const markup = buildFilledFigure({
        imageUrl: json.asset!.url!,
        alt: json.asset?.alt_text || addAlt || addPrompt.slice(0, 120),
        caption: addCaption,
        prompt: addPrompt,
        aspect: addAspect,
        ...metaOf(json),
      })
      onChangeContent(insertAtPosition(content, markup, position))
      const note = noteFor(json)
      if (note) {
        const slotId = markup.match(/data-slot-id="([^"]+)"/)?.[1]
        if (slotId) setNote(slotId, note)
      }
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
      onChangeContent(insertAtPosition(content, buildFilledFigure({
        imageUrl: json.asset.url,
        alt: addAlt || json.asset.alt_text || 'Inline image',
        caption: addCaption,
        prompt: addPrompt,
        ...uploadMeta(json.asset),
      }), resolveAddPosition()))
      resetAddForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setAddBusy(false)
    setUploadingForNew(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]
    e.target.value = ''
    if (!raw) return
    // Free crop (skippable) before upload — article body has no fixed ratio.
    // The destination (uploadingForNew / uploadSlotId) stays in state while
    // the cropper is open, so dispatchUpload routes correctly on confirm/skip.
    const file = await compressImage(raw).catch(() => raw)
    setCropPending(file)
  }

  function dispatchUpload(file: File) {
    if (uploadingForNew) { handleNewUploadFile(file); return }
    if (uploadSlotId) {
      const slot = allSlots.find(s => s.slotId === uploadSlotId)
      if (slot) uploadFileForSlot(file, slot)
    }
  }

  function handleCropDone(blob: Blob) {
    setCropPending(null)
    dispatchUpload(new File([blob], 'crop.webp', { type: 'image/webp' }))
  }
  function handleCropSkip() {
    const f = cropPending
    setCropPending(null)
    if (f) dispatchUpload(f)
  }

  // ── Position-picker options ───────────────────────────────────────────────
  const positionOptions = [
    { value: 'start', label: 'Start of article' },
    ...headings.map((h, i) => ({
      value: `h-${i}`,
      label: `After: ${h.text.length > 40 ? h.text.slice(0, 40) + '…' : h.text}`,
    })),
    { value: 'end', label: 'End of article' },
  ]

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <details open className="bg-surface border border-accent-border/40 rounded-xl">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-accent-text-soft">🎨</span> Inline images
          {filledCount > 0 && (
            <span className="px-2 py-0.5 bg-green-50 border border-green-300 text-forest rounded-full text-xs">
              {filledCount} filled
            </span>
          )}
          {openCount > 0 && (
            <span className="px-2 py-0.5 bg-accent-tint border border-accent-border/40 text-accent-text-soft rounded-full text-xs">
              {openCount} open
            </span>
          )}
          {ownedWaiting > 0 && (
            <span className="px-2 py-0.5 bg-surface border border-strong text-prose-muted rounded-full text-xs">
              {ownedWaiting} waiting for your photo
            </span>
          )}
          {allSlots.length === 0 && (
            <span className="text-xs text-prose-faint font-normal">none yet</span>
          )}
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-3">

        {/* ── Generation knobs (apply to every generate action) ───────── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-prose-faint mr-1">Quality</span>
            <button
              type="button"
              onClick={() => setPremium(true)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                premium ? 'bg-accent text-white' : 'bg-surface border border-soft text-prose-muted hover:text-prose'
              }`}
              title={IMAGE_TIERS.publication.hint}
            >
              {IMAGE_TIERS.publication.label}
            </button>
            <button
              type="button"
              onClick={() => setPremium(false)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                !premium ? 'bg-accent text-white' : 'bg-surface border border-soft text-prose-muted hover:text-prose'
              }`}
              title={IMAGE_TIERS.draft.hint}
            >
              {IMAGE_TIERS.draft.label}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-prose-faint">Look</span>
            <Segmented value={look} options={LOOK_OPTIONS} onChange={setLook} label="Photograph or illustration" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-prose-faint">People</span>
            <Segmented value={people} options={PEOPLE_OPTIONS} onChange={setPeople} label="People in generated images" />
          </div>
          <label className="flex items-center gap-1.5 text-prose-muted cursor-pointer">
            <input type="checkbox" checked={allowText} onChange={(e) => setAllowText(e.target.checked)} className="accent-[var(--bd-orange)]" />
            Allow text in image
          </label>
          <div className="flex items-center">
            <Switch id={moderationId} checked={moderation === 'low'} onChange={(on) => setModeration(on ? 'low' : 'auto')} />
            <label htmlFor={moderationId} className="text-prose-muted cursor-pointer">Relaxed moderation</label>
          </div>
        </div>
        <p className="text-[11px] text-prose-faint -mt-1">
          House style, no brands and no identifiable children are always on. Anonymous = hands, from behind, face out of frame. Every result is checked by vision QA; a problem shows on the slot. Relaxed moderation loosens only the model&apos;s own filter for benign dad-life scenes; brands, faces and text rules are unchanged.
        </p>

        {/* ── Bulk fill ───────────────────────────────────────────────── */}
        {!showAdd && fillableSlots.length > 0 && (
          <button
            type="button"
            onClick={handleFillAllEmpty}
            disabled={bulkBusy !== null}
            className="w-full px-4 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors min-h-[44px]"
          >
            {bulkBusy
              ? `✨ Generating ${bulkBusy.done}/${bulkBusy.total}…`
              : `✨ Fill ${fillableSlots.length} empty slot${fillableSlots.length === 1 ? '' : 's'} with AI`}
          </button>
        )}
        {!showAdd && ownedWaiting > 0 && (
          <p className="text-xs text-prose-muted">
            {ownedWaiting} slot{ownedWaiting === 1 ? ' is' : 's are'} waiting for your own photo: a screen, a document or a specific product that AI cannot draw. Upload {ownedWaiting === 1 ? 'it' : 'them'} or pick from the library; bulk fill skips {ownedWaiting === 1 ? 'it' : 'them'}.
          </p>
        )}

        {/* ── Add image button + form ─────────────────────────────────── */}
        {!showAdd ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={bulkBusy !== null}
            className={buttonVariants({ className: 'w-full' })}
          >
            + Add inline image or gallery
          </button>
        ) : (
          <div className="p-3 bg-surface-sunken border border-accent-border/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-accent-text-soft font-semibold uppercase tracking-widest">New inline image</p>
              <button type="button" onClick={resetAddForm} className="text-prose-faint hover:text-prose text-xs">Cancel</button>
            </div>

            {/* Mode tabs */}
            <div className="flex flex-wrap gap-1.5">
              {([
                { v: 'generate',    l: 'AI generate' },
                { v: 'library',     l: 'Library' },
                { v: 'upload',      l: 'Upload' },
                { v: 'placeholder', l: 'Empty slot' },
                { v: 'gallery',     l: 'Gallery' },
              ] as Array<{ v: AddMode; l: string }>).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setAddMode(opt.v)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg min-h-[36px] transition-colors ${
                    addMode === opt.v
                      ? 'bg-accent text-white'
                      : 'bg-surface-raised text-prose-muted hover:bg-zinc-700'
                  }`}
                >{opt.l}</button>
              ))}
            </div>

            {/* Gallery help text */}
            {addMode === 'gallery' && (
              <p className="text-xs text-prose-muted bg-surface rounded-lg px-3 py-2">
                Select 2 or more images from your library. They&apos;ll be inserted as a responsive grid (1→2→3 columns).
              </p>
            )}

            {/* Prompt — needed for generate + placeholder */}
            {(addMode === 'generate' || addMode === 'placeholder') && (
              <div>
                <label className="block text-xs text-prose-muted mb-1">
                  Image prompt {addMode === 'generate' && <span className="text-red-700">*</span>}
                </label>
                <textarea
                  value={addPrompt}
                  onChange={(e) => setAddPrompt(e.target.value)}
                  rows={2}
                  placeholder="e.g. a worn cordless drill on a garage workbench in late afternoon, sawdust on the floor, one half-finished shelf"
                  className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover resize-none"
                />
                {/* Rewrite / 3 ideas / suggest one from the section: a cheap text
                    call, separate from the paid generate. */}
                <div className="mt-2">
                  <PromptAssist
                    compact
                    target="inline"
                    value={addPrompt}
                    people={people}
                    allowText={allowText}
                    look={look}
                    aspect={addAspect}
                    context={addHeading ? { heading: addHeading } : undefined}
                    source={assistSource(addHeading)}
                    disabled={addBusy}
                    onUse={(p) => {
                      setAddPrompt(p.prompt)
                      if (!addAlt && p.altText) setAddAlt(p.altText)
                      if (!addCaption && p.caption) setAddCaption(p.caption)
                      if (p.aspect && isFigureAspect(p.aspect)) setAddAspect(p.aspect)
                    }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-prose-muted">Shape</span>
                  <Segmented value={addAspect} options={ASPECT_OPTIONS} onChange={setAddAspect} label="Image shape" />
                </div>
              </div>
            )}

            {/* Caption + alt — not shown for gallery mode */}
            {addMode !== 'gallery' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-prose-muted mb-1">Caption (optional)</label>
                  <input
                    type="text"
                    value={addCaption}
                    onChange={(e) => setAddCaption(e.target.value)}
                    placeholder="Shown under the image"
                    className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover"
                  />
                </div>
                <div>
                  <label className="block text-xs text-prose-muted mb-1">Alt text (SEO)</label>
                  <input
                    type="text"
                    value={addAlt}
                    onChange={(e) => setAddAlt(e.target.value)}
                    placeholder="Short description for screen readers"
                    className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-prose-muted mb-1">Insert at position</label>
              <select
                value={addPosKey}
                onChange={(e) => setAddPosKey(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-sm text-prose focus:outline-none focus:ring-1 focus:ring-accent-hover"
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
              className={buttonVariants({ className: 'w-full' })}
            >
              {addBusy
                ? 'Working…'
                : addMode === 'generate'    ? 'Generate & insert'
                : addMode === 'library'     ? 'Pick from library'
                : addMode === 'upload'      ? 'Choose file & insert'
                : addMode === 'gallery'     ? 'Pick images for gallery'
                                            : 'Insert empty slot'}
            </button>
          </div>
        )}

        {/* ── Item cards ──────────────────────────────────────────────── */}
        {items.map((item, idx) =>
          item.kind === 'single' ? (
            <SlotCard
              key={item.slot.slotId}
              slot={item.slot}
              position={idx + 1}
              total={items.length}
              headings={headings}
              heading={headingBefore(item.slot.start)}
              busy={busySlotId === item.slot.slotId}
              note={slotNotes[item.slot.slotId] ?? null}
              people={people}
              allowText={allowText}
              look={look}
              source={assistSource(headingBefore(item.slot.start))}
              onMove={(toPos) => handleMoveItem(item.slot.slotId, toPos)}
              onMoveToSection={(pos) => handleMoveToSection(item.slot.slotId, pos)}
              onRemove={() => handleRemoveItem(item.slot.slotId)}
              onRevert={() => handleRevert(item.slot.slotId)}
              onFieldChange={(field, value) => handleFieldChange(item.slot.slotId, field, value)}
              onAspectChange={(aspect) => handleAspectChange(item.slot.slotId, aspect)}
              onUsePrompt={(p) => handleUsePrompt(item.slot, p)}
              onRegenerate={() => handleRegenerate(item.slot)}
              onPickReplace={() => setPickerSlot(item.slot)}
              onUpload={() => { setUploadSlotId(item.slot.slotId); fileInputRef.current?.click() }}
              onCrop={() => handleCropSlot(item.slot)}
              sheet={sheets[item.slot.slotId] ?? null}
              onSheet={() => handleSheet(item.slot)}
              onPick={(filename) => handlePick(item.slot.slotId, filename)}
              onFinalize={() => handleFinalize(item.slot)}
              onReroll={() => handleReroll(item.slot)}
              onDiscardSheet={() => handleDiscardSheet(item.slot.slotId)}
            />
          ) : (
            <GalleryCard
              key={item.slotId}
              item={item}
              position={idx + 1}
              total={items.length}
              busySlotId={busySlotId}
              notes={slotNotes}
              onMoveGallery={(toPos) => handleMoveItem(item.slotId, toPos)}
              onRemoveGallery={() => handleRemoveItem(item.slotId)}
              onMoveChild={(childSlotId, dir) => handleMoveChild(item.slotId, childSlotId, dir)}
              onDetachChild={handleDetachChild}
              onRemoveChild={handleRemoveChild}
              onFieldChange={handleFieldChange}
              onRegenerateChild={handleRegenerate}
              onPickReplaceChild={setPickerSlot}
              onUploadChild={(slotId) => { setUploadSlotId(slotId); fileInputRef.current?.click() }}
              onRevertChild={handleRevert}
              onCropChild={handleCropSlot}
              onAddChild={() => setAddToGalleryId(item.slotId)}
            />
          )
        )}

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">{error}</p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
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
      {pickerForGallery && (
        <MediaPicker
          multi
          onSelect={() => {}}
          onMultiSelect={handleMultiSelect}
          onClose={() => { setPickerForGallery(false); setAddBusy(false) }}
          defaultProductId={productId}
          defaultCategory={category}
        />
      )}
      {addToGalleryId && (
        <MediaPicker
          onSelect={handlePickerSelect}
          onClose={() => setAddToGalleryId(null)}
          defaultProductId={productId}
          defaultCategory={category}
        />
      )}

      {cropPending && (
        <ImageCropper
          file={cropPending}
          allowRatioChange
          onCrop={handleCropDone}
          onCancel={() => setCropPending(null)}
          onSkip={handleCropSkip}
        />
      )}

      {cropSlotFile && (
        <ImageCropper
          file={cropSlotFile}
          allowRatioChange
          onCrop={handleCropSlotDone}
          onCancel={() => { setCropSlotFile(null); setCropSlotTarget(null) }}
        />
      )}
    </details>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GalleryCard — group-level controls + per-child controls

interface GalleryCardProps {
  item: Extract<InlineItem, { kind: 'gallery' }>
  position: number
  total: number
  busySlotId: string | null
  notes: Record<string, SlotNote>
  onMoveGallery: (toPos: number) => void
  onRemoveGallery: () => void
  onMoveChild: (childSlotId: string, direction: 'up' | 'down') => void
  onDetachChild: (childSlotId: string) => void
  onRemoveChild: (childSlotId: string) => void
  onFieldChange: (slotId: string, field: 'caption' | 'alt' | 'prompt', value: string) => void
  onRegenerateChild: (slot: InlineSlot) => void
  onPickReplaceChild: (slot: InlineSlot) => void
  onUploadChild: (slotId: string) => void
  onRevertChild: (slotId: string) => void
  onCropChild: (slot: InlineSlot) => void
  onAddChild: () => void
}

function GalleryCard(p: GalleryCardProps) {
  const { item, position, total, busySlotId } = p
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-surface-sunken border border-blue-300 rounded-lg overflow-hidden">
      {/* Gallery header */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2.5 bg-blue-50 border-b border-blue-300">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="text-blue-700 text-xs font-semibold flex items-center gap-1.5 hover:text-blue-700 transition-colors"
          >
            <span>{expanded ? '▾' : '▸'}</span>
            <span>🖼 Gallery</span>
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px]">
              {item.children.length} image{item.children.length === 1 ? '' : 's'}
            </span>
          </button>
          <select
            value={position}
            onChange={(e) => p.onMoveGallery(Number(e.target.value))}
            disabled={total <= 1}
            className="px-2 py-1 bg-surface border border-strong rounded-lg text-xs text-prose min-h-[32px] focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:opacity-50"
            title="Move gallery to position"
          >
            {Array.from({ length: total }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Position {n} of {total}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => p.onMoveGallery(position - 1)}
            disabled={position === 1}
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move gallery up"
          >↑</button>
          <button
            type="button"
            onClick={() => p.onMoveGallery(position + 1)}
            disabled={position === total}
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Move gallery down"
          >↓</button>
          <button
            type="button"
            onClick={p.onAddChild}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg min-h-[36px] transition-colors"
            title="Add an image to this gallery"
          >+ Add</button>
          <button
            type="button"
            onClick={p.onRemoveGallery}
            className="px-2.5 py-1.5 bg-transparent hover:bg-red-50 text-prose-faint hover:text-red-700 text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors"
            title="Remove entire gallery"
          ><TrashIcon className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
        </div>
      </div>

      {/* Children */}
      {expanded && (
        <div className="p-2 space-y-2">
          {item.children.map((child, childIdx) => (
            <div key={child.slotId} className={`p-3 rounded-lg space-y-2.5 ${child.filled ? 'bg-surface border border-green-300' : 'bg-surface border border-accent-border/20'}`}>
              {/* Child header */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-xs font-semibold ${child.filled ? 'text-forest' : 'text-accent-text-soft'}`}>
                  {child.filled ? 'Image' : 'Slot'} {childIdx + 1}/{item.children.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => p.onMoveChild(child.slotId, 'up')}
                    disabled={childIdx === 0 || busySlotId === child.slotId}
                    className="px-2 py-1 bg-surface-raised hover:bg-surface disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[32px] min-w-[32px] transition-colors"
                    title="Move left in gallery"
                  >←</button>
                  <button
                    type="button"
                    onClick={() => p.onMoveChild(child.slotId, 'down')}
                    disabled={childIdx === item.children.length - 1 || busySlotId === child.slotId}
                    className="px-2 py-1 bg-surface-raised hover:bg-surface disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[32px] min-w-[32px] transition-colors"
                    title="Move right in gallery"
                  >→</button>
                  <button
                    type="button"
                    onClick={() => p.onDetachChild(child.slotId)}
                    disabled={busySlotId === child.slotId}
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    title="Remove from gallery and place standalone after it"
                  >⤴ Detach</button>
                  <button
                    type="button"
                    onClick={() => p.onRemoveChild(child.slotId)}
                    disabled={busySlotId === child.slotId}
                    className="px-2 py-1 bg-transparent hover:bg-red-50 text-prose-faint hover:text-red-700 text-xs rounded-lg min-h-[32px] min-w-[32px] transition-colors"
                    title="Remove image"
                  ><TrashIcon className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
                </div>
              </div>

              {/* Thumbnail + fields */}
              <div className="flex gap-3 items-start">
                {child.filled && child.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={child.imageUrl}
                    alt={child.alt || child.caption}
                    className="w-16 h-16 object-cover rounded-lg border border-soft shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 bg-surface-raised border border-dashed border-strong rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-xl">🖼</span>
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <EditableField label="Caption" value={child.caption} placeholder="Shown under image" onCommit={(v) => p.onFieldChange(child.slotId, 'caption', v)} disabled={busySlotId === child.slotId} />
                  <EditableField label="Alt text" value={child.alt} placeholder="Screen reader description" onCommit={(v) => p.onFieldChange(child.slotId, 'alt', v)} disabled={busySlotId === child.slotId} />
                  <EditableField label="AI prompt" value={child.prompt} placeholder="Describe the image" onCommit={(v) => p.onFieldChange(child.slotId, 'prompt', v)} disabled={busySlotId === child.slotId} multiline />
                </div>
              </div>

              <SlotNoteLine note={p.notes[child.slotId] ?? null} />

              {/* Child actions */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-soft">
                <button
                  type="button"
                  onClick={() => p.onRegenerateChild(child)}
                  disabled={busySlotId === child.slotId || !child.prompt.trim()}
                  className={buttonVariants({ size: 'sm' })}
                >
                  {busySlotId === child.slotId ? '✨ Working…' : child.filled ? '🔄 Regenerate' : '✨ Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => p.onPickReplaceChild(child)}
                  disabled={busySlotId === child.slotId}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >📁 {child.filled ? 'Replace' : 'Library'}</button>
                <button
                  type="button"
                  onClick={() => p.onUploadChild(child.slotId)}
                  disabled={busySlotId === child.slotId}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >⬆ Upload</button>
                {child.filled && (
                  <button
                    type="button"
                    onClick={() => p.onCropChild(child)}
                    disabled={busySlotId === child.slotId}
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    title="Crop / reframe this image"
                  >✂ Crop</button>
                )}
                {child.filled && (
                  <button
                    type="button"
                    onClick={() => p.onRevertChild(child.slotId)}
                    disabled={busySlotId === child.slotId}
                    className="px-3 py-1.5 bg-transparent hover:bg-amber-50 text-prose-faint hover:text-amber-700 text-xs rounded-lg min-h-[36px] transition-colors"
                  >↩ Revert</button>
                )}
              </div>
            </div>
          ))}

          {item.children.length === 0 && (
            <p className="text-xs text-prose-faint text-center py-3">Gallery is empty — click &quot;+ Add&quot; to add images.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotCard — one card per standalone inline image

interface SlotCardProps {
  slot: InlineSlot
  position: number
  total: number
  headings: H2Heading[]
  /** The H2 this slot sits under, if any: section context for Prompt help. */
  heading?: string
  busy: boolean
  /** The generator's last word on this slot (QA warning, refusal, error). */
  note: SlotNote | null
  /** The panel's lane knobs, so Prompt help writes for what Generate allows. */
  people: PeoplePolicy
  allowText: boolean
  look: ImageLook
  /** The draft this figure belongs to; the prompt route reads it for context. */
  source?: { type: 'review' | 'guide'; id: string; afterHeading?: string }
  onMove: (toPos: number) => void
  onMoveToSection: (pos: InsertPosition) => void
  onRemove: () => void
  onRevert: () => void
  onFieldChange: (field: 'caption' | 'alt' | 'prompt', value: string) => void
  onAspectChange: (aspect: FigureAspect) => void
  /** The author used a Prompt help result for this slot. */
  onUsePrompt: (p: AssistPick) => void
  onRegenerate: () => void
  onPickReplace: () => void
  onUpload: () => void
  onCrop: () => void
  /** This slot's open contact sheet, if any. */
  sheet: SheetState | null
  onSheet: () => void
  onPick: (filename: string) => void
  onFinalize: () => void
  onReroll: () => void
  onDiscardSheet: () => void
}

/** One line under a slot: what vision QA or the model said about the last image. */
function SlotNoteLine({ note }: { note: SlotNote | null }) {
  if (!note) return null
  const tone =
    note.tone === 'warn' ? 'bg-warn-bg text-warn-ink border-warn-line'
    : 'bg-danger-bg text-danger-ink border-danger-line'
  const lead =
    note.tone === 'policy' ? 'Refused — edit the prompt and regenerate. '
    : note.tone === 'error' ? 'Failed. '
    : ''
  return (
    <p className={`text-xs rounded-lg border px-2.5 py-1.5 leading-snug ${tone}`} role="status">
      {lead}{note.text}
    </p>
  )
}

function SlotCard(p: SlotCardProps) {
  const { slot, position, total, headings, busy } = p
  const filled = slot.filled
  // The photo editor marked this slot as one only the author can capture.
  const owned = slot.need === 'owned'

  const sectionOptions: Array<{ label: string; pos: InsertPosition }> = [
    { label: 'Start of article', pos: { kind: 'start' } },
    ...headings.map((h, i) => ({
      label: `After: ${h.text.length > 38 ? h.text.slice(0, 38) + '…' : h.text}`,
      pos: { kind: 'afterHeading' as const, index: i },
    })),
    { label: 'End of article', pos: { kind: 'end' } },
  ]

  // Derive which section the slot currently sits in, so the dropdown reflects reality
  const currentSectionIdx = (() => {
    let nearest = -1
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].end <= slot.start) nearest = i
    }
    if (nearest === -1) return 0 // before any heading → Start
    return nearest + 1           // after heading[nearest] → After: H2[nearest]
  })()

  return (
    <div className={`p-3 rounded-lg space-y-3 ${
      filled
        ? 'bg-surface-sunken border border-green-300'
        : 'bg-surface-sunken border border-accent-border/30'
    }`}>

      {/* Header: position + reorder + remove */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${filled ? 'text-forest' : 'text-accent-text-soft'}`}>
            {filled ? 'Image' : 'Slot'}
          </span>
          <select
            value={position}
            onChange={(e) => p.onMove(Number(e.target.value))}
            disabled={busy || total <= 1}
            className="px-2 py-1.5 bg-surface border border-strong rounded-lg text-xs text-prose min-h-[36px] focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:opacity-50"
            title="Reorder among images"
          >
            {Array.from({ length: total }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>#{n} of {total}</option>
            ))}
          </select>
          {sectionOptions.length > 2 && (
            <select
              value={currentSectionIdx}
              onChange={(e) => {
                const opt = sectionOptions[Number(e.target.value)]
                if (opt) p.onMoveToSection(opt.pos)
              }}
              disabled={busy}
              className="px-2 py-1.5 bg-surface border border-accent-border/40 rounded-lg text-xs text-accent-text min-h-[36px] focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:opacity-50"
              title="Move to article section"
            >
              {sectionOptions.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => p.onMove(position - 1)} disabled={busy || position === 1}
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors" title="Move up">↑</button>
          <button type="button" onClick={() => p.onMove(position + 1)} disabled={busy || position === total}
            className="px-2.5 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-30 text-prose-muted text-xs rounded-lg min-h-[36px] min-w-[36px] transition-colors" title="Move down">↓</button>
          <button type="button" onClick={p.onRemove} disabled={busy}
            className="px-2.5 py-1.5 bg-transparent hover:bg-red-50 text-prose-faint hover:text-red-700 text-xs rounded-lg min-h-[36px] min-w-[36px] inline-flex items-center justify-center transition-colors" title="Remove image"><TrashIcon className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
        </div>
      </div>

      {owned && !filled && (
        <p className="text-xs text-prose bg-surface border border-soft rounded-lg px-3 py-2 leading-snug">
          <span className="font-semibold">Your photo:</span> {slot.ask || 'add your own picture for this slot'}
        </p>
      )}

      {/* Body: thumbnail + editable fields */}
      <div className="flex gap-3 items-start">
        {filled && slot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slot.imageUrl} alt={slot.alt || slot.caption}
            className="w-20 h-16 sm:w-24 sm:h-20 object-cover rounded-lg border border-soft shrink-0" />
        ) : (
          <div className="w-20 h-16 sm:w-24 sm:h-20 bg-surface border border-dashed border-strong rounded-lg flex items-center justify-center shrink-0">
            <span className="text-2xl">🖼</span>
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <EditableField label="Caption" value={slot.caption} placeholder="Shown under the image" onCommit={(v) => p.onFieldChange('caption', v)} disabled={busy} />
          <EditableField label="Alt text" value={slot.alt} placeholder="Short description for screen readers" onCommit={(v) => p.onFieldChange('alt', v)} disabled={busy} />
          <EditableField label="AI prompt" value={slot.prompt} placeholder={owned ? 'Add your own photo below, or describe an image here to generate one instead' : 'Describe the image — used by Regenerate'} onCommit={(v) => p.onFieldChange('prompt', v)} disabled={busy} multiline />
        </div>
      </div>

      {/* Rewrite / 3 ideas / suggest / describe the photo: a cheap text call;
          Regenerate stays the paid step. Full card width on purpose — beside
          the thumbnail it had ~220px on a phone and its buttons stacked three deep. */}
      <PromptAssist
        compact
        target="inline"
        value={slot.prompt}
        people={p.people}
        allowText={p.allowText}
        look={p.look}
        aspect={slot.aspect ?? DEFAULT_ASPECT}
        imageUrl={slot.imageUrl}
        context={p.heading ? { heading: p.heading } : undefined}
        source={p.source}
        disabled={busy}
        onUse={p.onUsePrompt}
      />

      {/* Shape: the figure aspect Generate and Regenerate use (3:2 when none is set). */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-prose-faint">Shape</span>
        <Segmented value={slot.aspect ?? DEFAULT_ASPECT} options={ASPECT_OPTIONS} onChange={p.onAspectChange} label="Image shape" />
      </div>

      <SlotNoteLine note={p.note} />

      {p.sheet && (
        <ContactSheetPicker
          drafts={p.sheet.drafts}
          aspect={slot.aspect ?? DEFAULT_ASPECT}
          picked={p.sheet.picked}
          busy={p.sheet.busy}
          disabled={busy}
          finalLabel={IMAGE_TIERS.publication.label}
          onPick={p.onPick}
          onFinalize={p.onFinalize}
          onReroll={p.onReroll}
          onDiscard={p.onDiscardSheet}
        />
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-soft">
        <button type="button" onClick={p.onRegenerate} disabled={busy || !slot.prompt.trim()}
          className={buttonVariants({ size: 'sm' })}
          title={!slot.prompt.trim() ? (owned ? 'This one wants your own photo; add an AI prompt only to generate it instead' : 'Add an AI prompt first') : 'Regenerate with current prompt'}>
          {busy ? '✨ Working…' : filled ? '🔄 Regenerate' : '✨ Generate'}
        </button>
        <button type="button" onClick={p.onSheet} disabled={busy || !slot.prompt.trim()}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
          title="Three cheap drafts to pick a composition, then finalize at Publication">
          Contact sheet
        </button>
        <button type="button" onClick={p.onPickReplace} disabled={busy}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          📁 {filled ? 'Replace' : 'Library'}
        </button>
        <button type="button" onClick={p.onUpload} disabled={busy}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          ⬆ Upload {filled ? 'new' : ''}
        </button>
        {filled && (
          <button type="button" onClick={p.onCrop} disabled={busy}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            title="Crop / reframe this image">✂ Crop</button>
        )}
        {filled && (
          <button type="button" onClick={p.onRevert} disabled={busy}
            className="px-3 py-2 bg-transparent hover:bg-amber-50 text-prose-faint hover:text-amber-700 text-xs rounded-lg min-h-[36px] transition-colors"
            title="Convert back to empty slot (keeps prompt + caption)">↩ Revert</button>
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
  // Re-seed the draft when the committed value changes upstream — adjusted
  // during render (React's "storing information from previous renders"), not
  // in an effect, so there's no extra render with a stale draft.
  const [seededFrom, setSeededFrom] = useState(value)
  if (value !== seededFrom) {
    setSeededFrom(value)
    setLocal(value)
  }

  function commit() { if (local !== value) onCommit(local) }

  const cls = 'w-full px-2.5 py-1.5 bg-surface border border-soft rounded-lg text-xs text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:opacity-50'

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-prose-faint mb-0.5">{label}</label>
      {multiline ? (
        <textarea value={local} onChange={(e) => setLocal(e.target.value)} onBlur={commit}
          rows={2} placeholder={placeholder} disabled={disabled} className={cls + ' resize-none'} />
      ) : (
        <input type="text" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder={placeholder} disabled={disabled} className={cls} />
      )}
    </div>
  )
}
