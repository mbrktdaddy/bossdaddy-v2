import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-cache'
import { getVoiceProfile, emptyVoiceProfile } from '@/lib/voiceProfile'
import { VoiceProfileForm } from './_components/VoiceProfileForm'

export const dynamic = 'force-dynamic'

export default async function VoiceProfilePage() {
  const user = await requireUser()
  const supabase = await createClient()

  const profile = await getVoiceProfile(supabase, user.id)
  const initial = profile ?? { user_id: user.id, ...emptyVoiceProfile() }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard/profile"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Profile
        </Link>
      </div>

      <h1 className="text-2xl font-black mb-1">Voice Profile</h1>
      <p className="text-gray-500 text-sm mb-6">
        Facts Claude uses as ground truth whenever it drafts or refines your reviews and articles.
        Ages auto-update from dates of birth. Edit anytime — changes apply to all future content,
        and you can trigger a one-click refine on existing posts.
      </p>

      <div className="mb-8 p-4 rounded-xl bg-orange-950/30 border border-orange-900/40">
        <p className="text-xs text-orange-300 font-semibold uppercase tracking-wide mb-1.5">
          Why this matters
        </p>
        <p className="text-sm text-gray-300">
          Reviews reference your real family and work. Fabricated personal details create FTC
          truth-in-advertising risk. Keep this profile current and Claude will only draw from
          these facts — never invent a daughter&rsquo;s age or a job you don&rsquo;t hold.
        </p>
      </div>

      <VoiceProfileForm initial={initial} />
    </div>
  )
}
