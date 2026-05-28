// Anonymous identity for Dad Tools v1.
//
// Used by Weekends Until + kid profile flows for visitors who haven't signed
// up. The cookie is the auth for anonymous rows (kid_profiles, intent events,
// email subs). On signup, claimAnonymousData() migrates rows to the user.

import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

const COOKIE_NAME = 'bd_anon_id'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 // 1 year

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUuid(v: string): boolean {
  return UUID_RE.test(v)
}

export async function getOrCreateAnonymousId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(COOKIE_NAME)?.value
  if (existing && isValidUuid(existing)) return existing

  const fresh = randomUUID()
  store.set(COOKIE_NAME, fresh, {
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  })
  return fresh
}

export async function getAnonymousId(): Promise<string | null> {
  const store = await cookies()
  const existing = store.get(COOKIE_NAME)?.value
  return existing && isValidUuid(existing) ? existing : null
}

export async function clearAnonymousId(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
