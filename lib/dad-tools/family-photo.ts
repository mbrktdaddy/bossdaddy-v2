// Shared, non-action helpers for family members (internally `kid_profiles`).
//
// This module exists because `lib/dad-tools/kid-actions.ts` is a `'use server'`
// file, and those may only export async functions — so a plain constant or a
// pure helper cannot live there. That restriction is why `KID_COLUMNS` had been
// copy-pasted into four files; it now has one home.

/**
 * Columns every family-member surface selects. Keep this the single definition:
 * a select list that drifts between call sites is how a column ends up missing
 * on one page and present on another.
 */
export const KID_COLUMNS =
  'id, name, birthdate, member_type, photo_path, money_balance, money_monthly, money_target, money_return_rate, created_at, updated_at'

/**
 * The `src` for a family member's photo, or null when there isn't one.
 *
 * Photos live in the PRIVATE `family-photos` bucket (migration 151), so there
 * is no durable URL to store — signed ones expire in a minute. The row records
 * a storage path and every render site points at this owner-gated route, which
 * re-checks ownership and 302s to a freshly signed URL.
 *
 * Do not be tempted to store or cache the signed URL: it is a bearer credential
 * for a photograph of someone's child, and the whole point of the 60-second TTL
 * is that a leaked one stops working.
 */
export function familyPhotoSrc(kid: { id: string; photo_path: string | null }): string | null {
  return kid.photo_path ? `/api/kids/${kid.id}/photo` : null
}
