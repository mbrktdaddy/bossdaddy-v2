import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'

// Permanently deletes a goal. Reached from the two-step confirm on the detail
// page — never from a bare link, so a prefetch or a mis-tap can't destroy a log.
//
// A route handler rather than a Server Action for the same reason as create and
// tap: it has to redirect afterwards (the page it was called from no longer
// exists), and next/navigation's redirect() throw gets swallowed by this
// project's Sentry instrumentation. NextResponse.redirect is a real Response.
//
// The session client does the delete, so RLS is what proves ownership — a goal
// that isn't yours matches zero rows and nothing happens. The FK cascades in
// migration 134 take the schedules, occurrences, entries, and deliveries with it.

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const goalId = String(form.get('goalId') ?? '')
  const confirmed = String(form.get('confirm') ?? '') === 'yes'

  if (!goalId) return NextResponse.redirect(new URL('/goals', request.url), 303)
  if (!confirmed) {
    // Shouldn't happen from the UI, but never destroy data on an unconfirmed POST.
    return NextResponse.redirect(new URL(`/goals/${goalId}?confirm=delete`, request.url), 303)
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.redirect(new URL('/login?next=/goals', request.url), 303)

  const { error } = await supabase.from('goals').delete().eq('id', goalId)
  if (error) {
    console.error('goals/delete failed', error.message)
    return NextResponse.redirect(new URL(`/goals/${goalId}?msg=delete_failed`, request.url), 303)
  }

  return NextResponse.redirect(new URL('/goals?deleted=1', request.url), 303)
}
