import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { PickForm } from '../_components/PickForm'

export const dynamic = 'force-dynamic'

export default async function EditPickPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin()

  const admin = createAdminClient()
  const [{ data: pick }, { data: items }] = await Promise.all([
    admin.from('collections').select('*').eq('id', id).single(),
    admin.from('collection_items')
      .select('id, review_id, position, blurb, reviews(id, slug, title, product_name, rating, image_url)')
      .eq('collection_id', id)
      .order('position'),
  ])

  if (!pick) notFound()

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/dashboard/admin/picks" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← All Lists
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-black">{pick.title}</h1>
          {pick.is_visible && (
            <Link
              href={`/picks/${pick.slug}`}
              target="_blank"
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              View live →
            </Link>
          )}
        </div>
      </div>
      <PickForm pick={pick} initialItems={items ?? []} />
    </div>
  )
}
