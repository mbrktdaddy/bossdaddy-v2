'use client'

import { useState } from 'react'

interface Candidate {
  text: string
  subline: string
  angle: string
  best_for: string
  ip_risk: 'none' | 'low' | 'review'
  ip_note: string
  // client-side edit/save state
  saved?: boolean
  saving?: boolean
}

type Template = 'statement' | 'stacked' | 'wordmark' | 'logo'
type Colorway = 'dark' | 'light'
type Blank = 'tee' | 'hat' | 'mug'

interface ApprovedDesign {
  id: string
  title: string
  content: { text?: string; subline?: string; angle?: string }
  ip_flag: 'none' | 'low' | 'review'
  status: 'draft' | 'approved' | 'published'
  template_key: Template | null
  template_config: { colorway?: Colorway; blank?: Blank }
}

const TEMPLATES: { value: Template; label: string }[] = [
  { value: 'statement', label: 'Statement' },
  { value: 'stacked', label: 'Stacked + wordmark' },
  { value: 'wordmark', label: 'Wordmark + saying' },
  { value: 'logo', label: 'Logo only' },
]
const BLANKS: { value: Blank; label: string }[] = [
  { value: 'tee', label: 'Tee' },
  { value: 'hat', label: 'Hat' },
  { value: 'mug', label: 'Mug' },
]

function buildRenderUrl(d: ApprovedDesign, template: Template, colorway: Colorway, blank: Blank, mode: 'preview' | 'print') {
  const p = new URLSearchParams({
    template,
    colorway,
    blank,
    mode,
    text: d.content?.text ?? d.title,
    subline: d.content?.subline ?? '',
  })
  return `/api/merch/render?${p.toString()}`
}

function IpBadge({ risk }: { risk: 'none' | 'low' | 'review' }) {
  if (risk === 'none') return null
  const cls =
    risk === 'review'
      ? 'bg-danger-bg text-danger-ink border-danger-line'
      : 'bg-accent-tint text-accent-text-soft border-accent-border/40'
  return (
    <span className={`px-2 py-0.5 text-[11px] rounded-md border ${cls}`}>
      IP: {risk === 'review' ? 'review' : 'low risk'}
    </span>
  )
}

