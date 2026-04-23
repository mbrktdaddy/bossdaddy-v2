'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface MediaAsset {
  id: string
  url: string
  filename: string
  alt_text: string | null
  uploaded_by: string | null
  file_size: number | null
  mime_type: string | null
  created_at: string
  profiles: { username: string } | null
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AssetCard({
  asset,
  onDelete,
  onAltSave,
  copiedId,
  onCopy,
}: {
  asset: MediaAsset
  onDelete: (id: string) => void
  onAltSave: (id: string, alt: string) => void
  copiedId: string | null
  onCopy: (id: string, url: string) => void
}) {
  const [editingAlt, setEditingAlt] = useState(false)
  const [altDraft, setAltDraft] = useState(asset.alt_text ?? '')
  const [deleting, setDeleting] = useState(false)
  const [savingAlt, setSavingAlt] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [generatingAlt, setGeneratingAlt] = useState(false)

  async function handleAIGenerate() {
    setGeneratingAlt(true)
    const res = await fetch('/api/claude/alt-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: asset.url }),
    })
    const json = await res.json()
    if (res.ok && json.alt) {
      setAltDraft(json.alt)
      setEditingAlt(true)
    }
    setGeneratingAlt(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const res = await fetch(`/api/media/${asset.id}`, { method: 'DELETE' })
    if (res.ok) {
      onDelete(asset.id)
    } else {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleAltSave() {
    setSavingAlt(true)
    const res = await fetch(`/api/media/${asset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt_text: altDraft }),
    })
    if (res.ok) {
      onAltSave(asset.id, altDraft)
      setEditingAlt(false)
    }
    setSavingAlt(false)
  }

  return (
    <div className="group relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-950 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt={asset.alt_text ?? asset.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Hover overlay — copy URL */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onCopy(asset.id, asset.url)}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {copiedId === asset.id ? '✓ Copied' : 'Copy URL'}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-xs text-gray-500 truncate" title={asset.filename}>{asset.filename}</p>

        {/* Alt text */}
        {editingAlt ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={altDraft}
              onChange={(e) => setAltDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAltSave(); if (e.key === 'Escape') setEditingAlt(false) }}
              placeholder="Alt text…"
              className="flex-1 min-w-0 px-2 py-1 bg-gray-950 border border-gray-700 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              onClick={handleAltSave}
              disabled={savingAlt}
              className="px-2 py-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
            >
              {savingAlt ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditingAlt(false)} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded transition-colors">
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditingAlt(true)}
              className="flex-1 text-left text-xs text-gray-500 hover:text-gray-300 transition-colors truncate"
              title="Click to edit alt text"
            >
              {asset.alt_text ? asset.alt_text : <span className="italic text-gray-600">Add alt text…</span>}
            </button>
            <button
              onClick={handleAIGenerate}
              disabled={generatingAlt}
              title="Generate alt text with AI"
              className="shrink-0 text-xs px-1.5 py-0.5 bg-blue-950/50 hover:bg-blue-900/60 text-blue-400 rounded transition-colors disabled:opacity-50"
            >
              {generatingAlt ? '…' : '✨ AI'}
            </button>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex flex-col gap-0.5">
            {asset.profiles?.username && (
              <span className="text-xs text-gray-600">@{asset.profiles.username}</span>
            )}
            {asset.file_size && (
              <span className="text-xs text-gray-700">{formatBytes(asset.file_size)}</span>
            )}
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              confirmDelete
                ? 'bg-red-900/60 text-red-400 hover:bg-red-800'
                : 'text-gray-600 hover:text-red-400'
            }`}
          >
            {deleting ? '…' : confirmDelete ? 'Confirm delete' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const LIMIT = 40

  const fetchAssets = useCallback(async (p: number) => {
    setLoading(true)
    const res = await fetch(`/api/media?page=${p}`)
    if (res.ok) {
      const json = await res.json()
      setAssets(json.assets)
      setTotal(json.total)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAssets(page) }, [fetchAssets, page])

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(true)
    setUploadError(null)

    const results = await Promise.allSettled(
      list.map(async (file) => {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/media', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Upload failed')
        return json.asset as MediaAsset
      })
    )

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<MediaAsset> => r.status === 'fulfilled')
      .map((r) => r.value)
    const failed = results.filter((r) => r.status === 'rejected')

    if (succeeded.length) {
      setAssets((prev) => [...succeeded, ...prev])
      setTotal((t) => t + succeeded.length)
    }
    if (failed.length) {
      const reason = (failed[0] as PromiseRejectedResult).reason
      setUploadError(`${failed.length} file(s) failed: ${reason?.message ?? 'Unknown error'}`)
    }
    setUploading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    uploadFiles(e.dataTransfer.files)
  }

  function handleCopy(id: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function handleDelete(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id))
    setTotal((t) => Math.max(0, t - 1))
  }

  function handleAltSave(id: string, alt: string) {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, alt_text: alt } : a))
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-4 sm:p-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">Media Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} asset{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {uploadError && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 mb-4">
          {uploadError}
        </p>
      )}

      {/* Drop zone (when no assets or as full-page target) */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`${dragOver ? 'ring-2 ring-orange-500 ring-inset' : ''} rounded-2xl transition-all`}
      >
        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 py-16 justify-center">
            <div className="w-5 h-5 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
            Loading…
          </div>
        ) : assets.length === 0 ? (
          <div
            className="border-2 border-dashed border-gray-700 rounded-2xl py-20 flex flex-col items-center gap-3 text-gray-600 cursor-pointer hover:border-gray-600 hover:text-gray-500 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">Drop images here or click to upload</p>
            <p className="text-xs">JPEG, PNG, WebP, GIF · max 8 MB each</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={handleDelete}
                onAltSave={handleAltSave}
                copiedId={copiedId}
                onCopy={handleCopy}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-sm text-white rounded-lg transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-sm text-white rounded-lg transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* Drag-over full page overlay */}
      {dragOver && (
        <div className="fixed inset-0 bg-black/50 border-4 border-dashed border-orange-500 pointer-events-none z-50 flex items-center justify-center">
          <p className="text-white text-xl font-black">Drop to upload</p>
        </div>
      )}
    </div>
  )
}
