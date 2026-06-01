'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoSave } from './useAutoSave'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

interface UseContentWorkspaceOptions {
  id: string
  contentType: 'review' | 'guide'
  payload: Record<string, unknown>
  tags: string[]
  isPublished: boolean
  canPublish?: boolean
  publishBlockedReason?: string | null
}

// Shared CRUD + keyboard logic for ReviewWorkspace and GuideWorkspace.
// Accepts the already-computed payload (via useMemo in caller) so it
// always operates on the latest field values without prop-drilling state.
export function useContentWorkspace({
  id,
  contentType,
  payload,
  tags,
  isPublished,
  canPublish = true,
  publishBlockedReason = null,
}: UseContentWorkspaceOptions) {
  const router = useRouter()
  const [busy, setBusy]         = useState(false)
  const [actionErr, setErr]     = useState<string | null>(null)
  const [actionMsg, setMsg]     = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const route = contentType === 'review' ? 'reviews' : 'guides'

  // PUT with a single retry on TRANSIENT failures — network resets
  // (ECONNRESET / "fetch failed") and 5xx. A 4xx is a real validation error, so
  // it's returned without retrying. This recovers the autosave from the kind of
  // transient Supabase connection drop seen under load (e.g. right after a long
  // specs-grade run) instead of surfacing a scary "Save failed".
  const putJson = async (url: string, body: unknown): Promise<Response> => {
    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.status >= 500 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 700))
          continue
        }
        return res
      } catch (err) {
        lastErr = err
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 700))
          continue
        }
        throw err
      }
    }
    throw lastErr
  }

  const save = async (p: Record<string, unknown>) => {
    const [contentRes, tagsRes] = await Promise.all([
      putJson(`/api/${route}/${id}`, p),
      putJson(`/api/${route}/${id}/tags`, { tags }),
    ])
    if (!contentRes.ok) {
      const json = await contentRes.json().catch(() => ({})) as Record<string, string>
      throw new Error(json.error ?? 'Save failed')
    }
    if (!tagsRes.ok) console.warn('Tag save failed — will retry on next save')
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

  async function publishOrUnpublish(action: 'approve' | 'unpublish') {
    if (action === 'approve' && !canPublish) {
      setErr(publishBlockedReason ?? 'Cannot publish yet.')
      return
    }
    setBusy(true); setErr(null); setMsg(null)
    try {
      await save(payload)
      const res = await fetch(`/api/${route}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as Record<string, string>
        throw new Error(json.error ?? 'Action failed')
      }
      setMsg(action === 'approve' ? '✓ Published' : 'Unpublished')
      setTimeout(() => router.refresh(), 600)
    } catch (err) {
      setErr(err instanceof Error ? err.message : 'Action failed')
    }
    setBusy(false)
  }

  async function handleDelete() {
    const label = contentType === 'review' ? 'review' : 'guide'
    if (!confirm(`Delete this ${label} permanently? This cannot be undone.`)) return
    setDeleting(true); setErr(null)
    const res = await fetch(`/api/${route}/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as Record<string, string>
      setErr(json.error ?? 'Delete failed')
      setDeleting(false)
      return
    }
    router.push(`/dashboard/${route}`)
    router.refresh()
  }

  async function handleDuplicate() {
    setBusy(true); setErr(null)
    const res  = await fetch(`/api/${route}/${id}/duplicate`, { method: 'POST' })
    const json = await res.json() as Record<string, { id: string } | string>
    if (!res.ok) {
      setErr((json.error as string | undefined) ?? 'Duplicate failed')
      setBusy(false)
      return
    }
    // Review API returns { review: { id } }; guide API returns { article: { id } }
    const newContent = contentType === 'review'
      ? (json.review as { id: string } | undefined)
      : (json.article as { id: string } | undefined)
    if (newContent?.id) router.push(`/dashboard/${route}/${newContent.id}`)
    router.refresh()
  }

  useKeyboardShortcuts({
    'mod+s':     () => manualSave(),
    'mod+enter': () => { if (!isPublished) void publishOrUnpublish('approve') },
  })

  return {
    busy,
    actionErr,
    actionMsg,
    setMsg,
    deleting,
    autoSave,
    manualSave,
    publishOrUnpublish,
    handleDelete,
    handleDuplicate,
  }
}
