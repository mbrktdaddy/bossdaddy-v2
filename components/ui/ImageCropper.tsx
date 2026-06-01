'use client'

import { useState, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, MediaSize } from 'react-easy-crop'

interface Props {
  file: File
  /**
   * Locked crop ratio (width / height). When omitted the cropper runs in
   * free mode: it defaults to the image's natural ratio and (when
   * allowRatioChange is set) exposes a ratio selector.
   */
  aspect?: number
  onCrop: (blob: Blob) => void
  onCancel: () => void
  /**
   * When provided, a "Use full image" button is shown that skips cropping
   * entirely — the caller uploads the original (already-compressed) file.
   * Only wire this up for free-shape contexts.
   */
  onSkip?: () => void
  /** Show the Original / 1:1 / 4:3 / 16:9 ratio selector (free contexts). */
  allowRatioChange?: boolean
}

type RatioChoice = number | 'original'

const RATIOS: { label: string; value: RatioChoice }[] = [
  { label: 'Original', value: 'original' },
  { label: '1:1',      value: 1 },
  { label: '4:3',      value: 4 / 3 },
  { label: '16:9',     value: 16 / 9 },
]

async function cropToBlob(file: File, crop: Area): Promise<Blob> {
  // Decode straight from the file bytes — NOT a blob: URL. React StrictMode
  // double-invokes the cleanup effect in dev, revoking the object URL before a
  // fresh Image() can load it ("Image load failed"). createImageBitmap reads the
  // File directly, so it's immune. `from-image` keeps EXIF orientation matching
  // what react-easy-crop shows, so the crop region stays aligned.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, 1600 / crop.width)
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(crop.width  * scale)
    canvas.height = Math.round(crop.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas context')
    ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) { resolve(blob); return }
          // Some browsers (notably mobile) return null for WebP encoding —
          // fall back to PNG. The upload route + sharp normalize to WebP anyway.
          canvas.toBlob(
            (png) => png ? resolve(png) : reject(new Error('image encode returned empty')),
            'image/png',
          )
        },
        'image/webp',
        0.82,
      )
    })
  } finally {
    bitmap.close()
  }
}

export default function ImageCropper({ file, aspect, onCrop, onCancel, onSkip, allowRatioChange }: Props) {
  // Create the object URL once per file — useState initializer avoids the
  // setState-in-effect pattern; the separate cleanup effect revokes it.
  const [imageSrc] = useState(() => URL.createObjectURL(file))
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Natural ratio of the loaded image — used for the "Original" choice and as
  // the free-mode default before the user picks a ratio.
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null)
  const [ratioChoice, setRatioChoice] = useState<RatioChoice>('original')

  useEffect(() => () => URL.revokeObjectURL(imageSrc), [imageSrc])

  const onMediaLoaded = useCallback((mediaSize: MediaSize) => {
    setNaturalAspect(mediaSize.naturalWidth / mediaSize.naturalHeight)
  }, [])

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  // react-easy-crop requires a numeric aspect. Locked callers pass `aspect`;
  // free callers fall back to the chosen ratio (Original = natural).
  const effectiveAspect =
    aspect ??
    (ratioChoice === 'original' ? (naturalAspect ?? 1) : ratioChoice)

  async function handleConfirm() {
    if (busy) return
    // croppedAreaPixels is null until react-easy-crop fires onCropComplete (after
    // the image lays out). Clicking before that — or before any adjustment — must
    // tell the user, not no-op silently.
    if (!croppedAreaPixels || !imageSrc) {
      setError('Move or zoom the crop once to set the area, then try again.')
      return
    }
    setBusy(true); setError(null)
    try {
      const blob = await cropToBlob(file, croppedAreaPixels)
      onCrop(blob)
    } catch (err) {
      console.error('ImageCropper cropToBlob failed:', err)
      setBusy(false)
      setError(
        err instanceof Error
          ? `Couldn't crop this image (${err.message}). Try "Use full image" or pick another.`
          : 'Could not crop this image. Try again or pick another.',
      )
    }
  }

  if (!imageSrc) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Crop area */}
      <div className="relative flex-1 min-h-0">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={effectiveAspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          onMediaLoaded={onMediaLoaded}
        />
      </div>

      {/* Ratio selector — free contexts only */}
      {allowRatioChange && !aspect && (
        <div className="flex items-center gap-2 px-4 pt-3 bg-surface border-t border-strong shrink-0 overflow-x-auto scrollbar-hide">
          <span className="text-xs text-prose-faint shrink-0">Ratio</span>
          {RATIOS.map((r) => {
            const active = ratioChoice === r.value
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => setRatioChoice(r.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shrink-0 ${
                  active
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface-raised text-prose-muted border-soft hover:border-strong'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Error banner — crop/encode failures used to fail silently */}
      {error && (
        <div role="alert" className="px-4 py-2 bg-red-700 text-red-50 text-xs text-center shrink-0">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className={`flex items-center gap-4 px-4 py-4 bg-surface ${allowRatioChange && !aspect ? '' : 'border-t border-strong'} shrink-0`}>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm text-prose-muted hover:text-prose rounded-lg border border-soft hover:border-strong transition-colors"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xs text-prose-faint shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-orange-600"
          />
        </div>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2.5 text-sm text-prose-muted hover:text-prose rounded-lg border border-soft hover:border-strong transition-colors whitespace-nowrap"
          >
            Use full image
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="px-4 py-2.5 text-sm bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
        >
          {busy ? 'Cropping…' : 'Use Photo'}
        </button>
      </div>
    </div>
  )
}
