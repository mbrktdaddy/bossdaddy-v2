// Compact avatar strip of the user's kids on the account/profile page.
// Each chip → /tools/family/[id] where the full per-member hub (weekends, dad math,
// savings, the Log) lives. Heavy state stays on the detail page; this section
// stays scannable.

import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { ageInYearsMonths } from '@/lib/dad-tools/calc'
import { LABELS } from '@/lib/labels'
import type { Kid } from '@/lib/dad-tools/kid-actions'
import AddKidAffordance from './AddKidAffordance'

const KID_COLUMNS = 'id, name, birthdate, member_type, photo_url, money_balance, money_monthly, money_target, money_return_rate, created_at, updated_at'

function ageBadge(birthdate: string | null): string {
  if (!birthdate) return ''
  const { years, months } = ageInYearsMonths(birthdate)
  if (years === 0) return `${months}mo`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
}

export default async function MyKidsSection() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return null

  const { data: rawKids } = await supabase.from('kid_profiles')
    .select(KID_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const kids: Kid[] = (rawKids ?? []) as Kid[]
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
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide sm:flex-wrap sm:overflow-visible">
          {kids.map((kid) => {
            const name = kid.name?.trim() || LABELS.tools.kids.noNameFallback
            const initial = (kid.name?.trim()?.[0] ?? '?').toUpperCase()
            // Children show age; partner/other show their relationship label.
            const meta = kid.member_type === 'child'
              ? ageBadge(kid.birthdate)
              : LABELS.tools.kids.memberType[kid.member_type]
            return (
              <Link
                key={kid.id}
                href={`/tools/family/${kid.id}`}
                className="group shrink-0 flex flex-col items-center gap-1.5 w-20 sm:w-24 p-2 rounded-xl hover:bg-surface-raised transition-colors"
              >
                {kid.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={kid.photo_url}
                    alt=""
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover bg-surface-sunken ring-2 ring-transparent group-hover:ring-accent transition-all"
                  />
                ) : (
                  <div
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-accent/15 text-accent flex items-center justify-center text-2xl font-black ring-2 ring-transparent group-hover:ring-accent transition-all"
                    aria-hidden="true"
                  >
                    {initial}
                  </div>
                )}
                <div className="min-w-0 text-center">
                  <p className="text-xs font-semibold text-prose truncate w-full group-hover:text-accent-text-soft transition-colors">
                    {name}
                  </p>
                  <p className="text-[10px] text-prose-faint">{meta}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
