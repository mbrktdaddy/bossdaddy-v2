import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminApi } from '@/lib/auth-cache'
import type { Database } from '@/lib/supabase/database.types'
import { z } from 'zod'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

const Schema = z.object({
  userId: z.string().uuid(),
  // trust  → force trusted, locked (auto-promotion won't touch it)
  // untrust→ force moderated, locked (revoke sticks)
  // auto   → clear the lock; hand back to automatic promotion
  mode: z.enum(['trust', 'untrust', 'auto']),
})

// PUT /api/admin/users/trust — admin only, manually set a user's comment-trust.
//
// `trusted_commenter` otherwise only flips true automatically after 5 approved
// + clean comments (see /api/comments `checkTrustPromotion`) and never back
// down. `trust_locked` (migration 124) records a manual decision so the
// automatic rule can't override it — that's what makes a revoke stick.
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const updates: ProfileUpdate =
    parsed.data.mode === 'trust'   ? { trusted_commenter: true,  trust_locked: true }
    : parsed.data.mode === 'untrust' ? { trusted_commenter: false, trust_locked: true }
    : { trust_locked: false } // 'auto' — clear the lock, leave the flag for auto-promotion

  // User-scoped client so auth.uid() == admin, satisfying the profiles_admin_write
  // RLS policy. Neither column has a change-gating trigger (unlike role /
  // account_status), so a plain admin update is sufficient.
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', parsed.data.userId)

  if (error) return NextResponse.json({ error: 'Trust update failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}
