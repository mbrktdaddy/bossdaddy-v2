import Link from 'next/link'
import Image from 'next/image'
import { createAnonClient } from '@/lib/supabase/anon'

interface Props {
  username: string
  className?: string
}

const FALLBACK = {
  display_name: 'Boss Daddy',
  tagline: 'First-time dad. Honest gear reviews. No corporate fluff.',
  bio: "I'm a first-time dad in the trenches — testing gear on my own kid, my own grill, and my own weekend projects. If I wouldn't buy it again, I'll tell you. If it changed the game, I'll tell you that too. Every review is earned. Every pick is independently chosen. Nothing here is sponsored.",
}

/**
 * The author card — Hard Goods (2026-10-14; brand-guide §6/§10). A 2px black
 * box, a square portrait, the name as an uppercase stamp. The author block is
 * a trust surface, not a content card, so it lives in the utility lane: a
 * box, not a borderless editorial card. He named the soft author card as one
 * of the "plain" surfaces at the design-commit review.
 */
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
      <div className="border-2 border-chrome rounded-xl bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <Link href={authorHref} className="shrink-0" aria-hidden tabIndex={-1}>
            {avatarUrl ? (
              <div className="w-[52px] h-[52px] rounded-sm overflow-hidden bg-surface-sunken relative">
                <Image src={avatarUrl} alt="" fill sizes="52px" className="object-cover" />
              </div>
            ) : (
              <div className="w-[52px] h-[52px] rounded-sm bg-chrome flex items-center justify-center text-white font-display font-black text-lg">
                {initials || 'BD'}
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-prose-faint">Written by</p>
            <Link
              href={authorHref}
              className="block mt-0.5 font-display font-black text-[13px] uppercase tracking-[0.06em] text-prose hover:text-accent-text transition-colors"
            >
              {displayName}
            </Link>
            <p className="mt-0.5 text-[13px] text-prose-muted leading-snug">{tagline}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-prose-muted leading-relaxed">{bio}</p>
        <Link
          href={authorHref}
          className="mt-3 inline-flex items-center gap-1 min-h-[44px] font-display font-extrabold text-[11px] uppercase tracking-[0.1em] text-accent-text hover:text-accent transition-colors"
        >
          More from {displayName.split(' ')[0]} <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  )
}
