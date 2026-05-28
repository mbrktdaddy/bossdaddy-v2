// Edit a goal. Pre-fills the GoalForm with the current values; the form
// itself decides which fields to expose (progressive disclosure) based on
// the initial state.

import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getGoal } from '@/lib/dad-tools/savings-actions'
import { getKids } from '@/lib/dad-tools/kid-actions'
import { LABELS } from '@/lib/labels'
import type { GoalFormInitial } from '../../_components/GoalForm'
import GoalForm from '../../_components/GoalForm'
import GoalDangerZone from '../../_components/GoalDangerZone'

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title:  `Edit ${LABELS.tools.savings.short} — Boss Daddy`,
  robots: { index: false },
}

export default async function EditSavingsGoalPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect(`/login?next=/tools/savings/${id}/edit`)

  const data = await getGoal(id)
  if (!data) notFound()
  // Only the owner can edit. Participants get read-only via the detail page.
  if (data.goal.owner_id !== user.id) redirect(`/tools/savings/${id}`)

  const kids = await getKids()
  const initial: GoalFormInitial = {
    id:                 data.goal.id,
    name:               data.goal.name,
    description:        data.goal.description,
    kid_profile_id:     data.goal.kid_profile_id,
    cadence:            data.goal.cadence,
    amount_per_cadence: data.goal.amount_per_cadence,
    target_amount:      data.goal.target_amount,
    target_date:        data.goal.target_date,
    destination_mode:   data.goal.destination_mode,
    destination_type:   data.goal.destination_type,
    destination_url:    data.goal.destination_url,
    destination_label:  data.goal.destination_label,
    reminder_enabled:   data.goal.reminder_enabled,
    reminder_cadence:   data.goal.reminder_cadence,
    reminder_hour_utc:  data.goal.reminder_hour_utc,
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <header className="space-y-2">
        <Link
          href={`/tools/savings/${id}`}
          className="text-sm text-prose-faint hover:text-prose-muted transition-colors"
        >
          ← Back to {data.goal.name}
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">
          Edit goal
        </h1>
      </header>

      <GoalForm mode="edit" initial={initial} kids={kids} />

      <GoalDangerZone
        goalId={data.goal.id}
        status={data.goal.status}
        goalName={data.goal.name}
      />
    </div>
  )
}
