'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { detectAffiliateLinks } from '@/lib/affiliate'

interface ReviewFormProps {
  initialData?: {
    id: string
    title: string
    product_name: string
    content: string
    rating: number
    has_affiliate_links: boolean
    disclosure_acknowledged: boolean
  }
}

export default function ReviewForm({ initialData }: ReviewFormProps) {
  const router = useRouter()
  const isEditing = !!initialData

  const [title, setTitle] = useState(initialData?.title ?? '')
  const [productName, setProductName] = useState(initialData?.product_name ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [rating, setRating] = useState(initialData?.rating ?? 5)
  const [disclosureAcknowledged, setDisclosureAcknowledged] = useState(
    initialData?.disclosure_acknowledged ?? false
  )

  const [hasAffiliateLinks, setHasAffiliateLinks] = useState(
    initialData?.has_affiliate_links ?? false
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Draft generation state
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftFeatures, setDraftFeatures] = useState('')

  // Detect affiliate links as user types
  useEffect(() => {
    setHasAffiliateLinks(detectAffiliateLinks(content))
  }, [content])

  async function generateDraft() {
    if (!productName) { setError('Enter a product name first'); return }
    setDraftLoading(true)
    setError(null)

    const res = await fetch('/api/claude/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName,
        category: 'product',
        keyFeatures: draftFeatures.split(',').map((f) => f.trim()).filter(Boolean),
      }),
    })

    const json = await res.json()
    if (!res.ok) { setError(json.error); setDraftLoading(false); return }

    const { draft } = json
    setTitle(draft.title ?? '')
    setContent(
      [
        draft.introduction,
        ...(draft.sections ?? []).map(
          (s: { heading: string; body: string }) => `<h2>${s.heading}</h2>${s.body}`
        ),
        draft.verdict,
      ].join('\n\n')
    )
    if (draft.rating) setRating(Math.round(draft.rating))
    setDraftLoading(false)
  }

  async function save(submit = false) {
    setSaving(true)
    setError(null)

    const payload = {
      title,
      product_name: productName,
      content,
      rating,
      disclosure_acknowledged: disclosureAcknowledged,
    }

    let res: Response

    if (isEditing) {
      res = await fetch(`/api/reviews/${initialData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }

    const reviewId = isEditing ? initialData.id : json.review.id

    if (submit) {
      setSubmitting(true)
      const subRes = await fetch(`/api/reviews/${reviewId}/submit`, { method: 'POST' })
      const subJson = await subRes.json()
      if (!subRes.ok) { setError(subJson.error); setSaving(false); setSubmitting(false); return }
    }

    router.push('/dashboard/reviews')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Draft generator */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-sm font-semibold text-orange-400 mb-3">AI Draft Generator</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={draftFeatures}
            onChange={(e) => setDraftFeatures(e.target.value)}
            placeholder="Key features, comma separated (e.g. cordless, 2-hour battery)"
            className="flex-1 px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            type="button"
            onClick={generateDraft}
            disabled={draftLoading || !productName}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            {draftLoading ? 'Generating...' : 'Generate Draft'}
          </button>
        </div>
      </div>

      {/* Product name */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Product Name *</label>
        <input
          type="text"
          required
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="e.g. DeWalt 20V MAX Cordless Drill"
        />
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Review Title *</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="Compelling SEO-friendly title"
        />
        <p className="text-xs text-gray-600 mt-1">{title.length}/120 chars</p>
      </div>

      {/* Rating */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Rating *</label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {'★'.repeat(n)}{'☆'.repeat(5 - n)} ({n}/5)
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Review Content *</label>
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none font-mono text-sm"
          rows={18}
          placeholder="HTML content — paste draft output or write directly..."
        />
      </div>

      {/* Affiliate disclosure gate */}
      {hasAffiliateLinks && (
        <div className="bg-orange-950/40 border border-orange-800 rounded-xl p-5">
          <p className="text-orange-400 font-semibold text-sm mb-2">Affiliate links detected</p>
          <p className="text-gray-300 text-sm mb-4">
            This review contains affiliate links. You must acknowledge the FTC disclosure before submitting.
            The following disclosure will appear at the top of your published review:
          </p>
          <blockquote className="text-xs text-gray-400 bg-gray-900 rounded-lg px-4 py-3 mb-4 italic">
            This article contains affiliate links. We may earn a small commission at no extra cost to you.{' '}
            <a href="/affiliate-disclosure/" className="text-orange-400 underline">Learn more</a>
          </blockquote>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={disclosureAcknowledged}
              onChange={(e) => setDisclosureAcknowledged(e.target.checked)}
              className="mt-0.5 accent-orange-500"
            />
            <span className="text-sm text-gray-300">
              I confirm this review contains affiliate links and I acknowledge the FTC disclosure requirement.
            </span>
          </label>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Actions */}
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
          disabled={saving || submitting || (hasAffiliateLinks && !disclosureAcknowledged)}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </div>
  )
}
