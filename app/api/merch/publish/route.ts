import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getMerchDesign, updateMerchDesign, type PublishedEntry } from '@/lib/merch/designs-store'
import { renderAndStorePrintFile } from '@/lib/merch/print-file'
import { MERCH_CATALOG } from '@/lib/merch/printful-catalog'
import { getCatalogProduct, createSyncProduct } from '@/lib/printful'

export const runtime = 'nodejs'
// Rendering a full-res print file + Printful round-trips can exceed the default.
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
  colors: z.array(z.string().max(40)).optional(),
  sizes: z.array(z.string().max(20)).optional(),
  force: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const rl = await checkRateLimit(auth.user.id, 'merch-publish')
  if (!rl.success) return NextResponse.json({ error: 'Rate limit reached. Try again later.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const { designId, blank, template, colorway, priceCents, colors, sizes, force } = parsed.data

  const spec = MERCH_CATALOG[blank]
  if (!spec.publishable || !spec.catalogProductId) {
    return NextResponse.json({ error: `${spec.label} isn't publishable yet (embroidery/other pipeline pending).` }, { status: 400 })
  }

  const design = await getMerchDesign(designId)
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  // Guard per-blank, not globally — one saying can become a tee AND a mug, but
  // re-publishing the SAME blank is blocked unless forced (avoids duplicates).
  const existing = (design.published ?? []).find((e) => e.blank === blank)
  if (existing && !force) {
    return NextResponse.json(
      { error: `Already published as a ${spec.label}. Re-publish to replace.`, syncProductId: existing.sync_product_id },
      { status: 409 },
    )
  }

  const content = design.content as { text?: string; subline?: string }
  const text = (content.text ?? design.title).trim()
  // A mug is white regardless of colorway; render its art on the light colorway
  // so the ink contrasts the white surface.
  const effectiveColorway = blank === 'mug' ? 'light' : colorway

  const targetColors = colors && colors.length ? colors : spec.garmentColors[effectiveColorway]
  const targetSizes = sizes && sizes.length ? sizes : spec.sizes

  try {
    // 1) Render the print-ready PNG and store it at a public URL Printful can fetch.
    const printFileUrl = await renderAndStorePrintFile(designId, {
      template,
      colorway: effectiveColorway,
      blank,
      text,
      subline: content.subline ?? '',
    })

    // 2) Resolve concrete, in-stock catalog variant ids for the chosen colors + sizes.
    const { variants } = await getCatalogProduct(spec.catalogProductId)
    const chosen = variants.filter(
      (v) => v.in_stock !== false && targetColors.includes(v.color) && targetSizes.includes(v.size),
    )
    if (chosen.length === 0) {
      return NextResponse.json(
        { error: `No available Printful variants for ${targetColors.join('/')} × ${targetSizes.join('/')}.` },
        { status: 502 },
      )
    }

    // 3) Create the store sync product (lands as a draft; merch:sync brings it live).
    const retail = (priceCents / 100).toFixed(2)
    const created = await createSyncProduct({
      sync_product: {
        name: design.title,
        thumbnail: printFileUrl,
        // Printful caps external_id at 32 chars; uuid + blank tag, then trimmed.
        external_id: `${designId.replace(/-/g, '')}`.slice(0, 24) + `-${blank}`,
      },
      sync_variants: chosen.map((v) => ({
        variant_id: v.id,
        retail_price: retail,
        files: [{ type: spec.placement, url: printFileUrl }],
      })),
    })

    // 4) Record the published product on the design (per-blank entry).
    const entry: PublishedEntry = {
      blank,
      template,
      colorway: effectiveColorway,
      sync_product_id: created.id,
      print_file_url: printFileUrl,
      colors: targetColors,
      sizes: targetSizes,
      price_cents: priceCents,
      published_at: new Date().toISOString(),
    }
    const nextPublished = [...(design.published ?? []).filter((e) => e.blank !== blank), entry]

    try {
      await updateMerchDesign(designId, {
        status: 'published',
        print_file_url: printFileUrl,
        printful_sync_product_id: created.id,
        template_key: template,
        template_config: { colorway: effectiveColorway, blank } as unknown as Record<string, unknown>,
        published: nextPublished,
      })
    } catch (dbErr) {
      // The Printful product WAS created — surface the id so the operator isn't
      // left with a silent orphan.
      console.error('[merch/publish] product created but DB update failed', dbErr)
      return NextResponse.json({
        ok: true,
        syncProductId: created.id,
        variantCount: chosen.length,
        warning: `Product created on Printful (#${created.id}) but saving to the design failed — record the id manually. ${(dbErr as Error).message}`,
      })
    }

    return NextResponse.json({
      ok: true,
      syncProductId: created.id,
      variantCount: chosen.length,
      printFileUrl,
      next: 'Run `npm run merch:sync` to pull it into the shop, then set it available in Merch admin.',
    })
  } catch (err) {
    console.error('[merch/publish] failed', err)
    return NextResponse.json({ error: `Publish failed: ${(err as Error).message}` }, { status: 502 })
  }
}
