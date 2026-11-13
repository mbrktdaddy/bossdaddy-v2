'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { buttonVariants } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChevronLeftIcon } from '@/components/icons'
import { extractLinks } from '@/lib/content/pipeline/facts'
import { MAX_REFERENCES, hostOf, type ReferenceInput } from '@/lib/content/references'

// The phone's share sheet lands here (manifest `share_target`, GET). Share a
// page from Chrome → "Boss Daddy" → pick which draft the link is a reference
// for. The link goes onto that wizard's saved draft (the same localStorage key
// the wizard restores from) and the wizard opens with it already listed; the
// author taps Fetch there. Nothing is fetched or sent from this page.

const WIZARDS = {
  review: { key: 'bd:review-wizard-draft', href: '/dashboard/reviews/new', label: 'Add to a review draft' },
  guide:  { key: 'bd:guide-wizard-draft',  href: '/dashboard/guides/new',  label: 'Add to a guide draft' },
} as const

function addToDraft(kind: keyof typeof WIZARDS, links: string[]) {
  const { key, href } = WIZARDS[kind]
  let draft: Record<string, unknown> = {}
  try { draft = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {} } catch { /* start fresh */ }
  const existing = Array.isArray(draft.references) ? (draft.references as ReferenceInput[]) : []
  const have = new Set(existing.map((r) => r.url))
  const merged = [...existing, ...links.filter((u) => !have.has(u)).map((url) => ({ url }))].slice(0, MAX_REFERENCES)
  try { localStorage.setItem(key, JSON.stringify({ ...draft, references: merged })) } catch { /* storage full: open the wizard anyway */ }
  // Hard navigation: the wizard reads localStorage on mount, and router.push
  // is unreliable in the installed app (see the post-auth rule).
  window.location.assign(href)
}

function ShareInner() {
  const params = useSearchParams()
  const [busy, setBusy] = useState(false)
  const links = [...new Set(extractLinks(`${params.get('url') ?? ''} ${params.get('text') ?? ''}`))]
    .filter((u) => { try { return /^https?:$/.test(new URL(u).protocol) } catch { return false } })

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs text-prose-faint hover:text-prose transition-colors mb-3">
        <ChevronLeftIcon className="w-3 h-3" strokeWidth={2} />
        Dashboard
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-black">Add as a reference</h1>
        <p className="text-prose-faint text-sm mt-1">Pick the draft this link is a source for. You fetch it from the draft.</p>
      </div>

      <Card tone="surface" className="p-5 space-y-4">
        {links.length === 0 ? (
          <p className="text-sm text-prose-muted">No web link came through in what you shared. Share a page from the browser, or paste the link into the draft&apos;s reference list.</p>
        ) : (
          <ul className="space-y-1.5">
            {links.map((u) => (
              <li key={u} className="text-sm text-prose break-all">
                <span className="font-semibold">{hostOf(u) ?? u}</span>
                <span className="block text-xs text-prose-faint">{u}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WIZARDS) as (keyof typeof WIZARDS)[]).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={busy || links.length === 0}
              onClick={() => { setBusy(true); addToDraft(kind, links) }}
              className={buttonVariants({ variant: 'primary' })}
            >
              {WIZARDS[kind].label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <ShareInner />
    </Suspense>
  )
}
