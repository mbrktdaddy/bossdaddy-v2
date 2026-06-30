import Link from 'next/link'
import { requireAdmin } from '@/lib/auth-cache'
import { NewCollectionForm } from '../_components/NewCollectionForm'

export const dynamic = 'force-dynamic'

export default async function NewPickPage() {
  await requireAdmin()
  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/dashboard/admin/picks" className="text-xs text-prose-faint hover:text-prose transition-colors">
          ← All collections
        </Link>
        <h1 className="text-2xl font-black mt-2">New collection</h1>
        <p className="text-sm text-prose-faint mt-1">Name it and pick a type — you&apos;ll add picks and everything else next.</p>
      </div>
      <NewCollectionForm />
    </div>
  )
}
