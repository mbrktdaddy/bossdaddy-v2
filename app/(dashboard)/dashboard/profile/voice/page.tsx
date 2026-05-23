import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAuthor } from '@/lib/auth-cache'
import { getVoiceProfile, emptyVoiceProfile } from '@/lib/voiceProfile'
import { VoiceProfileForm } from './_components/VoiceProfileForm'

export const dynamic = 'force-dynamic'

export default async function VoiceProfilePage() {
  const me = await requireAuthor()
  const supabase = await createClient()

  const profile = await getVoiceProfile(supabase, me.id)
  const initial = profile ?? { user_id: me.id, ...emptyVoiceProfile() }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard/profile"
          className="text-sm text-prose-faint hover:text-prose transition-colors"
        >
          ← Profile
        </Link>
      </div>

      <h1 className="text-2xl font-black mb-1">Voice Profile</h1>
      <p className="text-prose-faint text-sm mb-6">
        Facts Claude uses as ground truth whenever it drafts or refines your reviews and articles.
        Ages auto-update from dates of birth. Edit anytime — changes apply to all future content,
        and you can trigger a one-click refine on existing posts.
      </p>

      <div className="mb-8 p-4 rounded-xl bg-accent-tint border border-accent-border/40">
        <p className="text-xs text-accent-text font-semibold uppercase tracking-wide mb-1.5">
          Why this matters
        </p>
        <p className="text-sm text-prose-muted">
          Reviews reference your real family and work. Fabricated personal details create FTC
          truth-in-advertising risk. Keep this profile current and Claude will only draw from
          these facts — never invent a daughter&rsquo;s age or a job you don&rsquo;t hold.
        </p>
      </div>

      <VoiceProfileForm initial={initial} />
    </div>
  )
}
