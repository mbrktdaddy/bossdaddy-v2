import Link from 'next/link'
import { requireAdmin } from '@/lib/auth-cache'
import { PickForm } from '../_components/PickForm'

export const dynamic = 'force-dynamic'

export default async function NewPickPage() {
  await requireAdmin()
  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/dashboard/admin/picks" className="text-xs text-prose-faint hover:text-gray-300 transition-colors">
          ← All Lists
        </Link>
        <h1 className="text-2xl font-black mt-2">New Pick List</h1>
      </div>
      <PickForm pick={null} initialItems={[]} />
    </div>
  )
}
