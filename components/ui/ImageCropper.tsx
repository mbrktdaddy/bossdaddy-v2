'use client'

import { useState, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'

interface Props {
  file: File
  aspect: number
  onCrop: (blob: Blob) => void
  onCancel: () => void
}

async function cropToBlob(imageSrc: string, crop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, 1600 / crop.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(crop.width  * scale)
      canvas.height = Math.round(crop.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No canvas context')); return }
      ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
        'image/webp',
        0.82,
      )
    }
    image.onerror = () => reject(new Error('Image load failed'))
    image.src = imageSrc
  })
}

export default function ImageCropper({ file, aspect, onCrop, onCancel }: Props) {
  // Create the object URL once per file — useState initializer avoids the
  // setState-in-effect pattern; the separate cleanup effect revokes it.
  const [imageSrc] = useState(() => URL.createObjectURL(file))
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => () => URL.revokeObjectURL(imageSrc), [imageSrc])

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels || !imageSrc) return
    setBusy(true)
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels)
      onCrop(blob)
    } catch {
      setBusy(false)
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
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 px-4 py-4 bg-surface border-t border-strong shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm text-prose-muted hover:text-white rounded-lg border border-soft hover:border-gray-500 transition-colors"
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
