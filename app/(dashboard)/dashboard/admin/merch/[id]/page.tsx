import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import type { Merch } from '@/lib/merch'
import { MerchForm } from '../_components/MerchForm'

export const dynamic = 'force-dynamic'

export default async function AdminMerchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  await requireAdmin()

  const isNew = id === 'new'
  let item: Merch | null = null

  if (!isNew) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('merch')
      .select('*')
      .eq('id', id)
      .single()
    if (!data) notFound()
    item = data as Merch
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href="/dashboard/admin/merch"
        className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mb-6"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All merch items
      </Link>

      <h1 className="text-2xl font-black mb-1">
        {isNew ? 'New merch item' : item!.name}
      </h1>
      <p className="text-gray-500 text-sm mb-8">
        {isNew
          ? 'Add a new piece of branded merch — start with status "Coming soon" to show a Notify me card.'
          : 'Edit this merch item.'}
      </p>

      <MerchForm item={item} />
    </div>
  )
}
