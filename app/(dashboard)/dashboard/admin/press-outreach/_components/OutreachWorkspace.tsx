'use client'

import { useState, useCallback } from 'react'
import type { Product } from '@/lib/products'

type ContactMethod = 'email' | 'web_form' | 'amazon' | 'phone'
type OutreachStatus = 'draft' | 'sent' | 'responded' | 'no_response' | 'follow_up'

export interface OutreachRecord {
  id: string
  product_name: string
  brand_name: string
  contact_name: string | null
  contact_email: string | null
  contact_method: ContactMethod
  contact_url: string | null
  subject: string | null
  body: string
  status: OutreachStatus
  notes: string | null
  sent_at: string | null
  responded_at: string | null
  created_at: string
}

interface Props {
  products: Product[]
  initialHistory: OutreachRecord[]
}

const METHOD_LABELS: Record<ContactMethod, string> = {
  email:    'Email',
  web_form: 'Web Form',
  amazon:   'Amazon',
  phone:    'Phone',
}

const STATUS_CONFIG: Record<OutreachStatus, { label: string; classes: string }> = {
  draft:       { label: 'Draft',       classes: 'bg-surface-raised text-prose-muted border-strong' },
  sent:        { label: 'Sent',        classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  responded:   { label: 'Responded',   classes: 'bg-green-50 text-forest border-green-200/50' },
  no_response: { label: 'No Response', classes: 'bg-amber-950/50 text-amber-400 border-amber-800/50' },
  follow_up:   { label: 'Follow Up',   classes: 'bg-accent-tint text-accent-text-soft border-accent-border/50' },
}

function buildTemplate(productName: string, brandName: string, contactName: string) {
  const greeting = contactName.trim()
    ? `Hi ${contactName.trim().split(' ')[0]},`
    : `Hi ${brandName.trim() || 'Team'},`

  const subject = productName.trim()
    ? `Product Image Request — ${productName.trim()} | BossDaddyLife.com`
    : 'Product Image Request | BossDaddyLife.com'

  const body = `${greeting}

My name is Michael Brackett, and I'm the founder of BossDaddyLife.com — a product review site built for dads covering gear, health, family life, and everything in between. We publish in-depth, first-person reviews with affiliate partnerships.

I recently reviewed the ${productName.trim() || 'your product'} on our site and gave it high marks — it's one of the products I actively recommend to dads in my audience.

I'm building out product image galleries for each reviewed product and would love to include official hi-res product photography for the ${productName.trim() || 'product'}. Could your team share any press or media images cleared for use on affiliate review sites?

You can find our reviews here: https://www.bossdaddylife.com/reviews

Thank you for your time — happy to provide any additional context about the site or our audience.

Michael Brackett
Founder, BossDaddyLife.com
boss@bossdaddylife.com`

  return { subject, body }
}

function formatDate(iso: string) {
  // timeZone: 'UTC' prevents React 19 hydration mismatches between
  // server (UTC) and client (user's local TZ).
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function MethodBadge({ method }: { method: ContactMethod }) {
  const colors: Record<ContactMethod, string> = {
    email:    'bg-blue-50 text-blue-700 border-blue-200',
    web_form: 'bg-purple-950/40 text-purple-400 border-purple-800/40',
    amazon:   'bg-amber-950/40 text-amber-400 border-amber-800/40',
    phone:    'bg-surface-raised text-prose-muted border-strong',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${colors[method]}`}>
      {METHOD_LABELS[method]}
    </span>
  )
}

export default function OutreachWorkspace({ products, initialHistory }: Props) {
  // Composer state
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [method, setMethod] = useState<ContactMethod>('email')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactUrl, setContactUrl] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // History state
  const [history, setHistory] = useState<OutreachRecord[]>(initialHistory)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | 'all'>('all')

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const applyTemplate = useCallback((pName: string, bName: string, cName: string) => {
    const { subject: s, body: b } = buildTemplate(pName, bName, cName)
    setSubject(s)
    setBody(b)
  }, [])

  function handleProductSelect(productId: string) {
    setSelectedProductId(productId)
    if (!productId) return
    const p = products.find(pr => pr.id === productId)
    if (!p) return
    const pName = p.name
    const words = pName.trim().split(/\s+/)
    const bName = words.length > 1 ? words.slice(0, 2).join(' ') : words[0]
    setProductName(pName)
    setBrandName(bName)
    applyTemplate(pName, bName, contactName)
  }

  // Auto-fill template on blur if user manually entered product info and body is empty
  function handleProductFieldBlur() {
    if (!body.trim() && productName.trim()) {
      applyTemplate(productName, brandName, contactName)
    }
  }

  function handleResetTemplate() {
    applyTemplate(productName, brandName, contactName)
    showToast('success', 'Template restored.')
  }

  function resetComposer() {
    setSelectedProductId('')
    setProductName('')
    setBrandName('')
    setContactName('')
    setContactEmail('')
    setContactUrl('')
    setSubject('')
    setBody('')
  }

  async function handleSend() {
    if (!productName.trim()) return showToast('error', 'Product name is required.')
    if (!brandName.trim()) return showToast('error', 'Brand name is required.')
    if (method === 'email' && !contactEmail.trim()) return showToast('error', 'Contact email is required.')
    if (!body.trim()) return showToast('error', 'Message body is required.')

    setBusy(true)
    try {
      const res = await fetch('/api/press-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id:     selectedProductId || null,
          product_name:   productName,
          brand_name:     brandName,
          contact_name:   contactName || undefined,
          contact_email:  contactEmail || undefined,
          contact_method: method,
          contact_url:    contactUrl || undefined,
          subject,
          body,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to send.')
      setHistory(prev => [data, ...prev])
      showToast('success', `Email sent to ${contactEmail}`)
      resetComposer()
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogAndCopy() {
    if (!productName.trim()) return showToast('error', 'Product name is required.')
    if (!brandName.trim()) return showToast('error', 'Brand name is required.')
    if (!body.trim()) return showToast('error', 'Message body is required.')

    setBusy(true)
    try {
      // Copy to clipboard for web_form / amazon (skip for phone — nothing to paste)
      if (method !== 'phone') {
        try {
          await navigator.clipboard.writeText(body)
        } catch {
          showToast('error', 'Could not access clipboard. Body still logged.')
        }
      }

      const res = await fetch('/api/press-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id:     selectedProductId || null,
          product_name:   productName,
          brand_name:     brandName,
          contact_name:   contactName || undefined,
          contact_method: method,
          contact_url:    contactUrl || undefined,
          subject,
          body,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to log.')
      setHistory(prev => [data, ...prev])

      const successMsg =
        method === 'phone'    ? 'Outreach logged.' :
        method === 'web_form' ? 'Body copied. Opening form…' :
                                'Body copied. Opening Amazon listing…'
      showToast('success', successMsg)

      // Open external destination after successful log
      if ((method === 'web_form' || method === 'amazon') && contactUrl) {
        window.open(contactUrl, '_blank', 'noopener,noreferrer')
      }
      resetComposer()
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleStatusUpdate(id: string, status: OutreachStatus) {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/press-outreach/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const updated = await res.json()
      if (!res.ok) throw new Error(typeof updated.error === 'string' ? updated.error : 'Failed to update')
      setHistory(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update status.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleNotesSave(id: string) {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/press-outreach/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      })
      const updated = await res.json()
      if (!res.ok) throw new Error(typeof updated.error === 'string' ? updated.error : 'Failed to save')
      setHistory(prev => prev.map(r => r.id === id ? { ...r, notes: updated.notes } : r))
      setEditingNotesId(null)
      showToast('success', 'Note saved.')
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save note.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(id: string, brand: string) {
    if (!confirm(`Delete outreach record for ${brand}? This cannot be undone.`)) return
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/press-outreach/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete')
      setHistory(prev => prev.filter(r => r.id !== id))
      showToast('success', 'Record deleted.')
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete record.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleCopyHistoryBody(body: string) {
    try {
      await navigator.clipboard.writeText(body)
      showToast('success', 'Body copied to clipboard.')
    } catch {
      showToast('error', 'Could not access clipboard.')
    }
  }

  const inputCls = 'w-full bg-surface-sunken border border-soft rounded-xl px-3 py-2.5 text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:border-accent transition-colors'

  const filteredHistory = statusFilter === 'all'
    ? history
    : history.filter(r => r.status === statusFilter)

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6 md:space-y-8">

      {/* Toast — full-width on mobile, max-width on desktop */}
      {toast && (
        <div
          role="status"
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-forest'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          <span className="min-w-0 break-words">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black">Press Outreach</h1>
        <p className="text-prose-faint text-xs md:text-sm mt-1">
          Request product images from brands. Emails send from <span className="text-accent-text-soft">boss@bossdaddylife.com</span> via Resend.
        </p>
      </div>

      {/* Composer */}
      <div className="bg-surface border border-soft rounded-xl overflow-hidden">

        {/* Section 1 — Product */}
        <div className="p-4 md:p-6 border-b border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-medium mb-4">1 · Product</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-prose-faint mb-1.5">Select from your products</label>
              <select
                value={selectedProductId}
                onChange={e => handleProductSelect(e.target.value)}
                className={inputCls}
              >
                <option value="">— Pick a product or enter manually below —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-prose-faint mb-1.5">Product name <span className="text-accent-text">*</span></label>
                <input
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  onBlur={handleProductFieldBlur}
                  placeholder="e.g. Thorne Zinc Picolinate 30mg"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-prose-faint mb-1.5">Brand name <span className="text-accent-text">*</span></label>
                <input
                  value={brandName}
                  onChange={e => setBrandName(e.target.value)}
                  onBlur={handleProductFieldBlur}
                  placeholder="e.g. Thorne"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 — Contact */}
        <div className="p-4 md:p-6 border-b border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-medium mb-4">2 · Contact</p>
          <div className="space-y-3">

            {/* Method toggle — horizontal scroll on narrow screens, wraps within bounds otherwise */}
            <div>
              <label className="block text-xs text-prose-faint mb-1.5">Contact method</label>
              <div
                role="tablist"
                aria-label="Contact method"
                className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 md:-mx-6 px-4 md:px-6 pb-1"
              >
                {(['email', 'web_form', 'amazon', 'phone'] as ContactMethod[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={method === m}
                    onClick={() => setMethod(m)}
                    className={`shrink-0 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium border transition-colors ${
                      method === m
                        ? 'bg-accent border-accent text-white'
                        : 'bg-surface-sunken border-strong text-prose-muted hover:border-strong hover:text-prose'
                    }`}
                  >
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-prose-faint mb-1.5">Contact name <span className="text-gray-700">(optional)</span></label>
                <input
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="e.g. Media Team"
                  className={inputCls}
                />
              </div>

              {method === 'email' && (
                <div>
                  <label className="block text-xs text-prose-faint mb-1.5">Contact email <span className="text-accent-text">*</span></label>
                  <input
                    type="email"
                    inputMode="email"
                    autoCapitalize="off"
                    autoComplete="off"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="e.g. media@brand.com"
                    className={inputCls}
                  />
                </div>
              )}

              {(method === 'web_form' || method === 'amazon') && (
                <div>
                  <label className="block text-xs text-prose-faint mb-1.5">
                    {method === 'web_form' ? 'Form URL' : 'Amazon seller URL'}
                    <span className="text-gray-700 ml-1">(optional)</span>
                  </label>
                  <input
                    type="url"
                    inputMode="url"
                    autoCapitalize="off"
                    autoComplete="off"
                    value={contactUrl}
                    onChange={e => setContactUrl(e.target.value)}
                    placeholder={method === 'web_form' ? 'https://brand.com/press' : 'https://amazon.com/...'}
                    className={inputCls}
                  />
                </div>
              )}

              {method === 'phone' && (
                <div>
                  <label className="block text-xs text-prose-faint mb-1.5">Phone number <span className="text-gray-700">(optional)</span></label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={contactUrl}
                    onChange={e => setContactUrl(e.target.value)}
                    placeholder="e.g. 800-555-1234"
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            {method !== 'email' && (
              <p className="text-xs text-prose-faint leading-relaxed">
                {method === 'web_form' && 'Logs the outreach as a draft, copies the body to your clipboard, and opens the form in a new tab. Mark as Sent in history once you submit.'}
                {method === 'amazon' && 'Logs as a draft and copies the body. Open the Amazon listing’s "Contact Seller" button and paste.'}
                {method === 'phone' && 'Logs the call without copying anything. Track the conversation in the notes.'}
              </p>
            )}
          </div>
        </div>

        {/* Section 3 — Message */}
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 gap-2">
            <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">3 · Message</p>
            <button
              type="button"
              onClick={handleResetTemplate}
              className="text-xs text-prose-faint hover:text-prose-muted transition-colors shrink-0"
            >
              Reset to template
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-prose-faint mb-1.5">Subject line</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Product Image Request — [Product] | BossDaddyLife.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-prose-faint mb-1.5">Message body</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Your message will auto-fill once you enter a product name above..."
                className={`${inputCls} resize-y font-mono text-xs leading-relaxed min-h-[280px] md:min-h-[400px]`}
              />
            </div>
          </div>

          {/* Action row — stack on mobile, row on desktop */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-700 order-2 sm:order-1">
              Sending from <span className="text-prose-faint">boss@bossdaddylife.com</span>
            </p>
            <div className="order-1 sm:order-2">
              {method === 'email' ? (
                <button
                  onClick={handleSend}
                  disabled={busy}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {busy ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  )}
                  {busy ? 'Sending…' : 'Send Email'}
                </button>
              ) : (
                <button
                  onClick={handleLogAndCopy}
                  disabled={busy}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {busy ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : method === 'phone' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  )}
                  {busy
                    ? 'Logging…'
                    : method === 'phone'    ? 'Log Outreach'
                    : method === 'web_form' ? 'Log, Copy & Open Form'
                                            : 'Log, Copy & Open Amazon'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-black">
            Outreach History
            {history.length > 0 && (
              <span className="ml-2 text-sm font-normal text-prose-faint">({history.length})</span>
            )}
          </h2>
          {history.length > 0 && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as OutreachStatus | 'all')}
              aria-label="Filter outreach by status"
              className="bg-surface border border-soft text-prose-muted text-sm rounded-xl px-3 py-2.5 min-h-[44px] focus:outline-none focus:border-accent transition-colors"
            >
              <option value="all">All statuses ({history.length})</option>
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => {
                const count = history.filter(r => r.status === val).length
                if (count === 0) return null
                return <option key={val} value={val}>{cfg.label} ({count})</option>
              })}
            </select>
          )}
        </div>

        {history.length === 0 ? (
          <div className="bg-surface border border-soft rounded-xl p-8 text-center">
            <p className="text-prose-faint text-sm">No outreach logged yet. Send your first email above.</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="bg-surface border border-soft rounded-xl p-8 text-center">
            <p className="text-prose-faint text-sm">No records match this filter.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHistory.map(record => (
              <div key={record.id} className="bg-surface border border-soft rounded-xl overflow-hidden">

                {/* Row summary — stacked on mobile, side-by-side on desktop */}
                <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{record.brand_name}</span>
                      <MethodBadge method={record.contact_method} />
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${STATUS_CONFIG[record.status].classes}`}>
                        {STATUS_CONFIG[record.status].label}
                      </span>
                    </div>
                    <p className="text-xs text-prose-faint truncate">{record.product_name}</p>
                    <p className="text-xs text-gray-700 mt-0.5 truncate">
                      {record.contact_email ?? record.contact_url ?? '—'}
                      {record.sent_at && <span className="ml-2">· {formatDate(record.sent_at)}</span>}
                    </p>
                    {record.notes && (
                      <p className="text-xs text-prose-faint mt-1 italic line-clamp-2">{record.notes}</p>
                    )}
                  </div>

                  {/* Actions row — full width on mobile (status grows), fixed on desktop */}
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <select
                      value={record.status}
                      disabled={updatingId === record.id}
                      onChange={e => handleStatusUpdate(record.id, e.target.value as OutreachStatus)}
                      aria-label={`Update status for ${record.brand_name}`}
                      className="flex-1 sm:flex-none bg-surface-raised border border-strong text-prose-muted text-xs rounded-lg px-3 min-h-[44px] sm:min-h-[36px] sm:py-1.5 focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                    >
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                        <option key={val} value={val}>{cfg.label}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        if (editingNotesId === record.id) {
                          setEditingNotesId(null)
                        } else {
                          setEditingNotesId(record.id)
                          setNotesDraft(record.notes ?? '')
                        }
                      }}
                      aria-label={record.notes ? 'Edit note' : 'Add note'}
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-prose-faint hover:text-prose hover:bg-surface-raised transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>

                    <button
                      onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                      aria-label={expandedId === record.id ? 'Collapse message' : 'View full message'}
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-prose-faint hover:text-prose hover:bg-surface-raised transition-colors shrink-0"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedId === record.id ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Notes editor */}
                {editingNotesId === record.id && (
                  <div className="px-4 pb-4 border-t border-soft pt-3 space-y-2">
                    <textarea
                      value={notesDraft}
                      onChange={e => setNotesDraft(e.target.value)}
                      rows={3}
                      placeholder="Add a note (e.g. 'Replied — assets coming Friday')"
                      className="w-full bg-surface-sunken border border-strong rounded-xl px-3 py-2 text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:border-accent resize-none transition-colors"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingNotesId(null)}
                        className="px-4 py-2.5 min-h-[44px] text-xs text-prose-faint hover:text-prose transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleNotesSave(record.id)}
                        disabled={updatingId === record.id}
                        className="px-4 py-2.5 min-h-[44px] bg-stone-700 hover:bg-stone-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded body */}
                {expandedId === record.id && (
                  <div className="border-t border-soft px-4 py-4">
                    {record.subject && (
                      <p className="text-xs text-prose-faint mb-2 break-words">
                        <span className="text-prose-faint font-medium">Subject:</span> {record.subject}
                      </p>
                    )}
                    <pre className="text-xs text-prose-muted whitespace-pre-wrap leading-relaxed font-mono bg-surface-sunken rounded-xl p-3 md:p-4 border border-soft overflow-x-auto">
                      {record.body}
                    </pre>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <button
                        onClick={() => handleCopyHistoryBody(record.body)}
                        className="text-xs text-prose-faint hover:text-accent-text-soft transition-colors"
                      >
                        Copy body
                      </button>
                      <button
                        onClick={() => handleDelete(record.id, record.brand_name)}
                        disabled={updatingId === record.id}
                        className="text-xs text-red-500/80 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        Delete record
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
