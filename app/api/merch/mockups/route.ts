import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { getMerchDesign, updateMerchDesign } from '@/lib/merch/designs-store'
import { MERCH_CATALOG } from '@/lib/merch/printful-catalog'
import { getCatalogProduct } from '@/lib/printful'
import { generateAndStoreMockup } from '@/lib/merch/mockups'
import { resolvePrintfileDims } from '@/lib/merch/printfile-dims'

export const runtime = 'nodejs'
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
})

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const rl = await checkRateLimit(auth.user.id, 'merch-publish')
  if (!rl.success) return NextResponse.json({ error: 'Rate limit reached. Try again later.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const { designId, blank } = parsed.data

  const spec = MERCH_CATALOG[blank]
  if (!spec.catalogProductId) return NextResponse.json({ error: 'Blank not wired.' }, { status: 400 })

  const design = await getMerchDesign(designId)
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })
  const entry = (design.published ?? []).find((e) => e.blank === blank)
  if (!entry) return NextResponse.json({ error: `Publish the ${spec.label} first.` }, { status: 400 })

  try {
    // Re-resolve the same variant ids this product was published with.
    const { variants } = await getCatalogProduct(spec.catalogProductId)
    const variantIds = variants
      .filter((v) => v.in_stock !== false && entry.colors.includes(v.color) && entry.sizes.includes(v.size))
      .map((v) => v.id)
    if (variantIds.length === 0) return NextResponse.json({ error: 'No variants to render.' }, { status: 502 })

    // Same real print-area dims the print file was rendered at → position matches.
    const dims = await resolvePrintfileDims(blank)
    const { mockupUrl } = await generateAndStoreMockup({
      designId,
      blank,
      catalogProductId: spec.catalogProductId,
      variantIds,
      placement: spec.placement,
      printFileUrl: entry.print_file_url,
      areaWidth: dims.width,
      areaHeight: dims.height,
    })

    // Persist the mockup on the design's published entry.
    const nextPublished = (design.published ?? []).map((e) =>
      e.blank === blank ? { ...e, mockups: [mockupUrl] } : e,
    )
    await updateMerchDesign(designId, { published: nextPublished })

    // If merch:sync has already created the shop row, apply the mockup as its
    // image so the shop shows a real product (API products have no Printful
    // preview file, so this is the only good image). image_url is the override
    // that survives future syncs.
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('merch')
      .update({ image_url: mockupUrl, default_image_url: mockupUrl, images: [mockupUrl], enabled_images: [mockupUrl] })
      .eq('printful_sync_product_id', entry.sync_product_id)
      .select('id')
    const appliedToShop = !!rows?.length

    return NextResponse.json({
      ok: true,
      mockupUrl,
      appliedToShop,
      next: appliedToShop
        ? 'Mockup applied to the shop product.'
        : 'Mockup saved. Run `npm run merch:sync` to create the shop row, then regenerate to apply it.',
    })
  } catch (err) {
    console.error('[merch/mockups] failed', err)
    return NextResponse.json({ error: `Mockup failed: ${(err as Error).message}` }, { status: 502 })
  }
}

const BUCKET = 'merch-designs'

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const { designId, blank } = parsed.data

  const design = await getMerchDesign(designId)
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })
  const entry = (design.published ?? []).find((e) => e.blank === blank)

  const admin = createAdminClient()

  // Remove the stored mockup file(s) for this blank.
  await admin.storage.from(BUCKET).remove([`${designId}/mockup-${blank}.jpg`]).catch(() => {})

  // Clear the mockup off the design's published entry.
  const nextPublished = (design.published ?? []).map((e) =>
    e.blank === blank ? { ...e, mockups: [] } : e,
  )
  await updateMerchDesign(designId, { published: nextPublished })

  // Revert the shop row image back to the bare print file (the mockup had
  // overwritten image_url / default_image_url / images / enabled_images).
  if (entry) {
    await admin
      .from('merch')
      .update({
        image_url: null,
        default_image_url: entry.print_file_url,
        images: [],
        enabled_images: [],
      })
      .eq('printful_sync_product_id', entry.sync_product_id)
  }

  return NextResponse.json({ ok: true })
}
