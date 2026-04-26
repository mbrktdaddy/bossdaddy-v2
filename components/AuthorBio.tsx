import Link from 'next/link'

interface Props {
  username: string
}

// For now there's a single author — the bio is hardcoded. When multi-author
// lands (v4.4), this component will read bio + avatar_url from the profiles
// table (added via migration at that time).
const BIOS: Record<string, { displayName: string; tagline: string; bio: string }> = {
  default: {
    displayName: 'Boss Daddy',
    tagline: 'First-time dad. Honest gear reviews. No corporate fluff.',
    bio: "I'm a first-time dad in the trenches — testing every piece of gear on my own kid, my own grill, and my own weekend projects. If I wouldn't buy it again, I'll tell you. If it changed the game, I'll tell you that too. Every review is earned, never sponsored.",
  },
}

export default function AuthorBio({ username }: Props) {
  const profile = BIOS[username] ?? BIOS.default

  return (
    <div className="mt-12 pt-8 border-t border-gray-800">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-7">
        <div className="flex items-start gap-4">
          {/* Avatar placeholder — orange circle with initials */}
          <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center text-white font-black text-lg border border-orange-700/40">
            {profile.displayName
              .split(' ')
              .map((s) => s[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-black text-base">{profile.displayName}</p>
              <Link
                href={`/author/${username}`}
                className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
              >
                @{username}
              </Link>
            </div>
            <p className="text-xs text-orange-500/80 uppercase tracking-widest font-semibold mb-3">
              {profile.tagline}
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">{profile.bio}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
