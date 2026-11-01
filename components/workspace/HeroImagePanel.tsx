'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { fetchAssetAsFile } from '@/lib/images/derive-crop'
import { downloadImage } from '@/lib/images/download'
import { buttonVariants } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { PromptAssist } from '@/components/workspace/PromptAssist'
import { ContactSheetPicker, type SheetDraft } from '@/components/workspace/ContactSheetPicker'
import { XIcon } from '@/components/icons'
import type { PeoplePolicy } from '@/lib/images/safety'
import { IMAGE_TIERS } from '@/lib/images/tiers'

/** A contact sheet in progress: three Draft-tier renders of one prompt, waiting for a pick. */
type HeroSheet = {
  drafts: SheetDraft[]
  picked: string | null
  busy: 'finalizing' | 'rerolling' | null
  /** The prompt the drafts were rendered from — Finalize re-sends it so the final matches. */
  prompt: string
}

type HeroResponse = {
  imageUrl?: string
  promptUsed?: string
  qa?: { judgement?: { verdict: 'pass' | 'warn' | 'fail'; reasons: string[] } } | null
  attempts?: number
  sheet?: { drafts?: SheetDraft[] }
}

const PEOPLE_OPTIONS: { value: PeoplePolicy; label: string }[] = [
  { value: 'none',      label: 'No people' },
  { value: 'anonymous', label: 'Anonymous' },
  { value: 'allowed',   label: 'Faces OK' },
]
const MediaPicker   = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })
const ImageCropper  = dynamic(() => import('@/components/ui/ImageCropper'),   { ssr: false })

interface Props {
  imageUrl: string | null
  onChange: (url: string | null) => void
  label?: string
  contentType: 'guide' | 'review'
  /** The guide/review draft id — links a generated hero to its source in the media library. */
  sourceId?: string
  title?: string
  category?: string
  excerpt?: string
  productName?: string
  initialPrompt?: string
}

