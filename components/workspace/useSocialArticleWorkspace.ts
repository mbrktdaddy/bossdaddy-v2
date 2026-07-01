'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoSave } from './useAutoSave'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

interface UseSocialArticleWorkspaceOptions {
  id: string
  /** Autosaved content payload — every field EXCEPT status (status is a separate
   *  action, mirroring the content-vs-publish split in the other workspaces). */
  payload: Record<string, unknown>
  status: string
  /** Called after any successful save/PATCH with the route's JSON
   *  ({ article, x_html, dropped }) so the editor can refresh the X preview and
   *  the status pill without re-fetching. */
  onSaved?: (data: { article?: Record<string, unknown>; x_html?: string; dropped?: unknown }) => void
}

// X Article workspace logic — the social_articles analogue of
// useCollectionWorkspace. Persists via PATCH /api/social-articles/[id] (partial
// payload) and moves through a draft → ready → posted status via setStatus rather
// than an is_visible flag or a review-style action endpoint. Shares the same
// useAutoSave + useKeyboardShortcuts primitives as the other workspaces.
export function useSocialArticleWorkspace({
  id,
  payload,
  status,
  onSaved,
}: UseSocialArticleWorkspaceOptions) {
  const router = useRouter()
  const [busy, setBusy]         = useState(false)
  const [actionErr, setErr]     = useState<string | null>(null)
  const [actionMsg, setMsg]     = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const patchJson = async (body: unknown): Promise<Response> => {
    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`/api/social-articles/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.status >= 500 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 700)); continue
        }
        return res
      } catch (err) {
        lastErr = err
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 700)); continue }
        throw err
      }
    }
    throw lastErr
  }

  const save = async (p: Record<string, unknown>) => {
    const res = await patchJson(p)
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as Record<string, string>
      throw new Error(json.error ?? 'Save failed')
    }
    const json = await res.json().catch(() => ({}))
    onSaved?.(json)
  }

  const autoSave = useAutoSave({ data: payload, saveFn: save, delay: 20000 })

  async function manualSave() {
    setErr(null); setMsg(null)
    try {
      await autoSave.triggerSave()
      setMsg('Saved')
      setTimeout(() => setMsg(null), 2000)
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Save failed')
    }
  }

  // Move the article's status. Flush the latest content first so the persisted
  // body matches the status transition, then PATCH the new status.
  async function setStatus(next: 'draft' | 'ready' | 'posted') {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await autoSave.triggerSave()
      const res = await patchJson({ status: next })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as Record<string, string>
        throw new Error(json.error ?? 'Action failed')
      }
      const json = await res.json().catch(() => ({}))
      onSaved?.(json)
      setMsg(next === 'ready' ? '✓ Marked ready' : next === 'posted' ? '✓ Marked posted' : 'Back to draft')
      setTimeout(() => setMsg(null), 2000)
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Action failed')
    }
    setBusy(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this article permanently? This cannot be undone.')) return
    setDeleting(true); setErr(null)
    const res = await fetch(`/api/social-articles/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as Record<string, string>
      setErr(json.error ?? 'Delete failed')
      setDeleting(false)
      return
    }
    router.push('/dashboard/social')
    router.refresh()
  }

  useKeyboardShortcuts({
    'mod+s':     () => manualSave(),
    'mod+enter': () => { if (status === 'draft') void setStatus('ready') },
  })

  return { busy, actionErr, actionMsg, setMsg, deleting, autoSave, manualSave, setStatus, handleDelete }
}
