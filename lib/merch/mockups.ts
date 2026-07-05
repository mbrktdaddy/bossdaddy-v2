import { createAdminClient } from '@/lib/supabase/admin'
import { createMockupTask, getMockupTask } from '@/lib/printful'

// Generates a realistic product mockup via Printful, then stores it durably in
// our bucket. Printful's mockup_url is a temporary CDN link (expires ~72h), so we
// download and re-host it — otherwise the shop image would rot.

const BUCKET = 'merch-designs'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function generateAndStoreMockups(opts: {
  designId: string
  blank: string
  catalogProductId: number
  variantIds: number[]
  placement: string
  printFileUrl: string
  areaWidth: number
  areaHeight: number
}): Promise<{ mockupUrls: string[] }> {
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

  // Collect every rendered view: the main mockup per garment-color group plus
  // each group's extra angles/lifestyle shots. Dedup + cap so the gallery stays
  // reasonable.
  const sourceUrls: string[] = []
  for (const m of res.mockups ?? []) {
    if (m.mockup_url) sourceUrls.push(m.mockup_url)
    for (const e of m.extra ?? []) if (e.url) sourceUrls.push(e.url)
  }
  const unique = [...new Set(sourceUrls)].slice(0, 10)
  if (unique.length === 0) throw new Error('Printful returned no mockup image.')

  // Re-host each temporary Printful CDN image so the shop links are permanent.
  const admin = createAdminClient()
  const stamp = Math.floor(Date.now() / 1000)
  const stored: string[] = []
  for (let i = 0; i < unique.length; i++) {
    const imgRes = await fetch(unique[i])
    if (!imgRes.ok) continue
    const buf = Buffer.from(await imgRes.arrayBuffer())
    const path = `${opts.designId}/mockup-${opts.blank}-${i}.jpg`
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error(`Mockup upload failed: ${error.message}`)
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
    stored.push(`${data.publicUrl}?v=${stamp}`)
  }
  if (stored.length === 0) throw new Error('Failed to store any mockup images.')

  return { mockupUrls: stored }
}
