import { createAdminClient } from '@/lib/supabase/admin'
import { createMockupTask, getMockupTask } from '@/lib/printful'

// Generates a realistic product mockup via Printful, then stores it durably in
// our bucket. Printful's mockup_url is a temporary CDN link (expires ~72h), so we
// download and re-host it — otherwise the shop image would rot.

const BUCKET = 'merch-designs'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function generateAndStoreMockup(opts: {
  designId: string
  blank: string
  catalogProductId: number
  variantIds: number[]
  placement: string
  printFileUrl: string
  areaWidth: number
  areaHeight: number
}): Promise<{ mockupUrl: string; sourceUrl: string }> {
  // Our print file is rendered at exactly the placement's printfile size, so it
  // fills the whole print area (top/left 0, full width/height).
  const position = {
    area_width: opts.areaWidth,
    area_height: opts.areaHeight,
    width: opts.areaWidth,
    height: opts.areaHeight,
    top: 0,
    left: 0,
  }
  const task = await createMockupTask(opts.catalogProductId, {
    variant_ids: opts.variantIds,
    format: 'jpg',
    files: [{ placement: opts.placement, image_url: opts.printFileUrl, position }],
  })

  // Poll until the render completes. Mockups typically finish in 5–20s; bound the
  // loop to stay within the route's maxDuration.
  let res = await getMockupTask(task.task_key)
  for (let i = 0; i < 18 && res.status !== 'completed'; i++) {
    if (res.status === 'failed') throw new Error(res.error || 'Mockup task failed')
    await sleep(2500)
    res = await getMockupTask(task.task_key)
  }
  if (res.status !== 'completed') throw new Error('Mockup generation timed out — try again in a minute.')

  const sourceUrl = res.mockups?.[0]?.mockup_url
  if (!sourceUrl) throw new Error('Printful returned no mockup image.')

  // Re-host the temporary Printful CDN image so the shop link is permanent.
  const imgRes = await fetch(sourceUrl)
  if (!imgRes.ok) throw new Error(`Mockup download failed (${imgRes.status})`)
  const buf = Buffer.from(await imgRes.arrayBuffer())

  const admin = createAdminClient()
  const path = `${opts.designId}/mockup-${opts.blank}.jpg`
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Mockup upload failed: ${error.message}`)

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  // Cache-bust so a regenerated mockup at the same path refreshes in the shop.
  return { mockupUrl: `${data.publicUrl}?v=${Math.floor(Date.now() / 1000)}`, sourceUrl }
}
