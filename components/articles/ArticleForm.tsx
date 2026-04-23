'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'
import dynamic from 'next/dynamic'

const MediaPicker = dynamic(() => import('@/components/media/MediaPicker'), { ssr: false })

interface ArticleFormProps {
  initialData?: {
    id: string
    title: string
    category: string
    content: string
    excerpt: string
    image_url: string | null
    rejection_reason?: string | null
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
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // AI draft generation
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftStep, setDraftStep] = useState<'content' | 'images' | null>(null)
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draftTopic, setDraftTopic] = useState('')
  const [draftKeyPoints, setDraftKeyPoints] = useState('')

  // Prompt helper
  const [suggestInput, setSuggestInput] = useState('')
  const [suggestLoading, setSuggestLoading] = useState(false)

  // AI refine
  const [refineLoading, setRefineLoading] = useState(false)
  const [refineInstruction, setRefineInstruction] = useState(initialData?.rejection_reason ?? '')

  // Hero image regeneration
  const [heroRegenLoading, setHeroRegenLoading] = useState(false)

  // Media library picker
  const [showMediaPicker, setShowMediaPicker] = useState(false)

  async function generateDraft() {
    if (!draftTopic) { setError('Enter a topic first'); return }
    setDraftLoading(true)
    setDraftStep('content')
    setError(null)
    setWarning(null)

    // Simulate progress: switch to "image" step after 20s (Claude takes ~15–25s)
    stepTimerRef.current = setTimeout(() => setDraftStep('images'), 20000)

    let res: Response
    try {
      res = await fetch('/api/claude/article-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: draftTopic,
          category,
          keyPoints: draftKeyPoints.split(',').map(p => p.trim()).filter(Boolean),
        }),
      })
    } catch {
      clearTimeout(stepTimerRef.current!)
      setError('Network error — check your connection and try again.')
      setDraftLoading(false)
      setDraftStep(null)
      return
    }

    clearTimeout(stepTimerRef.current!)
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Generation failed — please try again.'); setDraftLoading(false); setDraftStep(null); return }

    const { draft, images, warnings } = json
    if (warnings?.length) setWarning(warnings[0])
    if (draft.title) setTitle(draft.title)
    if (draft.excerpt) setExcerpt(draft.excerpt)
    if (images?.heroUrl) setImageUrl(images.heroUrl)
    const sectionUrls: string[] = images?.sectionUrls ?? []
    setContent(
      [
        draft.introduction,
        ...(draft.sections ?? []).map(
          (s: { heading: string; body: string }, i: number) => {
            const imgHtml = sectionUrls[i]
              ? `\n<figure><img src="${sectionUrls[i]}" alt="${s.heading}" /></figure>`
              : ''
            const bodyHtml = s.body.split(/\n\n+/).map((p: string) => `<p>${p.trim()}</p>`).join('\n')
            return `<h2>${s.heading}</h2>\n${bodyHtml}${imgHtml}`
          }
        ),
        draft.conclusion ? `<h2>Wrapping Up</h2>\n<p>${draft.conclusion}</p>` : '',
      ].filter(Boolean).join('\n\n')
    )
    setDraftLoading(false)
    setDraftStep(null)
  }

  async function suggestPrompt() {
    if (!suggestInput.trim()) return
    setSuggestLoading(true)
    setError(null)
    const res = await fetch('/api/claude/suggest-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: suggestInput, type: 'article' }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSuggestLoading(false); return }
    if (json.topic) setDraftTopic(json.topic)
    if (json.keyPoints?.length) setDraftKeyPoints(json.keyPoints.join(', '))
    setSuggestInput('')
    setSuggestLoading(false)
  }

  async function refineContent() {
    if (!refineInstruction.trim()) { setError('Enter refinement instructions first'); return }
    if (!content) { setError('Generate or write content before refining'); return }
    setRefineLoading(true)
    setError(null)

    const res = await fetch('/api/claude/article-refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, content, instruction: refineInstruction }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setRefineLoading(false); return }

    const { draft } = json
    if (draft.title) setTitle(draft.title)
    if (draft.excerpt) setExcerpt(draft.excerpt)
    const sectionUrls = [...content.matchAll(/<figure><img src="([^"]+)"/g)].map(m => m[1])
    let urlIndex = 0
    setContent(
      [
        draft.introduction,
        ...(draft.sections ?? []).map(
          (s: { heading: string; body: string }, i: number) => {
            const existingUrl = sectionUrls[urlIndex]
            const imgHtml = existingUrl
              ? `\n<figure><img src="${existingUrl}" alt="${s.heading}" /></figure>`
              : ''
            if (existingUrl) urlIndex++
            return `<h2>${s.heading}</h2>\n<p>${s.body}</p>${imgHtml}`
          }
        ),
        draft.conclusion ? `<h2>Wrapping Up</h2>\n<p>${draft.conclusion}</p>` : '',
      ].filter(Boolean).join('\n\n')
    )
    setRefineLoading(false)
  }

  async function regenerateHero() {
    setHeroRegenLoading(true)
    setError(null)
    const res = await fetch('/api/images/hero', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, excerpt, content_type: 'article' }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setHeroRegenLoading(false); return }
    setImageUrl(json.imageUrl)
    setHeroRegenLoading(false)
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

    const payload = { title, category, excerpt, content, image_url: imageUrl }

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

        {/* Prompt Helper */}
        <div className="mb-3 pb-3 border-b border-gray-800">
          <p className="text-xs text-gray-600 mb-2">Have a rough idea? Describe it and Claude will suggest the topic + key points for you.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={suggestInput}
              onChange={(e) => setSuggestInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && suggestPrompt()}
              placeholder="e.g. backyard BBQ tips for beginners, summer grilling"
              className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
            <button
              type="button"
              onClick={suggestPrompt}
              disabled={suggestLoading || !suggestInput.trim()}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-xs font-medium rounded-lg transition-colors sm:whitespace-nowrap"
            >
              {suggestLoading ? 'Suggesting...' : '✦ Suggest prompt'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={draftTopic}
            onChange={(e) => setDraftTopic(e.target.value)}
            placeholder="Article topic (e.g. How to set up the perfect backyard BBQ)"
            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <div className="flex flex-col sm:flex-row gap-3">
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
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors sm:whitespace-nowrap"
            >
              {draftStep === 'content' ? '✍️ Writing content...' : draftStep === 'images' ? '🖼️ Generating image...' : 'Generate Draft'}
            </button>
          </div>
        </div>
      </div>

      {/* ── AI Refine ───────────────────────────────────────────────────── */}
      {content && (
        <div className="bg-gray-900 border border-yellow-900/40 rounded-xl p-5">
          <p className="text-sm font-semibold text-yellow-400 mb-1">AI Refine</p>
          <p className="text-xs text-gray-500 mb-3">Describe what to change — Claude edits only what you specify and preserves the rest</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              placeholder="e.g. Make the intro more punchy, shorten section 2, add more practical tips"
              className="flex-1 px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <button
              type="button"
              onClick={refineContent}
              disabled={refineLoading || !refineInstruction.trim()}
              className="px-4 py-2.5 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors sm:whitespace-nowrap"
            >
              {refineLoading ? 'Refining...' : 'Apply Edits'}
            </button>
          </div>
        </div>
      )}

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
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm text-gray-300">
            Hero Image
            {!isEditing && <span className="text-gray-600 ml-1">(save draft first to enable direct upload)</span>}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMediaPicker(true)}
              className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              📁 Library
            </button>
            {title && (
              <button
                type="button"
                onClick={regenerateHero}
                disabled={heroRegenLoading}
                className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                {heroRegenLoading ? 'Generating...' : '↺ Regenerate'}
              </button>
            )}
          </div>
        </div>

        {imageUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
          <div className="space-y-2">
            <div
              onClick={() => isEditing && fileInputRef.current?.click()}
              className={`border-2 border-dashed border-gray-700 rounded-xl p-6 text-center transition-colors ${
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="text-sm text-gray-500">{isEditing ? 'Click to upload a file' : 'Save draft first to enable file upload'}</p>
                  <p className="text-xs text-gray-700 mt-1">JPEG, PNG, WebP — max 5 MB</p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowMediaPicker(true)}
              className="w-full py-2 border border-gray-700 hover:border-gray-600 rounded-xl text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              📁 Pick from media library
            </button>
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

        {showMediaPicker && (
          <MediaPicker
            onSelect={(url) => { setImageUrl(url); setShowMediaPicker(false) }}
            onClose={() => setShowMediaPicker(false)}
          />
        )}
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

      {warning && !error && (
        <p className="text-yellow-300 text-sm bg-yellow-950/40 border border-yellow-800/50 rounded-lg px-4 py-3">
          {warning}
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
