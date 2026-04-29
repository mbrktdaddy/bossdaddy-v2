import Link from 'next/link'
import { requireAdmin } from '@/lib/auth-cache'
import { WishlistForm } from '../_components/WishlistForm'

export const dynamic = 'force-dynamic'

export default async function NewWishlistItemPage() {
  await requireAdmin()

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-8">
        <Link href="/dashboard/admin/wishlist" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Wishlist
        </Link>
        <h1 className="text-2xl font-black mt-2">New Wishlist Item</h1>
      </div>
      <WishlistForm item={null} />
    </div>
  )
}
