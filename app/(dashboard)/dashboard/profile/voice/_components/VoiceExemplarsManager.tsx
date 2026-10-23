'use client'

import { useState } from 'react'
import { buttonVariants } from '@/components/ui/Button'
import { MAX_EXEMPLARS, type ExemplarCandidate, type VoiceExemplar } from '@/lib/voiceExemplars'

// Pick up to MAX_EXEMPLARS approved pieces whose excerpts ride in every content
// generation's system prompt as examples of the author's voice. The excerpt is
// captured at save time (a later edit to the piece doesn't change the sample).

interface Props {
  initialPicks: VoiceExemplar[]
  candidates: ExemplarCandidate[]
}

export function VoiceExemplarsManager({ initialPicks, candidates }: Props) {
  const [picks, setPicks] = useState<VoiceExemplar[]>(initialPicks)
  const [selected, setSelected] = useState<{ type: 'review' | 'guide'; id: string }[]>(
    initialPicks.map((p) => ({ type: p.content_type, id: p.content_id })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isSelected = (c: ExemplarCandidate) => selected.some((s) => s.type === c.type && s.id === c.id)
  const dirty = JSON.stringify(selected) !== JSON.stringify(picks.map((p) => ({ type: p.content_type, id: p.content_id })))

  function toggle(c: ExemplarCandidate) {
    setSaved(false)
    setSelected((cur) => {
      if (cur.some((s) => s.type === c.type && s.id === c.id)) return cur.filter((s) => !(s.type === c.type && s.id === c.id))
      if (cur.length >= MAX_EXEMPLARS) return cur
      return [...cur, { type: c.type, id: c.id }]
    })
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/voice/exemplars', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: selected }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setPicks(json.picks ?? [])
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
    setSaving(false)
  }

  return (
    <section>
      <h2 className="text-lg font-black mb-1">Voice exemplars</h2>
      <p className="text-prose-faint text-sm mb-4">
        Up to {MAX_EXEMPLARS} published pieces that show how you actually write. Their opening ~600 words ride along
        with every draft as examples of register and rhythm — rules describe a voice, examples demonstrate it.
        Pick your best, not your newest.
      </p>

      {candidates.length === 0 ? (
        <p className="text-sm text-prose-muted">Nothing published yet — exemplars become available once a review or guide is approved.</p>
      ) : (
        <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {candidates.map((c) => {
            const on = isSelected(c)
            const full = !on && selected.length >= MAX_EXEMPLARS
            return (
              <li key={`${c.type}:${c.id}`}>
                <label className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${on ? 'border-accent bg-accent-tint' : 'border-soft'} ${full ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={full}
                    onChange={() => toggle(c)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-prose leading-snug">{c.title}</span>
                    <span className="block text-xs text-prose-faint uppercase tracking-widest mt-0.5">{c.type}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button type="button" onClick={save} disabled={saving || !dirty} className={buttonVariants()}>
          {saving ? 'Saving…' : 'Save exemplars'}
        </button>
        <span className="text-xs text-prose-faint">{selected.length}/{MAX_EXEMPLARS} picked</span>
        {saved && <span className="text-xs text-prose-muted">Saved — applies to the next generation.</span>}
      </div>
      {error && <p className="mt-2 text-sm text-danger-ink">{error}</p>}
    </section>
  )
}
