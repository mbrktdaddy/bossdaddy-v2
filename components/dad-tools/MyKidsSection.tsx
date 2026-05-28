import { createClient, getUserSafe } from '@/lib/supabase/server'
import KidCard from './KidCard'
import AddKidAffordance from './AddKidAffordance'
import type { Kid } from '@/lib/dad-tools/kid-actions'
import type { KidMoment } from '@/lib/dad-tools/moment-actions'

const KID_COLUMNS    = 'id, name, birthdate, photo_url, created_at, updated_at'
const MOMENT_COLUMNS = 'id, kid_profile_id, moment_kind, occurred_on, response, photo_url, created_at, updated_at'
const RECENT_LIMIT   = 3

export default async function MyKidsSection() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return null

  // 1) All kids for this user
  const { data: rawKids } = await supabase.from('kid_profiles')
    .select(KID_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const kids: Kid[] = (rawKids ?? []) as Kid[]

  // 2) All moments for these kids — one query, group in JS
  const kidIds = kids.map((k) => k.id)
  const momentsByKid = new Map<string, KidMoment[]>()
  const countByKid   = new Map<string, number>()

  if (kidIds.length > 0) {
    const { data: rawMoments } = await supabase.from('kid_moments')
      .select(MOMENT_COLUMNS)
      .in('kid_profile_id', kidIds)
      .order('occurred_on', { ascending: false, nullsFirst: false })
      .order('created_at',  { ascending: false })

    const moments: KidMoment[] = (rawMoments ?? []) as KidMoment[]

    for (const m of moments) {
      const arr = momentsByKid.get(m.kid_profile_id) ?? []
      arr.push(m)
      momentsByKid.set(m.kid_profile_id, arr)
      countByKid.set(m.kid_profile_id, (countByKid.get(m.kid_profile_id) ?? 0) + 1)
    }
  }

  const hasKids = kids.length > 0

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-prose-faint font-medium uppercase tracking-widest">
          Your Family
        </p>
        {hasKids && <AddKidAffordance isAuthenticated />}
      </div>

      {!hasKids ? (
        <AddKidAffordance variant="empty" isAuthenticated />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {kids.map((kid) => (
            <KidCard
              key={kid.id}
              kid={kid}
              initialMoments={(momentsByKid.get(kid.id) ?? []).slice(0, RECENT_LIMIT)}
              momentCount={countByKid.get(kid.id) ?? 0}
              isAuthenticated={true}
            />
          ))}
        </div>
      )}
    </section>
  )
}
