'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { compressImage } from '@/lib/compress-image'

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
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
        title="Click or drop a JPG, PNG, or WebP"
        className="group relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-orange-700 to-orange-950 flex items-center justify-center text-4xl font-black text-white shrink-0 hover:ring-orange-700 transition-all disabled:opacity-50 disabled:cursor-wait"
        aria-label={avatarUrl ? 'Change avatar' : 'Upload avatar'}
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Avatar" fill sizes="96px" className="object-cover" unoptimized />
        ) : (
          <span>{initial}</span>
        )}
        <span className="absolute inset-0 bg-zinc-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold uppercase tracking-widest">
          {busy ? '...' : 'Change'}
        </span>
      </button>

      <div className="flex gap-2 sm:self-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="px-3 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-50 text-xs font-semibold text-prose rounded-lg transition-colors"
        >
          {busy ? 'Uploading…' : avatarUrl ? 'Replace' : 'Upload'}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="px-3 py-1.5 bg-transparent hover:bg-danger-bg border border-soft hover:border-danger-line disabled:opacity-50 text-xs font-semibold text-prose-muted hover:text-danger-ink rounded-lg transition-colors"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger-ink w-full text-center sm:text-left">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />
    </div>
  )
}
