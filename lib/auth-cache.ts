import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'

// Per-request cached auth helpers. React `cache()` deduplicates calls within
// a single render so the layout, page, and any nested server components share
// one auth round-trip and one profile query instead of each making their own.
//
// Middleware (proxy.ts) already validates the session before requests reach
// these helpers, so on /dashboard routes `user` is effectively guaranteed.
// `requireUser` / `requireAdmin` add a typed non-null guarantee + redirect.

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  return user
})

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, username, role, display_name, tagline, bio, avatar_url, created_at')
    .eq('id', user.id)
    .single()
  return data
})

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') redirect('/')
  return profile
}
