'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface MediaAsset {
  id: string
  url: string
  filename: string
  alt_text: string | null
  file_size: number | null
}

interface MediaPickerProps {
  onSelect: (url: string, altText: string) => void
  onClose: () => void
}

export default function MediaPicker({ onSelect, onClose }: MediaPickerProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
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

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      // Auto-select the first newly uploaded image
      setSelected(succeeded[0].url)
    }
    if (failed.length) {
      const reason = (failed[0] as PromiseRejectedResult).reason
      setUploadError(`Upload failed: ${reason?.message ?? 'Unknown error'}`)
    }
    setUploading(false)
  }

  function handleConfirm() {
    if (!selected) return
    const asset = assets.find((a) => a.url === selected)
    onSelect(selected, asset?.alt_text ?? '')
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-base font-black">Media Library</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {uploading ? (
                <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              Upload new
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
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
          <p className="text-red-400 text-xs bg-red-950/50 border-b border-red-900/40 px-5 py-2.5 shrink-0">
            {uploadError}
          </p>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-gray-500 py-16">
              <div className="w-4 h-4 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
              Loading…
            </div>
          ) : assets.length === 0 ? (
            <div
              className="border-2 border-dashed border-gray-700 rounded-xl py-16 flex flex-col items-center gap-2 text-gray-600 cursor-pointer hover:border-gray-600 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">No images yet — click to upload</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelected(asset.url === selected ? null : asset.url)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    selected === asset.url
                      ? 'border-orange-500 ring-2 ring-orange-500/30'
                      : 'border-transparent hover:border-gray-600'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.alt_text ?? asset.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {selected === asset.url && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-2 border-t border-gray-800 shrink-0">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-xs text-white rounded-lg transition-colors"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-xs text-white rounded-lg transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 shrink-0">
          <p className="text-xs text-gray-600">
            {selected ? '1 image selected' : 'Click an image to select it'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selected}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Use this image
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
