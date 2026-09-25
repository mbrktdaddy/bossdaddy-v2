import Link from 'next/link'
import Image from 'next/image'
import { createAnonClient } from '@/lib/supabase/anon'
import { Card } from '@/components/ui/Card'

interface Props {
  username: string
  className?: string
}

const FALLBACK = {
  display_name: 'Boss Daddy',
  tagline: 'First-time dad. Honest gear reviews. No corporate fluff.',
  bio: "I'm a first-time dad in the trenches — testing gear on my own kid, my own grill, and my own weekend projects. If I wouldn't buy it again, I'll tell you. If it changed the game, I'll tell you that too. Every review is earned. Every pick is independently chosen. Nothing here is sponsored.",
}

export default async function AuthorBio({ username, className = 'mt-12' }: Props) {
  // Cookie-free anon client — public profile fields only; keeps the host page
  // statically prerenderable (audit H3).
  const supabase = createAnonClient()
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

  const authorHref = `/author/${username}`

  return (
    <section className={className} aria-label="About the author">
      <Card className="p-5 sm:p-6">
        <p className="text-[11px] text-prose-faint uppercase tracking-widest font-semibold mb-4">Written by</p>
        <div className="flex items-start gap-4">
          <Link href={authorHref} className="shrink-0" aria-hidden tabIndex={-1}>
            {avatarUrl ? (
              <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-sunken relative">
                <Image src={avatarUrl} alt="" fill sizes="56px" className="object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-700 to-orange-950 flex items-center justify-center text-white font-black text-lg border border-accent-border/40">
                {initials || 'BD'}
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={authorHref} className="font-black text-base text-prose hover:text-accent-text-soft transition-colors">
              {displayName}
            </Link>
            <p className="mt-0.5 text-xs text-eyebrow/80 uppercase tracking-widest font-semibold">
              {tagline}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-prose-muted leading-relaxed">{bio}</p>
        <Link
          href={authorHref}
          className="mt-4 inline-flex items-center gap-1 py-2 text-xs font-semibold uppercase tracking-widest text-accent-text hover:text-accent-text-soft transition-colors"
        >
          More from {displayName.split(' ')[0]} <span aria-hidden>→</span>
        </Link>
      </Card>
    </section>
  )
}
