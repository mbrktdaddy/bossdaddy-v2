'use client'

import { useEffect, useRef, useState } from 'react'
import type { SaveState } from './AutoSaveIndicator'

interface UseAutoSaveOptions<T> {
  data: T
  saveFn: (data: T) => Promise<void>
  delay?: number
  enabled?: boolean
}

/**
 * Debounced auto-save hook. Watches `data`, triggers `saveFn` after `delay` ms
 * of inactivity. Exposes current save state and a manual trigger.
 */
export function useAutoSave<T>({ data, saveFn, delay = 30000, enabled = true }: UseAutoSaveOptions<T>) {
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSerialized = useRef<string>(JSON.stringify(data))
  const saveFnRef = useRef(saveFn)

  // Keep saveFn ref fresh without re-triggering effect
  useEffect(() => { saveFnRef.current = saveFn }, [saveFn])

  async function trigger() {
    if (!enabled) return
    setState('saving')
    setError(null)
    try {
      await saveFnRef.current(data)
      lastSerialized.current = JSON.stringify(data)
      setState('saved')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setState('error')
    }
  }

  useEffect(() => {
    if (!enabled) return
    const serialized = JSON.stringify(data)
    if (serialized === lastSerialized.current) return

    setState('dirty')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { trigger() }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, enabled, delay])

  return { state, error, triggerSave: trigger }
}
