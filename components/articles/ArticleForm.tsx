'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'

interface ArticleFormProps {
  initialData?: {
    id: string
    title: string
    category: string
    content: string
    excerpt: string
    image_url: string | null
  }
}

export default function ArticleForm({ initialData }: ArticleFormProps) {
  const router = useRouter()
  const isEditing = !!initialData
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(initialData?.title ?? '')
  const [category, setCategory] = useState(initialData?.category ?? 'other')
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.image_url ?? null)
  const [imageUploading, setImageUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // AI draft generation
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftTopic, setDraftTopic] = useState('')
  const [draftKeyPoints, setDraftKeyPoints] = useState('')

  async function generateDraft() {
    if (!draftTopic) { setError('Enter a topic first'); return }
    setDraftLoading(true)
    setError(null)

    const res = await fetch('/api/claude/article-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: draftTopic,
        category,
        keyPoints: draftKeyPoints.split(',').map(p => p.trim()).filter(Boolean),
      }),
    })

    const json = await res.json()
    if (!res.ok) { setError(json.error); setDraftLoading(false); return }

    const { draft } = json
    if (draft.title) setTitle(draft.title)
    if (draft.excerpt) setExcerpt(draft.excerpt)
    setContent(
      [
        draft.introduction,
        ...(draft.sections ?? []).map(
          (s: { heading: string; body: string }) => `<h2>${s.heading}</h2>\n<p>${s.body}</p>`
        ),
        draft.conclusion ? `<h2>Wrapping Up</h2>\n<p>${draft.conclusion}</p>` : '',
      ].filter(Boolean).join('\n\n')
    )
    setDraftLoading(false)
  }

  async function handleImageUpload(file: File) {
    if (!isEditing) {
      setError('Save the article as a draft first, then upload an image.')
      return
    }
    setImageUploading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/articles/${initialData!.id}/image`, {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setImageUploading(false); return }
    setImageUrl(json.image_url)
    setImageUploading(false)
  }

  async function save(submit = false) {
    setSaving(true)
    setError(null)

    const payload = { title, category, excerpt, content }

    let res: Response
    if (isEditing) {
      res = await fetch(`/api/articles/${initialData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }

    const articleId = isEditing ? initialData.id : json.article.id

    if (submit) {
      setSubmitting(true)
      const subRes = await fetch(`/api/articles/${articleId}/submit`, { method: 'POST' })
      const subJson = await subRes.json()
      if (!subRes.ok) { setError(subJson.error); setSaving(false); setSubmitting(false); return }
    }

    if (!isEditing && !submit) {
      // Redirect to edit page so image upload becomes available
      router.push(`/dashboard/articles/${articleId}/edit`)
    } else {
      router.push('/dashboard/articles')
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">

      {/* ── AI Draft Generator ──────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-5">
        <p className="text-sm font-semibold text-orange-400 mb-1">AI Draft Generator</p>
        <p className="text-xs text-gray-500 mb-3">Enter your topic and key points, then generate a full article draft</p>
        <div className="space-y-3">
          <input
            type="text"
            value={draftTopic}
            onChange={(e) => setDraftTopic(e.target.value)}
            placeholder="Article topic (e.g. How to set up the perfect backyard BBQ)"
            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <div className="flex gap-3">
            <input
              type="text"
              value={draftKeyPoints}
              onChange={(e) => setDraftKeyPoints(e.target.value)}
              placeholder="Key points, comma separated (e.g. equipment setup, temperature control, timing)"
              className="flex-1 px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              onClick={generateDraft}
              disabled={draftLoading || !draftTopic}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {draftLoading ? 'Generating...' : 'Generate Draft'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Row: Title + Category ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm text-gray-300 mb-1.5">Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="e.g. The Dad's Complete Guide to Smoking Ribs"
          />
          <p className="text-xs text-gray-600 mt-1">{title.length}/120 chars</p>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>
            ))}
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* ── Excerpt ─────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Excerpt <span className="text-gray-600">(shown on cards)</span></label>
        <input
          type="text"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="One-sentence hook for the article card"
          maxLength={200}
        />
        <p className="text-xs text-gray-600 mt-1">{excerpt.length}/200 chars</p>
      </div>

      {/* ── Hero Image ──────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">
          Hero Image
          {!isEditing && <span className="text-gray-600 ml-1">(save draft first to enable upload)</span>}
        </label>

        {imageUrl ? (
          <div className="relative">
            <img src={imageUrl} alt="Hero" className="w-full h-48 object-cover rounded-xl border border-gray-700" />
            <button
              type="button"
              onClick={() => { setImageUrl(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
              className="absolute top-2 right-2 p-1.5 bg-gray-900/80 hover:bg-red-900/80 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div
            onClick={() => isEditing && fileInputRef.current?.click()}
            className={`border-2 border-dashed border-gray-700 rounded-xl p-8 text-center transition-colors ${
              isEditing ? 'hover:border-orange-600 cursor-pointer' : 'opacity-40 cursor-not-allowed'
            }`}
          >
            {imageUploading ? (
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin" />
                <span className="text-sm">Uploading...</span>
              </div>
            ) : (
              <>
                <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500">Click to upload image</p>
                <p className="text-xs text-gray-700 mt-1">JPEG, PNG, WebP — max 5MB</p>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImageUpload(file)
          }}
        />
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Content * <span className="text-gray-600">(HTML)</span></label>
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none font-mono text-sm"
          rows={22}
          placeholder="<p>Write your article here using HTML...</p>&#10;<h2>Section Heading</h2>&#10;<p>Section content...</p>"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving || submitting}
          className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving && !submitting ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving || submitting}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>

    </div>
  )
}
