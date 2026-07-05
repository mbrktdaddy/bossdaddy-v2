'use client'

import { useEffect, useState } from 'react'

interface Candidate {
  text: string
  subline: string
  angle: string
  best_for: string
  ip_risk: 'none' | 'low' | 'review'
  ip_note: string
  saved?: boolean
  saving?: boolean
}

type Template = 'statement' | 'stacked' | 'wordmark' | 'logo'
type Colorway = 'dark' | 'light'
type Blank = 'tee' | 'hat' | 'mug'

interface PublishedEntry {
  blank: string
  template?: string
  colorway?: string
  sync_product_id: number
}

interface ApprovedDesign {
  id: string
  title: string
  content: { text?: string; subline?: string; angle?: string }
  ip_flag: 'none' | 'low' | 'review'
  status: 'draft' | 'approved' | 'published'
  template_key: Template | null
  template_config: { colorway?: Colorway; blank?: Blank }
  published: PublishedEntry[]
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
const PUBLISHABLE: Record<Blank, boolean> = { tee: true, mug: true, hat: false }
const DEFAULT_PRICE: Record<Blank, string> = { tee: '28', mug: '15', hat: '25' }

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

  // Verbatim ("use my exact words") entry
  const [customText, setCustomText] = useState('')
  const [customSub, setCustomSub] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)

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

  async function saveDesign(body: Record<string, unknown>): Promise<ApprovedDesign> {
    const res = await fetch('/api/merch/designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Save failed')
    return json.item as ApprovedDesign
  }

  async function approve(idx: number) {
    const c = candidates[idx]
    if (!c || c.text.trim().length === 0) return
    editCandidate(idx, { saving: true })
    try {
      const item = await saveDesign({
        title: c.text.trim(),
        content: { text: c.text.trim(), subline: c.subline.trim(), angle: c.angle.trim(), best_for: c.best_for },
        theme: theme.trim() || null,
        ip_flag: c.ip_risk,
        ip_note: c.ip_note || null,
      })
      editCandidate(idx, { saved: true, saving: false })
      setApproved((prev) => [item, ...prev])
    } catch (e) {
      setError((e as Error).message)
      editCandidate(idx, { saving: false })
    }
  }

  async function addCustom() {
    const text = customText.trim()
    if (text.length === 0) return
    setAddingCustom(true)
    setError(null)
    try {
      const item = await saveDesign({
        title: text,
        content: { text, subline: customSub.trim(), angle: 'Typed verbatim', best_for: 'any' },
        theme: '(exact text)',
        ip_flag: 'none',
      })
      setApproved((prev) => [item, ...prev])
      setCustomText('')
      setCustomSub('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAddingCustom(false)
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

      {/* Verbatim entry — use exactly what you type, no AI */}
      <div className="bg-surface border border-soft rounded-xl p-5">
        <label className="block text-xs text-eyebrow uppercase tracking-widest mb-2">Use my exact words</label>
        <p className="text-xs text-prose-faint mb-3">
          Type a saying exactly as it should print — this skips AI generation and adds it straight to your approved designs.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Exact line (e.g. DAD LIKE A BOSS)"
            className="flex-1 bg-surface-raised border border-soft rounded-lg px-3 py-2.5 text-sm text-prose focus:outline-none focus:border-strong"
          />
          <input
            value={customSub}
            onChange={(e) => setCustomSub(e.target.value)}
            placeholder="Optional subline"
            className="flex-1 bg-surface-raised border border-soft rounded-lg px-3 py-2.5 text-sm text-prose focus:outline-none focus:border-strong"
          />
          <button
            onClick={addCustom}
            disabled={addingCustom || customText.trim().length === 0}
            className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {addingCustom ? 'Adding…' : 'Add exact'}
          </button>
        </div>
        <p className="text-[11px] text-prose-faint mt-2">
          You&apos;re responsible for the wording — don&apos;t use trademarked slogans or quotes you don&apos;t own.
        </p>
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
            Nothing approved yet. Generate sayings (or add your exact words above), approve the keepers, then pick a
            template to preview and publish.
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

interface CatalogOptions {
  colors: string[]
  sizes: string[]
  defaults: { colorsDark: string[]; colorsLight: string[]; sizes: string[] }
}

function ApprovedDesignCard({ design, onDelete }: { design: ApprovedDesign; onDelete: () => void }) {
  const [template, setTemplate] = useState<Template>(design.template_key ?? 'statement')
  const [colorway, setColorway] = useState<Colorway>(design.template_config?.colorway ?? 'dark')
  const [blank, setBlank] = useState<Blank>(design.template_config?.blank ?? 'tee')
  const [price, setPrice] = useState<string>(DEFAULT_PRICE[design.template_config?.blank ?? 'tee'])
  const [publishedBlanks, setPublishedBlanks] = useState<string[]>((design.published ?? []).map((e) => e.blank))
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [publishErr, setPublishErr] = useState<string | null>(null)

  // Catalog color/size options for the current blank.
  const [options, setOptions] = useState<CatalogOptions | null>(null)
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])

  // Fetch catalog options when the blank changes (publishable blanks only).
  useEffect(() => {
    if (!PUBLISHABLE[blank]) { setOptions(null); return }
    let cancelled = false
    setOptions(null)
    fetch(`/api/merch/catalog/${blank}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('catalog'))))
      .then((json: CatalogOptions) => {
        if (cancelled) return
        setOptions(json)
        const defColors = colorway === 'dark' ? json.defaults.colorsDark : json.defaults.colorsLight
        setSelectedColors(defColors)
        setSelectedSizes(json.defaults.sizes)
      })
      .catch(() => { if (!cancelled) setOptions(null) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blank])

  // When colorway flips, reset colors to that colorway's sensible defaults.
  useEffect(() => {
    if (!options) return
    setSelectedColors(colorway === 'dark' ? options.defaults.colorsDark : options.defaults.colorsLight)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorway])

  function toggle(list: string[], set: (v: string[]) => void, val: string) {
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val])
  }

  function persist(next: { template?: Template; colorway?: Colorway; blank?: Blank }) {
    fetch(`/api/merch/designs/${design.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_key: next.template ?? template,
        template_config: { colorway: next.colorway ?? colorway, blank: next.blank ?? blank },
      }),
    }).catch(() => {})
  }

  async function publish() {
    const priceCents = Math.round(parseFloat(price) * 100)
    if (!Number.isFinite(priceCents) || priceCents < 100) { setPublishErr('Enter a valid price ($1+).'); return }
    if (selectedColors.length === 0 || selectedSizes.length === 0) { setPublishErr('Pick at least one color and size.'); return }
    setPublishing(true); setPublishMsg(null); setPublishErr(null)
    try {
      const res = await fetch('/api/merch/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId: design.id, blank, template, colorway, priceCents,
          colors: selectedColors, sizes: selectedSizes,
          force: publishedBlanks.includes(blank),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Publish failed')
      setPublishedBlanks((prev) => (prev.includes(blank) ? prev : [...prev, blank]))
      setPublishMsg(
        (json.warning as string) ||
        `Published ${blank} to Printful (#${json.syncProductId}, ${json.variantCount} variants). ${json.next ?? ''}`,
      )
    } catch (e) {
      setPublishErr((e as Error).message)
    } finally {
      setPublishing(false)
    }
  }

  const previewUrl = buildRenderUrl(design, template, colorway, blank, 'preview')
  const printUrl = buildRenderUrl(design, template, colorway, blank, 'print')
  const selectCls = 'bg-surface-raised border border-soft rounded-lg px-2 py-1.5 text-xs text-prose'
  const alreadyPublished = publishedBlanks.includes(blank)

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
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <p className="text-sm font-bold text-prose truncate">{design.content?.text || design.title}</p>
            <IpBadge risk={design.ip_flag} />
            {publishedBlanks.map((b) => (
              <span key={b} className="px-2 py-0.5 text-[11px] rounded-md border border-success-line bg-success-bg text-forest capitalize">
                {b} live
              </span>
            ))}
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
              onChange={(e) => { const v = e.target.value as Blank; setBlank(v); setPrice(DEFAULT_PRICE[v]); persist({ blank: v }) }}
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

          {/* Color + size selectors (publishable blanks) */}
          {PUBLISHABLE[blank] && options && (
            <div className="mb-3 space-y-2">
              <div>
                <p className="text-[11px] text-prose-faint uppercase tracking-wide mb-1">Colors ({selectedColors.length})</p>
                <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 p-1 bg-surface-sunken rounded-lg border border-soft">
                  {options.colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggle(selectedColors, setSelectedColors, c)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        selectedColors.includes(c)
                          ? 'bg-accent text-white border-accent'
                          : 'bg-surface-raised text-prose-muted border-soft hover:bg-surface-hover'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-prose-faint uppercase tracking-wide mb-1">Sizes</p>
                <div className="flex flex-wrap gap-1">
                  {options.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggle(selectedSizes, setSelectedSizes, s)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        selectedSizes.includes(s)
                          ? 'bg-accent text-white border-accent'
                          : 'bg-surface-raised text-prose-muted border-soft hover:bg-surface-hover'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <a
              href={printUrl}
              download
              className="px-3 py-2 bg-surface-raised hover:bg-surface-hover border border-soft text-prose text-xs font-semibold rounded-lg transition-colors"
            >
              Download print file
            </a>
            <button
              onClick={onDelete}
              className="ml-auto text-xs text-prose-faint hover:text-danger-ink px-2 py-1"
              aria-label="Delete design"
            >
              Delete
            </button>
          </div>

          {/* Publish to Printful */}
          <div className="mt-3 pt-3 border-t border-soft">
            {PUBLISHABLE[blank] ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-prose-faint">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-16 bg-surface-raised border border-soft rounded-lg px-2 py-1.5 text-xs text-prose"
                    aria-label="Retail price (USD)"
                  />
                </div>
                <button
                  onClick={publish}
                  disabled={publishing || !options}
                  className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {publishing ? 'Publishing…' : alreadyPublished ? `Re-publish ${blank}` : `Publish ${blank} to Printful`}
                </button>
                <span className="text-[11px] text-prose-faint">creates a Printful draft → run merch:sync</span>
              </div>
            ) : (
              <p className="text-[11px] text-prose-faint">Hats are embroidery — publishing comes in a later phase. Preview + download still work.</p>
            )}
            {publishMsg && <p className="text-xs text-forest mt-2">{publishMsg}</p>}
            {publishErr && <p className="text-xs text-danger-ink mt-2">{publishErr}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
