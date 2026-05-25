'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { compressImage } from '@/lib/compress-image'

const MediaPicker = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })

/**
 * One pending image — either a fresh File the user picked from disk, or a
 * reference to an existing asset in the library that should be re-tagged to
 * the new product on save.
 */
export type PendingImage =
  | {
      kind:        'upload'
      file:        File
      previewUrl:  string   // URL.createObjectURL — must be revoked on remove/unmount
      isPrimary:   boolean
    }
  | {
      kind:        'library'
      assetId:     string
      url:         string
      isPrimary:   boolean
    }

interface Props {
  images:          PendingImage[]
  onChange:        (images: PendingImage[]) => void
  /** Category slug from the parent form — pre-seeds MediaPicker filter + tags new uploads. */
  category?:       string
  /** Disables interactive controls while the parent form is busy saving. */
  disabled?:       boolean
}

/**
 * New-product image staging area. Holds files / library refs client-side
 * because media_assets.product_id is a UUID FK — we can't write rows until
 * the parent form has created the product. The parent calls
 * `flushPendingImages` after the product POST succeeds.
 *
 * Mirrors ProductImageGallery's visual rhythm so users see the same shape
 * before and after first save; the only difference is "pending" rows have
 * no label/alt-text editing (that's edit-mode territory).
 */
