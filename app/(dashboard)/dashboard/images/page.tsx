import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function ImageStudioPage() {
  const admin = createAdminClient()
  const { data: recent, count } = await admin
    .from('media_assets')
    .select('id, url, filename, alt_text, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(24)

  return (
    <div className="p-4 sm:p-8 max-w-6xl space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">Image Studio</h1>
          <p className="text-gray-500 text-sm mt-1">Generate, organize, and reuse images across your content.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/images/generate"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ✨ Generate new
          </Link>
          <Link
            href="/dashboard/media"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-xl transition-colors"
          >
            Full library
          </Link>
        </div>
      </div>

      {/* Recent images */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600 font-medium uppercase tracking-widest">Recently Added</p>
          <span className="text-xs text-gray-500">{count ?? 0} total</span>
        </div>

        {!recent?.length ? (
          <div className="border-2 border-dashed border-gray-800 rounded-2xl py-20 flex flex-col items-center gap-3 text-gray-600">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">No images yet</p>
            <Link href="/dashboard/images/generate" className="text-xs text-orange-400 hover:text-orange-300">
              Generate your first one →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {recent.map((a) => (
              <div key={a.id} className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="relative aspect-square bg-gray-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.alt_text ?? a.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-500 truncate" title={a.filename}>
                    {a.alt_text ?? a.filename}
                  </p>
                  <p className="text-xs text-gray-700 mt-0.5">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
