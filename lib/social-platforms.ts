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
