import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OCCASIONS } from '@/lib/gift-occasions'

// ─────────────────────────────────────────────────────────────────────────────
// Shared social-generation helpers (X Studio Phase 5 convergence)
//
// The three social-gen endpoints — /api/social-posts/generate, /api/claude/
// repurpose, /api/claude/social-copy — used to hand-roll the same admin/author
// gate and the same review/guide/collection source fetch. This module is the one
// place both live so the routes stay thin and can't drift again.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Access gate ─────────────────────────────────────────────────────────────
// X Studio is admin-only as a FEATURE; RLS on the social_* tables stays
// owner-scoped as defense-in-depth. `social-copy` is embedded in the review/
// guide/collection workspaces, so it also allows authors.

type ActorResult =
  | { user: { id: string }; role: string; error: null }
  | { user: null; role: null; error: NextResponse }

export async function requireSocialActor(
  supabase: SupabaseClient,
  opts: { authorsAllowed?: boolean } = {},
): Promise<ActorResult> {
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return { user: null, role: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const allowed = role === 'admin' || (opts.authorsAllowed === true && role === 'author')
  if (!allowed) {
    return { user: null, role: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, role, error: null }
}

// ─── Source fetch ────────────────────────────────────────────────────────────

export type GenSourceType = 'review' | 'guide' | 'collection'

export interface GenSource {
  type: GenSourceType
  title: string
  category: string | null
  /** review-only */
  productName: string | null
  /** review-only, out of 10 */
  rating: number | null
  excerpt: string | null
  /** HTML stripped to plain text (uncapped — callers slice to their token budget). */
  bodyText: string
  /** Absolute public URL of the source. */
  url: string
}

// Public URL segment per collection type — mirrors getPublicPath() in
// CollectionWorkspace.tsx and the revalidate mapping in the picks PATCH route.
export function collectionPublicPath(type: string | null, slug: string, occasion: string | null): string {
  if (type === 'gift_guide') {
    const occ = OCCASIONS.find((o) => o.value === occasion)
    return occ ? `/gifts/${occ.slug}` : `/picks/${slug}`
  }
  if (type === 'comparison') return `/comparisons/${slug}`
  if (type === 'stack')      return `/stacks/${slug}`
  return `/picks/${slug}` // general, best_of
}

function stripHtml(html: unknown): string {
  return typeof html === 'string'
    ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : ''
}

/**
 * Fetch a review / guide / collection by id and normalize it for prompt-building.
 * Uses the service-role client (admin support path) so drafts + private rows
 * resolve regardless of the caller's RLS scope. Returns null when not found.
 */
export async function fetchGenSource(
  sourceType: GenSourceType,
  sourceId: string,
): Promise<GenSource | null> {
  const admin = createAdminClient()
  const table = sourceType === 'review' ? 'reviews' : sourceType === 'collection' ? 'collections' : 'guides'
  // Collections alias description→excerpt and intro_html→content so the
  // normalized shape stays content-type-agnostic.
  const fields =
    sourceType === 'review'
      ? 'title, product_name, category, excerpt, content, rating, slug'
      : sourceType === 'collection'
      ? 'title, excerpt:description, content:intro_html, slug, collection_type, occasion'
      : 'title, category, excerpt, content, slug'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any).from(table).select(fields).eq('id', sourceId).single()
  if (!data) return null

  const src = data as Record<string, string | number | null>
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const url =
    sourceType === 'collection'
      ? `${siteUrl}${collectionPublicPath(src.collection_type as string | null, String(src.slug ?? ''), src.occasion as string | null)}`
      : `${siteUrl}/${sourceType}s/${src.slug}`

  return {
    type: sourceType,
    title: String(src.title ?? ''),
    category: (src.category as string | null) ?? null,
    productName: (src.product_name as string | null) ?? null,
    rating: typeof src.rating === 'number' ? src.rating : null,
    excerpt: (src.excerpt as string | null) ?? null,
    bodyText: stripHtml(src.content),
    url,
  }
}
