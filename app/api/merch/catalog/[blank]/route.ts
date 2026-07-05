import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { MERCH_CATALOG, type MerchBlank } from '@/lib/merch/printful-catalog'
import { getCatalogProduct } from '@/lib/printful'

export const runtime = 'nodejs'

async function requireAdmin() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

// Available colors/sizes rarely change; cache per blank for the process lifetime.
const cache = new Map<string, { colors: string[]; sizes: string[] }>()

export async function GET(_request: NextRequest, { params }: { params: Promise<{ blank: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { blank } = await params
  if (!['tee', 'hat', 'mug'].includes(blank)) {
    return NextResponse.json({ error: 'Unknown blank' }, { status: 400 })
  }
  const spec = MERCH_CATALOG[blank as MerchBlank]
  if (!spec.catalogProductId) {
    return NextResponse.json({ error: `${spec.label} has no catalog product wired.` }, { status: 400 })
  }

  const defaults = {
    // The colorway-appropriate defaults; the UI preselects these.
    colorsDark: spec.garmentColors.dark,
    colorsLight: spec.garmentColors.light,
    sizes: spec.sizes,
  }

  try {
    let opts = cache.get(blank)
    if (!opts) {
      const { variants } = await getCatalogProduct(spec.catalogProductId)
      const inStock = variants.filter((v) => v.in_stock !== false)
      opts = {
        colors: [...new Set(inStock.map((v) => v.color))].sort(),
        sizes: [...new Set(inStock.map((v) => v.size))],
      }
      cache.set(blank, opts)
    }
    return NextResponse.json({ ...opts, defaults })
  } catch (err) {
    return NextResponse.json({ error: `Catalog lookup failed: ${(err as Error).message}` }, { status: 502 })
  }
}
