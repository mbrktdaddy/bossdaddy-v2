'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compress-image'
import ImageCropper from '@/components/ui/ImageCropper'
import { buttonVariants } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  initialAvatarUrl: string | null
  initial:          string
}

export default function AvatarUploader({ initialAvatarUrl, initial }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // Square-crop the picked file before upload. Lets mobile users reframe a
  // tall phone photo instead of getting a blind center-crop into the circle.
  const [cropPending, setCropPending] = useState<File | null>(null)

  // Normalize before cropping: a raw multi-MP photo can exceed the browser's
  // canvas/texture limit and render blank in react-easy-crop. compressImage
  // resizes to ≤1600px + fixes EXIF orientation, matching MediaPicker's flow.
  async function pickForCrop(raw: File) {
    setError(null)
    setSaved(false)
    setBusy(true)
    const prepared = await compressImage(raw).catch(() => raw)
    setBusy(false)
    setCropPending(prepared)
  }

  function handleCropDone(blob: Blob) {
    const name = (cropPending?.name ?? 'avatar').replace(/\.[^.]+$/, '.webp')
    setCropPending(null)
    handleFile(new File([blob], name, { type: 'image/webp' }))
  }

  async function handleFile(raw: File) {
    setError(null)
    setBusy(true)
    try {
      const file = await compressImage(raw, { maxPx: 512, quality: 0.85 }).catch(() => raw)
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Upload failed'); return }
      setAvatarUrl(json.avatar_url)
      setSaved(true)
      router.refresh()
    } catch {
      setError('Upload failed — try again')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Failed to remove')
        return
      }
      setAvatarUrl(null)
      router.refresh()
    } catch {
      setError('Failed to remove — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center sm:items-start sm:flex-row gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pickForCrop(f) }}
        title="Click or drop a JPG, PNG, or WebP"
        className="group relative rounded-full shrink-0 disabled:opacity-50 disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={avatarUrl ? 'Change avatar' : 'Upload avatar'}
      >
        <Avatar src={avatarUrl} name={initial} size={96} alt="Avatar" />
        <span className="absolute inset-0 rounded-full bg-chrome/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold uppercase tracking-widest">
          {busy ? '...' : 'Change'}
        </span>
      </button>

      <div className="flex flex-wrap justify-center gap-2 sm:self-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={buttonVariants({ variant: 'outline' })}
        >
          {busy ? 'Uploading…' : avatarUrl ? 'Replace' : 'Upload'}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className={buttonVariants({ variant: 'danger' })}
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-sm font-medium text-danger-ink w-full text-center sm:text-left">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-success-ink font-semibold w-full text-center sm:text-left">Photo updated ✓</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickForCrop(f); e.target.value = '' }}
      />

      {cropPending && (
        <ImageCropper
          file={cropPending}
          aspect={1}
          onCrop={handleCropDone}
          onCancel={() => setCropPending(null)}
        />
      )}
    </div>
  )
}
