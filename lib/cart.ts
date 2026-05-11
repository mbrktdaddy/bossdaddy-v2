// Server-only cart utilities. Never import in client components.
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import type { CartItemWithDetails } from '@/lib/merch'

export const CART_COOKIE = 'bd_cart_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface CartContext {
  cartId: string
  newSessionId?: string
}

export async function getCartSessionId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(CART_COOKIE)?.value ?? null
}

export function buildCartCookie(sessionId: string) {
  return {
    name: CART_COOKIE,
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  }
}

export async function resolveCart(): Promise<CartContext | null> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const sessionId = await getCartSessionId()

  if (user) {
    const { data: userCart } = await admin
      .from('carts').select('id').eq('user_id', user.id).maybeSingle()

    if (userCart) {
      if (sessionId) await mergeAnonIntoUserCart(admin, userCart.id, sessionId)
      return { cartId: userCart.id }
    }

    if (sessionId) {
      const { data: anonCart } = await admin
        .from('carts').select('id').eq('anon_session_id', sessionId).maybeSingle()
      if (anonCart) {
        await admin.from('carts')
          .update({ user_id: user.id, anon_session_id: null })
          .eq('id', anonCart.id)
        return { cartId: anonCart.id }
      }
    }

    const { data: newCart } = await admin
      .from('carts').insert({ user_id: user.id }).select('id').single()
    return newCart ? { cartId: newCart.id } : null
  }

  if (sessionId) {
    const { data: anonCart } = await admin
      .from('carts').select('id').eq('anon_session_id', sessionId).maybeSingle()
    if (anonCart) return { cartId: anonCart.id }
  }

  const newSessionId = crypto.randomUUID()
  const { data: newCart } = await admin
    .from('carts').insert({ anon_session_id: newSessionId }).select('id').single()
  return newCart ? { cartId: newCart.id, newSessionId } : null
}

async function mergeAnonIntoUserCart(
  admin: ReturnType<typeof createAdminClient>,
  userCartId: string,
  sessionId: string,
) {
  const { data: anonCart } = await admin
    .from('carts').select('id').eq('anon_session_id', sessionId).maybeSingle()
  if (!anonCart) return

  const { data: anonItems } = await admin
    .from('cart_items').select('merch_id, variant_id, qty').eq('cart_id', anonCart.id)

  for (const item of anonItems ?? []) {
    const { data: existing } = await admin
      .from('cart_items').select('id, qty')
      .eq('cart_id', userCartId).eq('variant_id', item.variant_id).maybeSingle()

    if (existing) {
      await admin.from('cart_items')
        .update({ qty: Math.min(existing.qty + item.qty, 10) }).eq('id', existing.id)
    } else {
      await admin.from('cart_items').insert({
        cart_id: userCartId,
        merch_id: item.merch_id,
        variant_id: item.variant_id,
        qty: item.qty,
      })
    }
  }

  await admin.from('carts').delete().eq('id', anonCart.id)
}

export async function getCartItems(cartId: string): Promise<CartItemWithDetails[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('cart_items')
    .select(`
      id, cart_id, merch_id, variant_id, qty, created_at, updated_at,
      merch:merch_id ( id, slug, name, image_url, default_image_url ),
      variant:variant_id ( id, merch_id, printful_variant_id, printful_sync_variant_id, size, color, retail_price_cents, weight_g, image_url, in_stock, position, created_at, updated_at )
    `)
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true })

  return (data ?? []) as unknown as CartItemWithDetails[]
}
