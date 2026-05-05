import { requireAdmin } from '@/lib/auth-cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Product } from '@/lib/products'
import OutreachWorkspace, { type OutreachRecord } from './_components/OutreachWorkspace'

export const dynamic = 'force-dynamic'

export default async function PressOutreachPage() {
  await requireAdmin()

  const admin = createAdminClient()

  const [{ data: products }, { data: history }] = await Promise.all([
    admin
      .from('products')
      .select('id, name, slug, image_url, category')
      .order('name', { ascending: true }),
    admin
      .from('press_outreach')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  return (
    <OutreachWorkspace
      products={(products ?? []) as Product[]}
      initialHistory={(history ?? []) as OutreachRecord[]}
    />
  )
}
