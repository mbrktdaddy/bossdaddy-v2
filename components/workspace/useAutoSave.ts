'use client'

import { useEffect, useRef, useState } from 'react'
import type { SaveState } from './AutoSaveIndicator'

interface UseAutoSaveOptions<T> {
  data: T
  saveFn: (data: T) => Promise<void>
  delay?: number
  enabled?: boolean
}

export function useAutoSave<T>({ data, saveFn, delay = 30000, enabled = true }: UseAutoSaveOptions<T>) {
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)

  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSerialized  = useRef<string>(JSON.stringify(data))
  const saveFnRef       = useRef(saveFn)
  const dataRef         = useRef(data)
  const stateRef        = useRef<SaveState>('idle')

  // Keep refs fresh on every render
  useEffect(() => { saveFnRef.current = saveFn }, [saveFn])
  useEffect(() => { dataRef.current = data }, [data])

  function setStateTracked(s: SaveState) {
    stateRef.current = s
    setState(s)
  }

  async function trigger() {
    if (!enabled) return
    setStateTracked('saving')
    setError(null)
    try {
      await saveFnRef.current(dataRef.current)
      lastSerialized.current = JSON.stringify(dataRef.current)
      setStateTracked('saved')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setStateTracked('error')
    }
  }

  // Debounce dirty-state timer
  useEffect(() => {
    if (!enabled) return
    const serialized = JSON.stringify(data)
    if (serialized === lastSerialized.current) return

    setStateTracked('dirty')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { trigger() }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, enabled, delay])

  // Warn the user if they try to close the tab with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (stateRef.current === 'dirty') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Best-effort fire-and-forget save when the workspace unmounts dirty
  useEffect(() => {
    return () => {
      if (stateRef.current === 'dirty' && enabled) {
        saveFnRef.current(dataRef.current).catch(() => { /* best effort */ })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, error, triggerSave: trigger }
}