export function PendingImageGallery({ images, onChange, category, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // Revoke object URLs when the component unmounts to free memory. We can't
  // safely revoke on remove (the parent might still be reading the URL in
  // its own render), so we lean on the browser to GC during unmount.
  useEffect(() => {
    return () => {
      for (const img of images) {
        if (img.kind === 'upload') URL.revokeObjectURL(img.previewUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setProcessing(true); setError(null)

    // Note: we DON'T compress here — that happens at flush time, right
    // before upload. Pre-compression in state would mean re-compressing if
    // the user removes-and-re-adds. Keep raw Files in state.
    const additions: PendingImage[] = files.map((file) => ({
      kind:       'upload',
      file,
      previewUrl: URL.createObjectURL(file),
      isPrimary:  false,
    }))

    const next = [...images, ...additions]
    // Ensure exactly one primary — if the gallery was empty, mark the first
    // of the new batch primary.
    if (!next.some((i) => i.isPrimary) && next.length > 0) {
      next[0] = { ...next[0], isPrimary: true }
    }
    onChange(next)
    setProcessing(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleLibraryPicks(items: { url: string; altText: string; assetId?: string }[]) {
    setShowPicker(false)
    setError(null)
    const additions: PendingImage[] = items
      .filter((it): it is { url: string; altText: string; assetId: string } => Boolean(it.assetId))
      .map((it) => ({
        kind:      'library',
        assetId:   it.assetId,
        url:       it.url,
        isPrimary: false,
      }))
    if (additions.length === 0) {
      setError('Could not identify any selected library assets.')
      return
    }
    const next = [...images, ...additions]
    if (!next.some((i) => i.isPrimary) && next.length > 0) {
      next[0] = { ...next[0], isPrimary: true }
    }
    onChange(next)
  }

  function handleRemove(idx: number) {
    const removed = images[idx]
    if (removed.kind === 'upload') URL.revokeObjectURL(removed.previewUrl)
    const next = images.filter((_, i) => i !== idx)
    // If we removed the primary, promote the first remaining to primary.
    if (removed.isPrimary && next.length > 0 && !next.some((i) => i.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true }
    }
    onChange(next)
  }

  function handleSetPrimary(idx: number) {
    onChange(images.map((img, i) => ({ ...img, isPrimary: i === idx })))
  }

  function handleMove(idx: number, direction: -1 | 1) {
    const target = idx + direction
    if (target < 0 || target >= images.length) return
    const next = images.slice()
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-prose">Product Images</p>
          <p className="text-xs text-prose-faint mt-0.5">
            Add as many as you want — all attached to this product when you click Save.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={disabled || processing}
            className="text-xs px-3 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-40 text-prose-muted font-semibold rounded-lg transition-colors"
          >
            Pick from library
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || processing}
            className="text-xs px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
          >
            + Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFilesPicked}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2">{error}</p>
      )}

      {images.length === 0 ? (
        <div
          className="border-2 border-dashed border-soft rounded-xl py-10 text-center text-xs text-prose-faint cursor-pointer hover:border-strong transition-colors"
          onClick={() => !disabled && fileRef.current?.click()}
        >
          <svg className="w-7 h-7 mx-auto mb-2 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          No images staged yet — click here, drop files in, or pick from library.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((img, idx) => {
            const previewSrc = img.kind === 'upload' ? img.previewUrl : img.url
            return (
              <div
                key={img.kind === 'upload' ? `u-${idx}-${img.file.name}` : `l-${img.assetId}`}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                  img.isPrimary ? 'border-accent ring-2 ring-accent-hover/30' : 'border-soft'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewSrc} alt={`Pending ${idx + 1}`} className="w-full h-full object-cover" />

                {/* Source badge */}
                <span
                  className={`absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full leading-none ${
                    img.kind === 'upload' ? 'bg-accent/90 text-white' : 'bg-surface/90 text-prose-muted'
                  }`}
                >
                  {img.kind === 'upload' ? 'New' : 'Library'}
                </span>

                {/* Primary indicator */}
                {img.isPrimary && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full leading-none bg-accent-hover text-white">
                    Primary
                  </span>
                )}

                {/* Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-zinc-900/60 to-transparent flex items-center justify-between gap-1">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMove(idx, -1)}
                      disabled={disabled || idx === 0}
                      className="w-6 h-6 flex items-center justify-center text-xs text-prose-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move left"
                    >←</button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, +1)}
                      disabled={disabled || idx === images.length - 1}
                      className="w-6 h-6 flex items-center justify-center text-xs text-prose-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move right"
                    >→</button>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {!img.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(idx)}
                        disabled={disabled}
                        className="text-[10px] px-1.5 py-1 text-accent-text-soft hover:text-accent disabled:opacity-40 font-semibold uppercase tracking-wide transition-colors"
                        title="Set as primary product image"
                      >
                        Star
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      disabled={disabled}
                      className="w-6 h-6 flex items-center justify-center text-prose-muted hover:text-red-700 disabled:opacity-40 transition-colors"
                      title="Remove from staging"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-prose-faint">
          {images.length} image{images.length === 1 ? '' : 's'} staged. The one marked Primary becomes the product&apos;s hero — change with the Star button.
          {category && <> All new uploads will be tagged <code className="text-accent-text-soft/80">{category}</code>.</>}
        </p>
      )}

      {showPicker && (
        <MediaPicker
          multi
          onSelect={() => {}}
          onMultiSelect={handleLibraryPicks}
          onClose={() => setShowPicker(false)}
          defaultCategory={category}
        />
      )}
    </div>
  )
}

/**
 * Flush a list of pending images against a newly-created product. Uploads
 * fresh Files via POST /api/media (multipart), and re-tags library picks via
 * PATCH /api/media/{id}. Runs in parallel via Promise.allSettled — one bad
 * file doesn't sink the rest, and the parent gets a clean count for UX.
 */
export async function flushPendingImages(
  images:     PendingImage[],
  productId:  string,
  category:   string | null,
): Promise<{ uploaded: number; failed: number; firstError?: string; primaryUrl: string | null }> {
  if (images.length === 0) {
    return { uploaded: 0, failed: 0, primaryUrl: null }
  }

  const results = await Promise.allSettled(
    images.map(async (img) => {
      if (img.kind === 'upload') {
        const compressed = await compressImage(img.file)
        const fd = new FormData()
        fd.append('file',       compressed)
        fd.append('product_id', productId)
        if (category) fd.append('category', category)
        if (img.isPrimary) fd.append('is_primary', 'true')
        const res = await fetch('/api/media', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Upload failed')
        return { url: json.asset.url as string, isPrimary: img.isPrimary }
      }
      // library: re-tag the existing asset
      const res = await fetch(`/api/media/${img.assetId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ product_id: productId, is_primary: img.isPrimary }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Could not attach library image')
      return { url: img.url, isPrimary: img.isPrimary }
    }),
  )

  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<{ url: string; isPrimary: boolean }> => r.status === 'fulfilled',
  )
  const rejected  = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

  const primaryUrl = fulfilled.find((r) => r.value.isPrimary)?.value.url ?? null

  return {
    uploaded:   fulfilled.length,
    failed:     rejected.length,
    firstError: rejected[0]?.reason instanceof Error ? rejected[0].reason.message : undefined,
    primaryUrl,
  }
}
