'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * The signed-in user's id — null until resolved, or when logged out.
 *
 * Uses `onAuthStateChange` exactly like the Header: INITIAL_SESSION fires
 * synchronously from the browser client's local session storage (no network),
 * so ownership-gated UI resolves in the first frame with no flash and without
 * forcing the host page to render dynamically (audit H3).
 *
 * This is a DISPLAY gate only — the API route + RLS (migration 123) enforce
 * ownership for real, so relying on the unvalidated local session here is safe.
 */
export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return userId
}
