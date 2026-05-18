import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFollowupsDue } from '@/lib/reviews'

// Async Server Component — renders nothing when the list is empty so the
// dashboard stays clean. The "Schedule follow-up" action links to the review's
// workspace where the modal lives; we don't duplicate that UI here.
export async function FollowupsDueCard() {
  const admin = createAdminClient()
  const due = await getFollowupsDue(admin, 10)

  if (due.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800">
        <p className="text-sm font-semibold text-white">Follow-ups due this month</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Top-level reviews that haven&apos;t been updated in 5+ months.
        </p>
      </div>
      <ul className="divide-y divide-gray-800">
        {due.map((row) => (
          <li key={row.id} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/reviews/${row.id}`}
                className="block text-sm text-white hover:text-orange-300 truncate"
              >
                {row.title}
              </Link>
              <p className="text-xs text-gray-500 mt-0.5">
                {row.followupCount === 0
                  ? `No follow-ups · published ${row.daysSincePublished} days ago`
                  : `${row.followupCount} follow-up${row.followupCount === 1 ? '' : 's'} · last updated ${row.daysSinceLastUpdate} days ago`}
              </p>
            </div>
            <Link
              href={`/dashboard/reviews/${row.id}`}
              className="shrink-0 text-xs font-semibold text-orange-400 hover:text-orange-300 whitespace-nowrap"
            >
              Schedule follow-up →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
