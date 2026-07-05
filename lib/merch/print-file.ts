import { createAdminClient } from '@/lib/supabase/admin'
import { renderMerchPng, type RenderOpts } from './render'

// Renders a design's print-ready PNG and stores it in the public merch-designs
// bucket, returning the public URL. Printful's POST /files fetches this URL, so
// it must be publicly reachable (the /api/merch/render preview route is admin-
// gated and can't be used for that).

const BUCKET = 'merch-designs'

export async function renderAndStorePrintFile(
  designId: string,
  opts: Omit<RenderOpts, 'mode' | 'garment'>,
): Promise<string> {
  const { buffer } = await renderMerchPng({ ...opts, mode: 'print' })

  const admin = createAdminClient()
  const path = `${designId}/${opts.blank}-${opts.template}-${opts.colorway}.png`
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`Print file upload failed: ${error.message}`)

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
