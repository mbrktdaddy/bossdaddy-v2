'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { detectAffiliateLinks } from '@/lib/affiliate'
import { CATEGORIES } from '@/lib/categories'

interface ReviewFormProps {
  initialData?: {
    id: string
    title: string
    product_name: string
    category: string
    content: string
    excerpt: string
    rating: number
    pros: string[]
    cons: string[]
    has_affiliate_links: boolean
    disclosure_acknowledged: boolean
  }
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  accent,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  accent: string
}) {
  function update(index: number, value: string) {
    const next = [...items]
    next[index] = value
    onChange(next)
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }
  function add() {
    onChange([...items, ''])
  }

  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1.5">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-3 py-2 text-gray-600 hover:text-red-400 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className={`text-xs font-medium ${accent} hover:opacity-80 transition-opacity`}
        >
          + Add item
        </button>
      </div>
    </div>
  )
}

export default function ReviewForm({ initialData }: ReviewFormProps) {
  const router = useRouter()
  const isEditing = !!initialData

  const [title, setTitle] = useState(initialData?.title ?? '')
  const [productName, setProductName] = useState(initialData?.product_name ?? '')
  const [category, setCategory] = useState(initialData?.category ?? 'other')
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [rating, setRating] = useState(initialData?.rating ?? 5)
  const [pros, setPros] = useState<string[]>(initialData?.pros ?? [])
  const [cons, setCons] = useState<string[]>(initialData?.cons ?? [])
  const [disclosureAcknowledged, setDisclosureAcknowledged] = useState(
    initialData?.disclosure_acknowledged ?? false
  )
  const [hasAffiliateLinks, setHasAffiliateLinks] = useState(
    initialData?.has_affiliate_links ?? false
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Draft generation
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftFeatures, setDraftFeatures] = useState('')

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
        category,
        keyFeatures: draftFeatures.split(',').map((f) => f.trim()).filter(Boolean),
      }),
    })

    const json = await res.json()
    if (!res.ok) { setError(json.error); setDraftLoading(false); return }

    const { draft } = json
    if (draft.title) setTitle(draft.title)
    if (draft.rating) setRating(Math.round(draft.rating))
    if (draft.pros?.length) setPros(draft.pros)
    if (draft.cons?.length) setCons(draft.cons)
    if (draft.excerpt) setExcerpt(draft.excerpt)
    setContent(
      [
        draft.introduction,
        ...(draft.sections ?? []).map(
          (s: { heading: string; body: string }) => `<h2>${s.heading}</h2>\n<p>${s.body}</p>`
        ),
        draft.verdict ? `<h2>The Verdict</h2>\n<p>${draft.verdict}</p>` : '',
      ].filter(Boolean).join('\n\n')
    )
    setDraftLoading(false)
  }

  async function save(submit = false) {
    setSaving(true)
    setError(null)

    const payload = {
      title,
      product_name: productName,
      category,
      excerpt,
      content,
      rating,
      pros: pros.filter(Boolean),
      cons: cons.filter(Boolean),
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

      {/* ── AI Draft Generator ──────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-5">
        <p className="text-sm font-semibold text-orange-400 mb-1">AI Draft Generator</p>
        <p className="text-xs text-gray-500 mb-3">Fill in product name + category first, then enter key features</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={draftFeatures}
            onChange={(e) => setDraftFeatures(e.target.value)}
            placeholder="Key features, comma separated (e.g. cordless, 2-hour battery, compact)"
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

      {/* ── Row: Product + Category ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.icon} {c.label}
              </option>
            ))}
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* ── Title ───────────────────────────────────────────────────────── */}
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

      {/* ── Excerpt ─────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Excerpt <span className="text-gray-600">(shown on cards)</span></label>
        <input
          type="text"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="One-sentence hook for the review card"
          maxLength={200}
        />
        <p className="text-xs text-gray-600 mt-1">{excerpt.length}/200 chars</p>
      </div>

      {/* ── Rating ──────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Rating *</label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)} ({n}/5)</option>
          ))}
        </select>
      </div>

      {/* ── Pros / Cons ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ListEditor
          label="The Good (Pros)"
          items={pros}
          onChange={setPros}
          placeholder="e.g. Long battery life"
          accent="text-green-400"
        />
        <ListEditor
          label="The Bad (Cons)"
          items={cons}
          onChange={setCons}
          placeholder="e.g. Heavy for extended use"
          accent="text-red-400"
        />
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm text-gray-300 mb-1.5">Review Content * <span className="text-gray-600">(HTML)</span></label>
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none font-mono text-sm"
          rows={18}
          placeholder="HTML content — use Generate Draft above or write directly..."
        />
      </div>

      {/* ── Affiliate disclosure gate ────────────────────────────────────── */}
      {hasAffiliateLinks && (
        <div className="bg-orange-950/40 border border-orange-800 rounded-xl p-5">
          <p className="text-orange-400 font-semibold text-sm mb-2">Affiliate links detected</p>
          <p className="text-gray-300 text-sm mb-4">
            This review contains affiliate links. You must acknowledge the FTC disclosure before submitting.
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
          disabled={saving || submitting || (hasAffiliateLinks && !disclosureAcknowledged)}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>

    </div>
  )
}
