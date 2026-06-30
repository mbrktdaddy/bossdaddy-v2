'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoSave } from './useAutoSave'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

interface UseCollectionWorkspaceOptions {
  id: string
  /** Autosaved content payload — every field EXCEPT is_visible (visibility is a
   *  separate publish action, mirroring reviews/guides' status-vs-content split). */
  payload: Record<string, unknown>
  isVisible: boolean
  canPublish?: boolean
  publishBlockedReason?: string | null
  /** Called after a successful publish/unpublish so the caller can sync its
   *  local `visible` state (and thus the StatusBadge + toolbar). */
  onVisibilityChange?: (visible: boolean) => void
}

// Collections ("picks") workspace logic — the collections analogue of
// useContentWorkspace. Collections persist via PATCH /api/admin/picks/[id]
// (partial payload with the item list baked in) and publish via an is_visible
// flag rather than a status-action endpoint, so they can't reuse the
// review/guide hook directly — but they share the same useAutoSave +
// useKeyboardShortcuts primitives, which is where the real UX lives.
export function useCollectionWorkspace({
  id,
  payload,
  isVisible,
  canPublish = true,
  publishBlockedReason = null,
  onVisibilityChange,
}: UseCollectionWorkspaceOptions) {
  const router = useRouter()
  const [busy, setBusy]         = useState(false)
  const [actionErr, setErr]     = useState<string | null>(null)
  const [actionMsg, setMsg]     = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // PATCH with one retry on TRANSIENT failures (5xx / network drop). A 4xx is a
  // real validation error, surfaced as-is. Mirrors the reviews/guides putJson.
  const patchJson = async (body: unknown): Promise<Response> => {
    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`/api/admin/picks/${id}`, {
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

  // Publish / unpublish: flush the latest content + items first (so the server's
  // publish gate counts the current items), then flip is_visible in a minimal
  // PATCH. is_visible is deliberately NOT part of the autosaved payload.
  async function setVisibility(nextVisible: boolean) {
    if (nextVisible && !canPublish) {
      setErr(publishBlockedReason ?? 'Cannot publish yet.')
      return
    }
    setBusy(true); setErr(null); setMsg(null)
    try {
      await autoSave.triggerSave()
      const res = await patchJson({ is_visible: nextVisible })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as Record<string, string>
        throw new Error(json.error ?? 'Action failed')
      }
      onVisibilityChange?.(nextVisible)
      setMsg(nextVisible ? '✓ Published' : 'Unpublished')
      setTimeout(() => router.refresh(), 600)
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Action failed')
    }
    setBusy(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this collection permanently? This cannot be undone.')) return
    setDeleting(true); setErr(null)
    const res = await fetch(`/api/admin/picks/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as Record<string, string>
      setErr(json.error ?? 'Delete failed')
      setDeleting(false)
      return
    }
    router.push('/dashboard/admin/picks')
    router.refresh()
  }

  useKeyboardShortcuts({
    'mod+s':     () => manualSave(),
    'mod+enter': () => { if (!isVisible) void setVisibility(true) },
  })

  return { busy, actionErr, actionMsg, setMsg, deleting, autoSave, manualSave, setVisibility, handleDelete }
}
