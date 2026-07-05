import { type NextRequest, NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { renderMerchPng } from '@/lib/merch/render'
import { MERCH_TEMPLATES, MERCH_COLORWAYS, type MerchTemplate, type MerchColorway } from '@/lib/merch/templates'
import { type MerchBlank } from '@/lib/merch/printful-catalog'

// Node runtime so we can read the TTF/logo files from disk (Satori needs raw
// font buffers; edge can't do fs).
export const runtime = 'nodejs'

async function requireAdmin() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const sp = request.nextUrl.searchParams
  const template = (MERCH_TEMPLATES.includes(sp.get('template') as MerchTemplate)
    ? sp.get('template')
    : 'statement') as MerchTemplate
  const colorway = (MERCH_COLORWAYS.includes(sp.get('colorway') as MerchColorway)
    ? sp.get('colorway')
    : 'dark') as MerchColorway
  const blank = (['tee', 'hat', 'mug'].includes(sp.get('blank') as MerchBlank)
    ? sp.get('blank')
    : 'tee') as MerchBlank
  const mode = sp.get('mode') === 'print' ? 'print' : 'preview'

  const { buffer } = await renderMerchPng({
    template,
    colorway,
    blank,
    mode,
    text: (sp.get('text') ?? '').slice(0, 200),
    subline: (sp.get('subline') ?? '').slice(0, 200),
    garment: sp.get('garment') ?? undefined,
  })

  // Admin-only, ephemeral — don't let CDNs cache design iterations.
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      ...(mode === 'print'
        ? { 'Content-Disposition': `attachment; filename="${blank}-${template}-${colorway}.png"` }
        : {}),
    },
  })
}
