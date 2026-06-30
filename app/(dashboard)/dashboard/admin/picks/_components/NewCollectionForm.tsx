'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Minimal create step — collects only what the POST requires (title, slug,
// type). Everything else is edited in the full CollectionWorkspace once the
// draft exists. Mirrors the reviews/guides "create then edit" split.
export function NewCollectionForm() {
  const router = useRouter()
  const [title, setTitle]     = useState('')
  const [slug, setSlug]       = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [type, setType]       = useState('general')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function slugify(s: string): string {
    return s.toLowerCase().trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
  }

  function onTitleChange(v: string) {
    setTitle(v)
    if (!slugEdited) setSlug(slugify(v))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/admin/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim().toLowerCase(),
          title: title.trim(),
          collection_type: type,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Create failed')
      router.push(`/dashboard/admin/picks/${json.pick.id}`)
      // Stay busy through the navigation — the destination remounts.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
      setBusy(false)
    }
  }

  const slugValid = /^[a-z0-9-]{2,}$/.test(slug.trim())
  const canCreate = title.trim().length >= 2 && slugValid && !busy

  return (
    <form onSubmit={handleCreate} className="space-y-4 max-w-xl">
      <div>
        <label htmlFor="nc-title" className="block text-sm text-prose-muted mb-1.5">Title <span className="text-danger-ink">*</span></label>
        <input
          id="nc-title"
          type="text" value={title} onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Father's Day Gift Guide 2026"
          autoFocus
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
        />
      </div>

      <div>
        <label htmlFor="nc-slug" className="block text-sm text-prose-muted mb-1.5">Slug <span className="text-danger-ink">*</span></label>
        <input
          id="nc-slug"
          type="text" value={slug}
          onChange={(e) => { setSlugEdited(true); setSlug(e.target.value.toLowerCase()) }}
          pattern="[a-z0-9-]+" placeholder="fathers-day-gift-guide"
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
        />
        <p className="mt-1 text-xs text-prose-faint">Lowercase letters, numbers, and hyphens. You can change everything else after creating.</p>
      </div>

      <div>
        <label htmlFor="nc-type" className="block text-sm text-prose-muted mb-1.5">Collection type</label>
        <select
          id="nc-type"
          value={type} onChange={(e) => setType(e.target.value)}
          className="w-full px-4 py-2.5 bg-surface border border-strong rounded-lg text-prose focus:outline-none focus:ring-2 focus:ring-accent-hover text-base"
        >
          <option value="general">Pick (general curated list, /picks)</option>
          <option value="best_of">Best Of (ranked category list, /picks)</option>
          <option value="gift_guide">Gift Guide (by occasion, /gifts)</option>
          <option value="comparison">Comparison (head-to-head, /comparisons)</option>
          <option value="stack">Stack (kit for a goal, /stacks)</option>
        </select>
      </div>

      {error && <p className="text-danger-ink text-sm bg-danger-bg border border-danger-line rounded-lg px-4 py-3">{error}</p>}

      <button
        type="submit"
        disabled={!canCreate}
        className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]"
      >
        {busy ? 'Creating…' : 'Create & edit →'}
      </button>
    </form>
  )
}
