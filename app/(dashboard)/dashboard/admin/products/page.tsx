import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import type { Product } from '@/lib/products'

export const dynamic = 'force-dynamic'

export default async function ProductsListPage() {
  await requireAdmin()

  const admin = createAdminClient()
  const { data: products } = await admin
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  const rows = (products ?? []) as Product[]

  return (
    <div className="p-8 max-w-4xl">

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Products</h1>
          <p className="text-prose-faint text-sm mt-1">
            Canonical product rows referenced by <code className="text-accent-text-soft">[[BUY:slug]]</code> tokens in reviews.
          </p>
        </div>
        <Link
          href="/dashboard/admin/products/new"
          className="shrink-0 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New product
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface border border-soft rounded-xl p-8 text-center">
          <p className="text-prose-muted mb-2">No products yet.</p>
          <p className="text-xs text-prose-faint">
            Create one to start embedding <code className="text-accent-text-soft">[[BUY:slug]]</code> affiliate links in reviews.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/admin/products/${p.id}`}
              className="flex items-center gap-4 p-4 bg-surface hover:bg-surface-raised border border-soft rounded-xl transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-surface-sunken border border-soft">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    className="object-contain p-1"
                    sizes="48px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-xs text-prose-faint mt-0.5">
                  <code className="text-accent-text-soft">[[BUY:{p.slug}]]</code>
                  {p.asin ? <span className="ml-3 text-prose-faint">ASIN: {p.asin}</span> : null}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2 text-xs text-prose-faint">
                {p.affiliate_url ? <span className="px-2 py-1 rounded-md bg-accent-tint text-accent-text-soft border border-accent-border/40">{p.store === 'amazon' ? 'Amazon' : p.store === 'other' ? (p.custom_store_name ?? 'Other') : p.store}</span> : null}
                {!p.affiliate_url && p.non_affiliate_url ? <span className="px-2 py-1 rounded-md bg-surface-raised text-prose-muted border border-strong">Link</span> : null}
                {!p.affiliate_url && !p.non_affiliate_url ? <span className="px-2 py-1 rounded-md bg-danger-bg text-danger-ink border border-danger-line">No URL</span> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