export function MerchStudio({ initialApproved }: { initialApproved: ApprovedDesign[] }) {
  const [theme, setTheme] = useState('')
  const [count, setCount] = useState(8)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [approved, setApproved] = useState<ApprovedDesign[]>(initialApproved)

  async function generate() {
    if (theme.trim().length < 2) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/merch/sayings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: theme.trim(), count }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      setCandidates((json.sayings as Candidate[]) ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function editCandidate(idx: number, patch: Partial<Candidate>) {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  function dismiss(idx: number) {
    setCandidates((prev) => prev.filter((_, i) => i !== idx))
  }

  async function approve(idx: number) {
    const c = candidates[idx]
    if (!c || c.text.trim().length === 0) return
    editCandidate(idx, { saving: true })
    try {
      const res = await fetch('/api/merch/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: c.text.trim(),
          content: { text: c.text.trim(), subline: c.subline.trim(), angle: c.angle.trim(), best_for: c.best_for },
          theme: theme.trim() || null,
          ip_flag: c.ip_risk,
          ip_note: c.ip_note || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      editCandidate(idx, { saved: true, saving: false })
      setApproved((prev) => [json.item as ApprovedDesign, ...prev])
    } catch (e) {
      setError((e as Error).message)
      editCandidate(idx, { saving: false })
    }
  }

  async function removeApproved(id: string) {
    const prev = approved
    setApproved((a) => a.filter((d) => d.id !== id))
    const res = await fetch(`/api/merch/designs/${id}`, { method: 'DELETE' })
    if (!res.ok) setApproved(prev) // roll back on failure
  }

  return (
    <div className="space-y-8">
      {/* Generator */}
      <div className="bg-surface border border-soft rounded-xl p-5">
        <label className="block text-xs text-eyebrow uppercase tracking-widest mb-2">Theme / direction</label>
        <textarea
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="e.g. tough-love dad humor for a first-time father; faith + fatherhood; grill-master dad energy"
          rows={2}
          className="w-full bg-surface-raised border border-soft rounded-lg px-3 py-2.5 text-sm text-prose resize-y focus:outline-none focus:border-strong"
        />
        <div className="flex items-center gap-3 mt-3">
          <label className="text-xs text-prose-faint">Count</label>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="bg-surface-raised border border-soft rounded-lg px-2 py-1.5 text-sm text-prose"
          >
            {[5, 8, 12, 16, 20].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={loading || theme.trim().length < 2}
            className="ml-auto px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Generating…' : 'Generate sayings'}
          </button>
        </div>
        {error && <p className="text-danger-ink text-sm mt-3">{error}</p>}
      </div>

      {/* Candidates */}
      {candidates.length > 0 && (
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-prose-muted mb-3">
            Candidates ({candidates.length})
          </h2>
          <div className="space-y-3">
            {candidates.map((c, idx) => (
              <div
                key={idx}
                className={`bg-surface border rounded-xl p-4 transition-colors ${
                  c.saved ? 'border-success-line opacity-70' : 'border-soft'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={c.text}
                      onChange={(e) => editCandidate(idx, { text: e.target.value })}
                      disabled={c.saved}
                      className="w-full bg-transparent text-lg font-black text-prose focus:outline-none focus:bg-surface-raised rounded px-1 -mx-1"
                    />
                    <input
                      value={c.subline}
                      onChange={(e) => editCandidate(idx, { subline: e.target.value })}
                      disabled={c.saved}
                      placeholder="(optional subline)"
                      className="w-full bg-transparent text-sm text-prose-muted focus:outline-none focus:bg-surface-raised rounded px-1 -mx-1"
                    />
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-[11px] text-prose-faint uppercase tracking-wide">{c.best_for}</span>
                      <IpBadge risk={c.ip_risk} />
                    </div>
                    {c.angle && <p className="text-xs text-prose-faint italic">{c.angle}</p>}
                    {c.ip_note && c.ip_risk !== 'none' && (
                      <p className="text-xs text-danger-ink">Note: {c.ip_note}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col gap-2">
                    {c.saved ? (
                      <span className="text-xs text-forest font-semibold px-2">Saved</span>
                    ) : (
                      <>
                        <button
                          onClick={() => approve(idx)}
                          disabled={c.saving || c.text.trim().length === 0}
                          className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          {c.saving ? 'Saving…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => dismiss(idx)}
                          className="px-3 py-2 bg-surface-raised hover:bg-surface-hover text-prose-muted text-xs font-semibold rounded-lg transition-colors"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved designs */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-prose-muted mb-3">
          Approved designs ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="text-sm text-prose-faint">
            Nothing approved yet. Generate some sayings and approve the keepers — then pick a template below to
            preview and export a print-ready file.
          </p>
        ) : (
          <div className="space-y-3">
            {approved.map((d) => (
              <ApprovedDesignCard key={d.id} design={d} onDelete={() => removeApproved(d.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ApprovedDesignCard({ design, onDelete }: { design: ApprovedDesign; onDelete: () => void }) {
  const [template, setTemplate] = useState<Template>(design.template_key ?? 'statement')
  const [colorway, setColorway] = useState<Colorway>(design.template_config?.colorway ?? 'dark')
  const [blank, setBlank] = useState<Blank>(design.template_config?.blank ?? 'tee')

  // Persist the chosen template + config so Phase 3 can generate the real print
  // file from the operator's selection. Fire-and-forget.
  function persist(next: { template?: Template; colorway?: Colorway; blank?: Blank }) {
    const body = {
      template_key: next.template ?? template,
      template_config: { colorway: next.colorway ?? colorway, blank: next.blank ?? blank },
    }
    fetch(`/api/merch/designs/${design.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
  }

  const previewUrl = buildRenderUrl(design, template, colorway, blank, 'preview')
  const printUrl = buildRenderUrl(design, template, colorway, blank, 'print')

  const selectCls = 'bg-surface-raised border border-soft rounded-lg px-2 py-1.5 text-xs text-prose'

  return (
    <div className="bg-surface border border-soft rounded-xl p-4">
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="shrink-0 w-40 rounded-lg overflow-hidden border border-soft bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={`Preview of ${design.title}`} className="w-full h-auto block" />
        </div>

        {/* Controls */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-bold text-prose truncate">{design.content?.text || design.title}</p>
            <IpBadge risk={design.ip_flag} />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              value={template}
              onChange={(e) => { const v = e.target.value as Template; setTemplate(v); persist({ template: v }) }}
              className={selectCls}
              aria-label="Template"
            >
              {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select
              value={blank}
              onChange={(e) => { const v = e.target.value as Blank; setBlank(v); persist({ blank: v }) }}
              className={selectCls}
              aria-label="Product"
            >
              {BLANKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <div className="flex rounded-lg border border-soft overflow-hidden">
              {(['dark', 'light'] as Colorway[]).map((c) => (
                <button
                  key={c}
                  onClick={() => { setColorway(c); persist({ colorway: c }) }}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    colorway === c ? 'bg-accent text-white' : 'bg-surface-raised text-prose-muted hover:bg-surface-hover'
                  }`}
                >
                  {c === 'dark' ? 'On dark' : 'On light'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={printUrl}
              download
              className="px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Download print file
            </a>
            <span className="text-[11px] text-prose-faint uppercase">{design.status}</span>
            <button
              onClick={onDelete}
              className="ml-auto text-xs text-prose-faint hover:text-danger-ink px-2 py-1"
              aria-label="Delete design"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
