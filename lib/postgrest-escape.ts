/**
 * Sanitize a user-supplied search term before interpolating it into a
 * PostgREST `.or()` / `.ilike()` filter string.
 *
 * supabase-js does NOT parameterize `.or()` — the argument is literal PostgREST
 * filter syntax. Unsanitized input lets a caller inject extra conditions
 * (e.g. `,id.neq.<uuid>`) and turn a scoped search into a full-table dump
 * (CWE-943), or smuggle LIKE wildcards to scan the whole table. Strip the
 * characters PostgREST treats as delimiters/grouping plus the `%` wildcard,
 * collapsing them to spaces.
 *
 * This is the shared version of the fix first proven inline in
 * app/(public)/search/page.tsx — route every `.or()` that interpolates user
 * input through here.
 */
export function escapePostgrestLike(term: string): string {
  return term.replace(/[%,()\\]/g, ' ').trim()
}

/** Sanitized term wrapped as a contains-LIKE pattern (`%term%`). */
export function likePattern(term: string): string {
  return `%${escapePostgrestLike(term)}%`
}