export function HeroImagePanel({
  imageUrl, onChange, label = 'Hero Image',
  contentType, sourceId, title, category, excerpt, productName, initialPrompt,
}: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [pendingCrop, setPendingCrop] = useState<File | null>(null)
  const [imagePrompt, setImagePrompt] = useState('')

  // When the workspace reads its sessionStorage suggestion and passes it in,
  // pre-fill the prompt field (only if the user hasn't typed anything yet).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialPrompt && !imagePrompt) setImagePrompt(initialPrompt)
  }, [initialPrompt]) // eslint-disable-line react-hooks/exhaustive-deps
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  // The publication tier by default (IMAGE_TIERS in lib/images/tiers.ts names
  // the model); the draft tier is for roughing out a composition before the real one.
  const [premium, setPremium] = useState(true)
  // Lane knob (lib/images/safety.ts EDITORIAL): no text always; people anonymous.
  const [people, setPeople] = useState<PeoplePolicy>('anonymous')
  // OpenAI's own content filter: 'low' loosens it for benign dad-life scenes that
  // 'auto' sometimes refuses (a kid on shoulders, a campfire). Our rules are unchanged.
  const [moderation, setModeration] = useState<'auto' | 'low'>('auto')
  // The contact sheet for this hero, when one is open (Sprint B).
  const [sheet, setSheet] = useState<HeroSheet | null>(null)
  // What vision QA said about the last generated hero (warn/fail + reasons).
  const [qaNote, setQaNote] = useState<{ verdict: 'warn' | 'fail'; reasons: string[]; attempts: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  // True only while the crop in flight came from the camera — a reframe of an
  // existing image must not be recorded as the author's own photo.
  const cropFromCameraRef = useRef(false)

  // Defensive response reader. When an API route throws an uncaught error or
  // Vercel hits the serverless maxDuration, the body comes back as plain
  // HTML/text — `res.json()` then throws `Unexpected token 'A'...`. Read text
  // first, try-parse, fall back to a readable error string.
  async function readJsonResponse<T extends Record<string, unknown>>(res: Response, fallback: string): Promise<T> {
    const text = await res.text()
    let parsed: T = {} as T
    try { parsed = text ? JSON.parse(text) as T : ({} as T) } catch { /* non-JSON error body */ }
    if (!res.ok) {
      const msg = (parsed as { error?: string }).error ?? (text ? text.slice(0, 200) : '') ?? ''
      throw new Error(msg || fallback || `HTTP ${res.status}`)
    }
    return parsed
  }

  function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0]
    if (!raw) return
    cropFromCameraRef.current = true
    setPendingCrop(raw)
    e.target.value = ''
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingCrop(null)
    setUploading(true)
    setError(null)
    const fromCamera = cropFromCameraRef.current
    cropFromCameraRef.current = false
    try {
      const file = new File([blob], 'hero.webp', { type: 'image/webp' })
      const fd = new FormData()
      fd.append('file', file)
      if (fromCamera) fd.append('origin', 'own')
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      const json = await readJsonResponse<{ asset?: { url?: string } }>(res, 'Upload failed')
      onChange(json.asset?.url ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setUploading(false)
  }

  // Reframe the current hero (AI-generated, library, or uploaded) at 16:10.
  // Reuses handleCropConfirm, which uploads a NEW asset — the source URL is
  // never mutated.
  async function handleCropExisting() {
    if (!imageUrl) return
    setError(null)
    cropFromCameraRef.current = false
    try {
      const file = await fetchAssetAsFile(imageUrl)
      setPendingCrop(file)
    } catch {
      setError('Could not load image for cropping — try again')
    }
  }

  // One body for every hero call; `mode` picks single / sheet / finalize / discard
  // (app/api/images/hero). The prompt is passed in so Finalize can re-send the
  // exact text the drafts were rendered from, even if the field changed since.
  function heroBody(mode: 'single' | 'sheet' | 'finalize' | 'discard', prompt: string, extra: Record<string, unknown> = {}) {
    return JSON.stringify({
      mode,
      title: title ?? productName ?? '',
      category: category ?? 'other',
      excerpt: excerpt ?? null,
      content_type: contentType,
      product_name: productName ?? null,
      custom_prompt: prompt.trim() || null,
      premium,
      people,
      no_text: true,
      moderation,
      source_id: sourceId ?? null,
      ...extra,
    })
  }

  async function postHero(body: string, fallback: string): Promise<HeroResponse> {
    const res = await fetch('/api/images/hero', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    // A 422 `content_policy` is a refusal, surfaced as the error text —
    // never a silent stock scene. The prompt stays in the field to edit.
    return readJsonResponse<HeroResponse>(res, fallback)
  }

  function applyFinal(json: HeroResponse) {
    if (json.imageUrl) onChange(json.imageUrl)
    const j = json.qa?.judgement
    if (j && j.verdict !== 'pass') setQaNote({ verdict: j.verdict, reasons: j.reasons, attempts: json.attempts ?? 1 })
  }

  async function handleGenerate() {
    if (!title && !productName) { setError('Need a title first to generate an image.'); return }
    setGenerating(true)
    setError(null)
    setQaNote(null)
    try {
      const json = await postHero(heroBody('single', imagePrompt), 'Image generation failed')
      applyFinal(json)
      // Populate the prompt field with the auto-generated prompt so the user can
      // inspect and tweak it before regenerating. Only overwrite if they hadn't
      // typed a custom prompt themselves (i.e. the field was empty when they hit Generate).
      if (json.promptUsed && !imagePrompt.trim()) setImagePrompt(json.promptUsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    }
    setGenerating(false)
  }

  // Three cheap drafts of the current prompt, to pick a composition from.
  async function requestSheet(previous: HeroSheet | null) {
    if (!title && !productName) { setError('Need a title first to generate an image.'); return }
    if (previous) setSheet({ ...previous, busy: 'rerolling' })
    else setGenerating(true)
    setError(null)
    setQaNote(null)
    try {
      const json = await postHero(heroBody('sheet', imagePrompt), 'Contact sheet failed')
      const drafts = json.sheet?.drafts ?? []
      if (drafts.length === 0) throw new Error('No drafts came back — try again.')
      if (previous) discardDrafts(previous.drafts.map((d) => d.filename))
      const prompt = json.promptUsed ?? imagePrompt
      if (json.promptUsed && !imagePrompt.trim()) setImagePrompt(json.promptUsed)
      setSheet({ drafts, picked: null, busy: null, prompt })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Contact sheet failed')
      if (previous) setSheet({ ...previous, busy: null })
    }
    if (!previous) setGenerating(false)
  }

  // Render the pick at the Publication tier from its composition; the unpicked
  // drafts are deleted server-side on success.
  async function handleFinalize() {
    if (!sheet?.picked) return
    const picked = sheet.picked
    setSheet({ ...sheet, busy: 'finalizing' })
    setError(null)
    setQaNote(null)
    try {
      const json = await postHero(
        heroBody('finalize', sheet.prompt, {
          premium: true,
          draft_filename: picked,
          discard_filenames: sheet.drafts.map((d) => d.filename).filter((f) => f !== picked),
        }),
        'Finalize failed',
      )
      applyFinal(json)
      setSheet(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalize failed')
      // Keep the sheet so he can pick another draft or try again.
      setSheet((cur) => (cur ? { ...cur, busy: null } : cur))
    }
  }

  // Best effort, fire-and-forget: the drafts are scratch files in the bucket.
  function discardDrafts(filenames: string[]) {
    if (filenames.length === 0) return
    void fetch('/api/images/hero', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: heroBody('discard', '', { discard_filenames: filenames }),
    }).catch(() => { /* scratch files; nothing to recover */ })
  }

  function handleDiscardSheet() {
    if (!sheet) return
    discardDrafts(sheet.drafts.map((d) => d.filename))
    setSheet(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm text-prose-muted font-medium">{label}</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className={buttonVariants({ size: 'sm' })}
          >
            {uploading ? 'Uploading…' : '📷 Take Photo'}
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            📁 Library
          </button>
        </div>
      </div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />

      {imageUrl ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Hero" className="w-full h-56 object-cover rounded-xl border border-strong" />
          <button
            type="button"
            onClick={handleCropExisting}
            disabled={uploading}
            className="absolute top-2 left-2 px-2.5 py-1.5 bg-surface/80 hover:bg-surface text-prose-muted hover:text-prose text-xs font-semibold rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
            title="Crop this image"
          >
            Crop
          </button>
          <button
            type="button"
            onClick={() => downloadImage(imageUrl, title ?? productName)}
            className="absolute bottom-2 left-2 px-2.5 py-1.5 bg-surface/80 hover:bg-surface text-prose-muted hover:text-prose text-xs font-semibold rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Download this image"
          >
            Download
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 p-1.5 bg-surface/80 hover:bg-red-50 text-prose-muted hover:text-red-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Remove image"
          >
            <XIcon className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-strong rounded-xl p-6 text-center">
          <svg className="w-8 h-8 text-prose-faint mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className="text-sm text-prose-faint">No image yet — generate below or pick from library</p>
        </div>
      )}

      {/* Inline generate. The textarea takes the full width (Prompt help writes
          400-700 character paragraphs) and the two paid actions sit under it:
          one straight render, or a contact sheet to pick a composition first. */}
      <div className="space-y-2">
        <textarea
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          rows={3}
          placeholder="Describe the scene, or use Prompt help below"
          className="w-full px-3 py-2 bg-surface border border-strong rounded-lg text-base sm:text-xs text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover resize-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || sheet !== null || (!title && !productName)}
            className={buttonVariants({ className: 'grow' })}
          >
            {generating && !sheet ? 'Generating…' : imageUrl ? 'Regenerate' : 'Generate'}
          </button>
          <button
            type="button"
            onClick={() => requestSheet(null)}
            disabled={generating || sheet !== null || (!title && !productName)}
            className={buttonVariants({ variant: 'outline' })}
            title="Three cheap drafts to pick a composition from, then finalize at Publication"
          >
            Contact sheet
          </button>
        </div>
      </div>

      {sheet && (
        <ContactSheetPicker
          drafts={sheet.drafts}
          aspect="16:10"
          picked={sheet.picked}
          onPick={(filename) => setSheet((cur) => (cur ? { ...cur, picked: filename } : cur))}
          onFinalize={handleFinalize}
          onReroll={() => requestSheet(sheet)}
          onDiscard={handleDiscardSheet}
          busy={sheet.busy}
          disabled={generating || uploading}
          finalLabel={IMAGE_TIERS.publication.label}
        />
      )}

      {/* Rewrite / 3 ideas / suggest / describe the current photo — a cheap
          text call, so a prompt no longer has to wait for a paid generation. */}
      <PromptAssist
        value={imagePrompt}
        onUse={(p) => setImagePrompt(p.prompt)}
        target="hero"
        people={people}
        allowText={false}
        context={{ title: title?.trim() || productName, category, excerpt }}
        source={sourceId ? { type: contentType, id: sourceId } : undefined}
        imageUrl={imageUrl ?? undefined}
        disabled={generating || uploading}
      />

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
          <span className="text-prose-faint">People</span>
          <Segmented value={people} options={PEOPLE_OPTIONS} onChange={setPeople} label="People in the generated hero" />
        </div>
        <div className="flex items-center gap-1">
          <label htmlFor="hero-moderation" className="text-prose-muted cursor-pointer">Relaxed moderation</label>
          <Switch id="hero-moderation" checked={moderation === 'low'} onChange={(on) => setModeration(on ? 'low' : 'auto')} />
        </div>
      </div>
      <p className="text-[11px] text-prose-faint">
        AI heroes are a scene from the category, never the product — shoot the product with 📷 Take Photo. House style, no text, no brands and no identifiable children are always on; stored at 16:10. Relaxed moderation loosens only the model&apos;s own filter for benign dad-life scenes; brands, faces and text rules are unchanged.
      </p>

      {qaNote && (
        <p
          role="status"
          className={`text-xs rounded-lg border px-3 py-2 leading-snug ${
            qaNote.verdict === 'fail' ? 'bg-danger-bg text-danger-ink border-danger-line' : 'bg-warn-bg text-warn-ink border-warn-line'
          }`}
        >
          {qaNote.verdict === 'fail' ? 'Check this image' : 'Heads up'}: {qaNote.reasons.join('; ')}.
          {qaNote.attempts > 1 ? ' Regenerated once automatically; this is the second try — edit the prompt or regenerate again.' : ''}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {showPicker && (
        <MediaPicker
          onSelect={(url) => { onChange(url); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
          defaultCategory={category}
          uploadAspect={16 / 10}
        />
      )}

      {pendingCrop && (
        <ImageCropper
          file={pendingCrop}
          aspect={16 / 10}
          onCrop={handleCropConfirm}
          onCancel={() => setPendingCrop(null)}
        />
      )}
    </div>
  )
}
