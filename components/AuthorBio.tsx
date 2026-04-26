import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

interface Props {
  username: string
}

const FALLBACK = {
  display_name: 'Boss Daddy',
  tagline: 'First-time dad. Honest gear reviews. No corporate fluff.',
  bio: "I'm a first-time dad in the trenches — testing every piece of gear on my own kid, my own grill, and my own weekend projects. If I wouldn't buy it again, I'll tell you. If it changed the game, I'll tell you that too. Every review is earned, never sponsored.",
}

export default async function AuthorBio({ username }: Props) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, tagline, bio, avatar_url')
    .eq('username', username)
    .maybeSingle()

  const displayName = profile?.display_name?.trim() || FALLBACK.display_name
  const tagline     = profile?.tagline?.trim()      || FALLBACK.tagline
  const bio         = profile?.bio?.trim()          || FALLBACK.bio
  const avatarUrl   = profile?.avatar_url ?? null

  const initials = displayName
    .split(' ')
    .map((s: string) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="mt-12 pt-8 border-t border-gray-800">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-7">
        <div className="flex items-start gap-4">
          {avatarUrl ? (
            <div className="w-14 h-14 shrink-0 rounded-full overflow-hidden border border-gray-700 bg-gray-950 relative">
              <Image src={avatarUrl} alt={displayName} fill sizes="56px" className="object-cover" />
            </div>
          ) : (
            <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center text-white font-black text-lg border border-orange-700/40">
              {initials || 'BD'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-black text-base">{displayName}</p>
              <Link
                href={`/author/${username}`}
                className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
              >
                @{username}
              </Link>
            </div>
            <p className="text-xs text-orange-500/80 uppercase tracking-widest font-semibold mb-3">
              {tagline}
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">{bio}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
