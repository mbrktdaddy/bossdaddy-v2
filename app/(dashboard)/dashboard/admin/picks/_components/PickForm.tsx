'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface ReviewSummary {
  id: string
  slug: string
  title: string
  product_name: string
  rating: number | null
  image_url: string | null
}

interface PickItem {
  id?: string
  review_id: string
  position: number
  blurb: string | null
  reviews?: ReviewSummary | ReviewSummary[] | null
}

interface PickList {
  id: string
  slug: string
  title: string
  description: string | null
  intro_html: string | null
  hero_image_url: string | null
  is_visible: boolean
  published_at: string | null
}

interface Props {
  pick: PickList | null
  initialItems: PickItem[]
}

export function PickForm({ pick, initialItems }: Props) {
  const router = useRouter()
  const isNew = !pick

  const [slug, setSlug]         = useState(pick?.slug ?? '')
  const [title, setTitle]       = useState(pick?.title ?? '')
  const [description, setDesc]  = useState(pick?.description ?? '')
  const [introHtml, setIntro]   = useState(pick?.intro_html ?? '')
  const [heroUrl, setHeroUrl]   = useState(pick?.hero_image_url ?? '')
  const [visible, setVisible]   = useState(pick?.is_visible ?? false)
  const [items, setItems]       = useState<PickItem[]>(
    initialItems.map((i, idx) => ({ ...i, position: i.position ?? idx }))
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ReviewSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function getReview(item: PickItem): ReviewSummary | null {
    if (!item.reviews) return null
    return Array.isArray(item.reviews) ? item.reviews[0] ?? null : item.reviews
  }

  async function searchReviews(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}&type=review&limit=8`)
    if (res.ok) {
      const json = await res.json()
      setSearchResults(json.results ?? [])
    }
    setSearching(false)
  }

  function addItem(review: ReviewSummary) {
    if (items.some((i) => i.review_id === review.id)) return
    setItems((prev) => [
      ...prev,
      { review_id: review.id, position: prev.length, blurb: null, reviews: review },
    ])
    setSearchQuery('')
    setSearchResults([])
  }

  function removeItem(review_id: string) {
    setItems((prev) => prev.filter((i) => i.review_id !== review_id).map((i, idx) => ({ ...i, position: idx })))
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]]
      return next.map((i, j) => ({ ...i, position: j }))
    })
  }

  function updateBlurb(review_id: string, blurb: string) {
    setItems((prev) => prev.map((i) => i.review_id === review_id ? { ...i, blurb: blurb || null } : i))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)

    const payload = {
      slug: slug.trim().toLowerCase(),
      title: title.trim(),
      description: description.trim() || null,
      intro_html: introHtml.trim() || null,
      hero_image_url: heroUrl.trim() || null,
      is_visible: visible,
      items: items.map((i) => ({ review_id: i.review_id, position: i.position, blurb: i.blurb })),
    }

    try {
      const res = await fetch(
        isNew ? '/api/admin/picks' : `/api/admin/picks/${pick!.id}`,
        { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')

      if (isNew) {
        router.push(`/dashboard/admin/picks/${json.pick.id}`)
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!pick) return
    if (!confirm(`Delete "${pick.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch(`/api/admin/picks/${pick.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard/admin/picks')
    } else {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Metadata */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Slug <span className="text-red-400">*</span></label>
          <input
            type="text" required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())}
            pattern="[a-z0-9-]+" placeholder="fathers-day-gift-guide"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
          />
          <p className="mt-1 text-xs text-gray-600">Public URL: /picks/{slug || 'your-slug'}</p>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Title <span className="text-red-400">*</span></label>
          <input
            type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Father's Day Gift Guide 2026"
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Short description <span className="text-gray-600">(shows on index cards)</span></label>
          <input
            type="text" value={description} onChange={(e) => setDesc(e.target.value)}
            placeholder="Dad-tested picks that actually earn a spot in the garage or kitchen."
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Editorial intro <span className="text-gray-600">(HTML, shows at top of detail page)</span></label>
          <textarea
            value={introHtml} onChange={(e) => setIntro(e.target.value)}
            rows={4} placeholder="<p>Every year I get asked the same question...</p>"
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-base"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Hero image URL</label>
          <input
            type="url" value={heroUrl} onChange={(e) => setHeroUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer py-1">
          <input
            type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)}
            className="w-4 h-4 rounded accent-orange-500"
          />
          <span className="text-sm text-gray-300">Publish (make visible on site)</span>
        </label>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Picks <span className="text-gray-500 font-normal">({items.length})</span></p>
        </div>

        {/* Search to add */}
        <div className="relative mb-4">
          <input
            type="text" value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); searchReviews(e.target.value) }}
            placeholder="Search approved reviews to add..."
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
          />
          {(searchResults.length > 0 || searching) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl z-10 overflow-hidden">
              {searching && <p className="text-xs text-gray-500 px-4 py-3">Searching...</p>}
              {searchResults.map((r) => (
                <button
                  key={r.id} type="button" onClick={() => addItem(r)}
                  disabled={items.some((i) => i.review_id === r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-900 transition-colors text-left disabled:opacity-40"
                >
                  {r.image_url && (
                    <div className="relative w-8 h-8 rounded shrink-0 bg-gray-800 overflow-hidden">
                      <Image src={r.image_url} alt={r.product_name} fill className="object-cover" sizes="32px" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{r.title}</p>
                    <p className="text-xs text-gray-500">{r.product_name} · {r.rating}/10</p>
                  </div>
                  {items.some((i) => i.review_id === r.id) && <span className="text-xs text-green-400 ml-auto shrink-0">Added</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <p className="text-sm text-gray-600 py-4 text-center">No picks yet — search for reviews above.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const review = getReview(item)
              return (
                <div key={item.review_id} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                  <div className="flex items-start gap-3">
                    {review?.image_url && (
                      <div className="relative w-12 h-12 shrink-0 rounded-lg bg-gray-800 overflow-hidden">
                        <Image src={review.image_url} alt={review.product_name} fill className="object-contain p-1" sizes="48px" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight">{review?.title ?? item.review_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{review?.product_name} · {review?.rating}/10</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                        className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 transition-colors" title="Move up">↑</button>
                      <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}
                        className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 transition-colors" title="Move down">↓</button>
                      <button type="button" onClick={() => removeItem(item.review_id)}
                        className="p-1.5 text-gray-600 hover:text-red-400 transition-colors" title="Remove">×</button>
                    </div>
                  </div>
                  <input
                    type="text" value={item.blurb ?? ''}
                    onChange={(e) => updateBlurb(item.review_id, e.target.value)}
                    placeholder="Optional editorial blurb for this pick..."
                    className="mt-2 w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 text-base"
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={busy || !slug.trim() || !title.trim()}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]">
          {busy ? 'Saving…' : isNew ? 'Create List' : 'Save Changes'}
        </button>
        {!isNew && (
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="px-5 py-2.5 text-red-400 hover:text-red-300 text-sm transition-colors disabled:opacity-40 min-h-[44px]">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}
