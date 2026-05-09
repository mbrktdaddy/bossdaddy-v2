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

  const save = async (p: Record<string, unknown>) => {
    const [contentRes, tagsRes] = await Promise.all([
      fetch(`/api/${route}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      }),
      fetch(`/api/${route}/${id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      }),
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
