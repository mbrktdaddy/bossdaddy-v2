'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
const MediaPicker   = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })
const ImageCropper  = dynamic(() => import('@/components/ui/ImageCropper'),   { ssr: false })

interface Props {
  imageUrl: string | null
  onChange: (url: string | null) => void
  label?: string
  contentType: 'guide' | 'review'
  title?: string
  category?: string
  excerpt?: string
  productName?: string
  initialPrompt?: string
}

export function HeroImagePanel({
  imageUrl, onChange, label = 'Hero Image',
  contentType, title, category, excerpt, productName, initialPrompt,
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
  const [premium, setPremium] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

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
    setPendingCrop(raw)
    e.target.value = ''
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingCrop(null)
    setUploading(true)
    setError(null)
    try {
      const file = new File([blob], 'hero.webp', { type: 'image/webp' })
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      const json = await readJsonResponse<{ asset?: { url?: string } }>(res, 'Upload failed')
      onChange(json.asset?.url ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setUploading(false)
  }

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
          premium,
        }),
      })
      const json = await readJsonResponse<{ imageUrl?: string; promptUsed?: string }>(res, 'Image generation failed')
      if (json.imageUrl) onChange(json.imageUrl)
      // Populate the prompt field with the auto-generated prompt so the user can
      // inspect and tweak it before regenerating. Only overwrite if they hadn't
      // typed a custom prompt themselves (i.e. the field was empty when they hit Generate).
      if (json.promptUsed && !imagePrompt.trim()) setImagePrompt(json.promptUsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    }
    setGenerating(false)
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
            className="text-xs px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-colors min-h-[36px]"
          >
            {uploading ? 'Uploading…' : '📷 Take Photo'}
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-zinc-700 text-prose-muted hover:text-prose rounded-lg transition-colors min-h-[36px]"
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
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 p-1.5 bg-surface/80 hover:bg-red-50 text-prose-muted hover:text-red-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Remove image"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
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

      {/* Inline generate */}
      <div className="flex gap-2">
        <input
          type="text"
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          placeholder="Auto-filled after first generation — tweak and regenerate to refine the scene."
          className="flex-1 px-3 py-2 bg-surface border border-strong rounded-lg text-xs text-prose placeholder:text-prose-faint focus:outline-none focus:ring-1 focus:ring-accent-hover"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || (!title && !productName)}
          className="shrink-0 text-xs px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
        >
          {generating ? 'Generating…' : imageUrl ? '↺ Regenerate' : 'Generate'}
        </button>
      </div>

      <div className="flex items-center gap-1 text-[11px]">
        <span className="text-prose-faint mr-1">Model</span>
        <button
          type="button"
          onClick={() => setPremium(false)}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            !premium ? 'bg-accent text-white' : 'bg-surface border border-soft text-prose-muted hover:text-prose'
          }`}
        >
          Standard
        </button>
        <button
          type="button"
          onClick={() => setPremium(true)}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            premium ? 'bg-accent text-white' : 'bg-surface border border-soft text-prose-muted hover:text-prose'
          }`}
        >
          Premium
        </button>
        <span className="text-prose-faint ml-2">
          {premium ? 'gpt-image-1.5 · high quality' : 'gpt-image-1 · medium quality'}
        </span>
      </div>

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
        />
      )}

      {pendingCrop && (
        <ImageCropper
          file={pendingCrop}
          aspect={16 / 9}
          onCrop={handleCropConfirm}
          onCancel={() => setPendingCrop(null)}
        />
      )}
    </div>
  )
}
