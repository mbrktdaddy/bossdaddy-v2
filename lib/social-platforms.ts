export type SocialPlatform = 'x' | 'instagram' | 'threads' | 'facebook'

export interface PlatformConfig {
  id: SocialPlatform
  label: string
  charLimit: number | null
  supportsThreads: boolean
  hashtagStyle: 'inline' | 'trailing' | 'none'
}

export const PLATFORMS: PlatformConfig[] = [
  {
    id: 'x',
    label: 'X (Twitter)',
    charLimit: 280,
    supportsThreads: true,
    hashtagStyle: 'inline',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    charLimit: 2200,
    supportsThreads: false,
    hashtagStyle: 'trailing',
  },
  {
    id: 'threads',
    label: 'Threads',
    charLimit: 500,
    supportsThreads: true,
    hashtagStyle: 'none',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    charLimit: null,
    supportsThreads: false,
    hashtagStyle: 'none',
  },
]

export function getPlatform(id: string): PlatformConfig {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0]
}

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id)

// X (and t.co) counts every URL as 23 chars regardless of its real length.
export const URL_CHAR_COST = 23

// Server-side char-limit guard. The 280 ceiling is otherwise enforced only by
// the prompt + the client counter — neither is a guarantee, so the persist
// endpoints call this to reject over-limit content. Mirrors the client math
// (content length + 23 per attached link). Returns an error string, or null if OK.
export function overCharLimit(platformId: string, content: string, hasLink: boolean): string | null {
  const p = getPlatform(platformId)
  if (!p.charLimit) return null
  const len = content.length + (hasLink ? URL_CHAR_COST : 0)
  if (len <= p.charLimit) return null
  return `Post is ${len} characters${hasLink ? ' (incl. 23 for the link)' : ''} — ${p.label} allows ${p.charLimit}. Trim it before saving.`
}
