export const CATEGORIES = [
  {
    slug: 'bbq-grilling',
    label: 'BBQ & Grilling',
    description: 'Grills, smokers, rubs, and everything that makes the backyard legendary.',
    icon: '🔥',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1400,
  },
  {
    slug: 'diy-tools',
    label: 'DIY & Tools',
    description: 'Power tools, hand tools, and gear that actually gets the job done.',
    icon: '🔧',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1500,
  },
  {
    slug: 'kids-family',
    label: 'Kids & Family',
    description: 'Toys, gear, and gadgets tested by real kids with zero mercy.',
    icon: '👨‍👧‍👦',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1200,
  },
  {
    slug: 'health-fitness',
    label: 'Health & Fitness',
    description: 'Gear that keeps the boss in fighting shape — no gym bro nonsense.',
    icon: '💪',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1300,
  },
  {
    slug: 'outdoors-adventure',
    label: 'Outdoors & Adventure',
    description: 'Family camping, hiking, and gear that gets you off the couch and into the wild.',
    icon: '🏕️',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1300,
  },
  {
    slug: 'dad-life',
    label: 'Dad Life & Culture',
    description: 'The mindset, the wins, the hard days, and the brotherhood.',
    icon: '👊',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 900,
  },
  {
    slug: 'family-lifestyle',
    label: 'Family Living',
    description: 'Building a home and a legacy that actually lasts.',
    icon: '🏡',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1100,
  },
] as const

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug)

export function getCategoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)
}

export function getCategoryLabel(slug: string) {
  return getCategoryBySlug(slug)?.label ?? slug
}
