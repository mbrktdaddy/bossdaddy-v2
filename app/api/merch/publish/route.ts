import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getMerchDesign, updateMerchDesign } from '@/lib/merch/designs-store'
import { renderAndStorePrintFile } from '@/lib/merch/print-file'
import { MERCH_CATALOG } from '@/lib/merch/printful-catalog'
import { getCatalogProduct, createSyncProduct } from '@/lib/printful'

export const runtime = 'nodejs'
// Rendering a 1800×2400 print file + Printful round-trips can exceed the default.
export const maxDuration = 60

async function requireAdmin() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

const BodySchema = z.object({
  designId: z.string().uuid(),
  blank: z.enum(['tee', 'hat', 'mug']),
  template: z.enum(['statement', 'stacked', 'wordmark', 'logo']),
  colorway: z.enum(['dark', 'light']),
  priceCents: z.number().int().min(100).max(1_000_000),
  sizes: z.array(z.string().max(20)).optional(),
  force: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const { designId, blank, template, colorway, priceCents, sizes, force } = parsed.data

  const spec = MERCH_CATALOG[blank]
  if (!spec.publishable || !spec.catalogProductId) {
    return NextResponse.json({ error: `${spec.label} isn't publishable yet (embroidery/other pipeline pending).` }, { status: 400 })
  }

  const design = await getMerchDesign(designId)
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })
  if (design.status === 'published' && design.printful_sync_product_id && !force) {
    return NextResponse.json({ error: 'Already published. Pass force to re-publish.', syncProductId: design.printful_sync_product_id }, { status: 409 })
  }

  const content = design.content as { text?: string; subline?: string }
  const text = (content.text ?? design.title).trim()
  // A mug is white regardless of colorway; render its art on the light colorway so
  // the ink contrasts the white surface.
  const effectiveColorway = blank === 'mug' ? 'light' : colorway

  try {
    // 1) Render the print-ready PNG and store it at a public URL Printful can fetch.
    const printFileUrl = await renderAndStorePrintFile(designId, {
      template,
      colorway: effectiveColorway,
      blank,
      text,
      subline: content.subline ?? '',
    })

    // 2) Resolve the concrete catalog variant ids for the chosen colors + sizes.
    const targetSizes = sizes && sizes.length ? sizes : spec.sizes
    const targetColors = spec.garmentColors[effectiveColorway]
    const { variants } = await getCatalogProduct(spec.catalogProductId)
    const chosen = variants.filter(
      (v) => targetColors.includes(v.color) && targetSizes.includes(v.size),
    )
    if (chosen.length === 0) {
      return NextResponse.json(
        { error: `No matching Printful variants for ${targetColors.join('/')} × ${targetSizes.join('/')}.` },
        { status: 502 },
      )
    }

    // 3) Create the store sync product (lands as a draft; merch:sync brings it live).
    const retail = (priceCents / 100).toFixed(2)
    const created = await createSyncProduct({
      sync_product: {
        name: design.title,
        thumbnail: printFileUrl,
        // Printful caps external_id at 32 chars; a uuid sans dashes is exactly 32.
        external_id: designId.replace(/-/g, ''),
      },
      sync_variants: chosen.map((v) => ({
        variant_id: v.id,
        retail_price: retail,
        files: [{ type: spec.placement, url: printFileUrl }],
      })),
    })

    // 4) Record the link back on the design.
    await updateMerchDesign(designId, {
      status: 'published',
      print_file_url: printFileUrl,
      printful_sync_product_id: created.sync_product.id,
      template_key: template,
      template_config: { colorway, blank } as unknown as Record<string, unknown>,
    })

    return NextResponse.json({
      ok: true,
      syncProductId: created.sync_product.id,
      variantCount: chosen.length,
      printFileUrl,
      next: 'Run `npm run merch:sync` to pull it into the shop, then set it available in Merch admin.',
    })
  } catch (err) {
    console.error('[merch/publish] failed', err)
    return NextResponse.json({ error: `Publish failed: ${(err as Error).message}` }, { status: 502 })
  }
}
