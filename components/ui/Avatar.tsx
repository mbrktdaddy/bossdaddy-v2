import Image from 'next/image'

// The one member avatar. Round; a photo when there is one, otherwise the
// initial on an orange disc — white ink is right here (one 900-weight letter
// is chip-class, brand-guide §2 "Blocks"; it's body text on orange that
// fails AA). It replaces four fallbacks that disagreed: a peach
// `bg-accent/15` disc, `bg-chrome` kid rows, an orange gradient in the
// uploader, and the account menu's (which this copies).
//
// MEMBERS only. Author portraits stay SQUARE (AuthorBio, Hard Goods) — a
// byline is a masthead credit, a member is a person in a thread.
// `alt` is empty by default: an avatar sits next to the name it belongs to.

const SIZE = {
  24: { box: 'w-6 h-6',   text: 'text-[11px]' },
  32: { box: 'w-8 h-8',   text: 'text-sm' },
  44: { box: 'w-11 h-11', text: 'text-lg' },
  96: { box: 'w-24 h-24', text: 'text-4xl' },
} as const

export type AvatarSize = keyof typeof SIZE

interface AvatarProps {
  src?: string | null
  /** Display name or @username — the initial comes from it. */
  name?: string | null
  size?: AvatarSize
  alt?: string
  className?: string
}

export function initialOf(name?: string | null) {
  const ch = name?.replace(/^@/, '').trim().charAt(0)
  return ch ? ch.toUpperCase() : '?'
}

export function Avatar({ src, name, size = 32, alt = '', className = '' }: AvatarProps) {
  const s = SIZE[size]
  if (src) {
    return (
      <span className={`relative inline-block shrink-0 rounded-full overflow-hidden bg-surface-hover ${s.box} ${className}`}>
        {/* unoptimized: avatars are already-cropped storage URLs (crop-on-upload). */}
        <Image src={src} alt={alt} width={size} height={size} unoptimized className="w-full h-full object-cover" />
      </span>
    )
  }
  return (
    <span
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`inline-flex items-center justify-center shrink-0 rounded-full bg-accent text-white font-display font-black leading-none select-none ${s.box} ${s.text} ${className}`}
    >
      {initialOf(name)}
    </span>
  )
}
