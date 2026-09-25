'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { buttonVariants } from '@/components/ui/Button'

export interface Candidate {
  id:                 string
  slug:               string
  name:               string
  brand:              string | null
  category:           string | null
  price_text:         string | null
  price_tier:         string | null
  fit:                string | null
  affiliate_url:      string | null
  request_count:      number
  adopted_at:         string | null
  adopted_product_id: string | null
  created_at:         string
  last_seen_at:       string
}

interface Props {
  candidates: Candidate[]
}

export function CandidatesClient({ candidates }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open    = candidates.filter((c) => !c.adopted_at)
  const adopted = candidates.filter((c) => c.adopted_at)

  async function adopt(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/gear-candidates/${id}/adopt`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Adopt failed (${res.status})`)
        return
      }
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-danger-bg border border-danger-line text-danger-ink text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {open.length === 0 ? (
        <EmptyState
          variant="panel"
          size="md"
          title="No researched gear waiting."
          body="When a member asks The Boss for gear we haven&apos;t tested, the research picks land here."
        />
      ) : (
        <div className="space-y-2">
          {open.map((c) => (
            <Card
              key={c.id}
              className="flex items-center gap-4 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-prose truncate">{c.name}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-prose-faint flex-wrap">
                  {c.brand && <span>{c.brand}</span>}
                  {c.price_text && <span>· {c.price_text}</span>}
                  {c.price_tier && <span>· {c.price_tier}</span>}
                  <span>· asked {c.request_count}×</span>
                </div>
                {c.fit && <p className="text-xs text-prose-faint mt-1 truncate">{c.fit}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-3">
                {c.affiliate_url && (
                  <a
                    href={`/go/${c.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-prose-faint hover:text-prose transition-colors"
                  >
                    Preview link
                  </a>
                )}
                <button
                  onClick={() => adopt(c.id)}
                  disabled={busyId === c.id || pending}
                  className={buttonVariants()}
                >
                  {busyId === c.id ? 'Adopting…' : 'Adopt → Bench'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {adopted.length > 0 && (
        <div>
          <Eyebrow as="h2" className="mb-3">
            Adopted ({adopted.length})
          </Eyebrow>
          <div className="space-y-1">
            {adopted.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-2.5 bg-surface-raised/40 border border-soft rounded-lg text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-prose-muted">{c.name}</span>
                <a
                  href={`/bench/${c.slug}`}
                  className="shrink-0 text-xs text-accent-text-soft hover:text-accent transition-colors"
                >
                  On the bench →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
