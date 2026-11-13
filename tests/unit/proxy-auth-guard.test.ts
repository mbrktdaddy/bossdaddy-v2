import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkAuthGuard } from '@/lib/proxy/auth-guard'

// The logged-out /dashboard bounce must carry the WHOLE target — path and query —
// in `next`. The share-target page (/dashboard/share?url=…) is the case that
// made it matter: Android's share sheet opens the app at that URL, and if the
// author has to sign in first, a `next` that kept only the path would land them
// on an empty share page with the link gone. /login accepts any same-origin
// path (query included) and hard-navigates to it after sign-in.
describe('checkAuthGuard — logged-out /dashboard bounce', () => {
  // A logged-out request never reaches the profile lookup, so no client is needed.
  const supabase = null as unknown as SupabaseClient

  it('keeps the path AND the query string in next', async () => {
    const target = '/dashboard/share?url=https%3A%2F%2Fwww.dewalt.com%2Fproduct%2FDCD791&text=look+at+this'
    const request = new NextRequest(`https://bossdaddy.life${target}`)
    const res = await checkAuthGuard({ request, pathname: '/dashboard/share', supabase, user: null })
    expect(res).not.toBeNull()
    const location = new URL(res!.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('next')).toBe(target)
  })

  it('a plain path stays a plain path', async () => {
    const request = new NextRequest('https://bossdaddy.life/dashboard/reviews')
    const res = await checkAuthGuard({ request, pathname: '/dashboard/reviews', supabase, user: null })
    const location = new URL(res!.headers.get('location')!)
    expect(location.searchParams.get('next')).toBe('/dashboard/reviews')
  })

  it('leaves a public path alone', async () => {
    const request = new NextRequest('https://bossdaddy.life/reviews/some-drill')
    expect(await checkAuthGuard({ request, pathname: '/reviews/some-drill', supabase, user: null })).toBeNull()
  })
})
