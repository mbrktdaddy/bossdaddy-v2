export const CATEGORIES = [
  {
    slug: 'bbq-grilling',
    label: 'BBQ & Grilling',
    description: 'Grills, smokers, rubs, and everything that makes the backyard legendary.',
    icon: '🔥',
    color: 'from-red-900/40 to-orange-900/20',
    border: 'border-red-800/40',
    accent: 'text-red-400',
  },
  {
    slug: 'diy-tools',
    label: 'DIY & Tools',
    description: 'Power tools, hand tools, and gear that actually gets the job done.',
    icon: '🔧',
    color: 'from-blue-900/40 to-cyan-900/20',
    border: 'border-blue-800/40',
    accent: 'text-blue-400',
  },
  {
    slug: 'kids-family',
    label: 'Kids & Family',
    description: 'Toys, gear, and gadgets tested by real kids with zero mercy.',
    icon: '👨‍👧‍👦',
    color: 'from-green-900/40 to-emerald-900/20',
    border: 'border-green-800/40',
    accent: 'text-green-400',
  },
  {
    slug: 'health-fitness',
    label: 'Health & Fitness',
    description: 'Gear that keeps the boss in fighting shape — no gym bro nonsense.',
    icon: '💪',
    color: 'from-purple-900/40 to-violet-900/20',
    border: 'border-purple-800/40',
    accent: 'text-purple-400',
  },
  {
    slug: 'outdoors-adventure',
    label: 'Outdoors & Adventure',
    description: 'Family camping, hiking, and gear that gets you off the couch and into the wild.',
    icon: '🏕️',
    color: 'from-[#2E4A3D]/50 to-[#1a3328]/20',
    border: 'border-[#2E4A3D]/60',
    accent: 'text-emerald-400',
  },
  {
    slug: 'dad-life',
    label: 'Dad Life & Culture',
    description: 'The mindset, the wins, the hard days, and the brotherhood.',
    icon: '👊',
    color: 'from-amber-900/40 to-yellow-900/20',
    border: 'border-amber-800/40',
    accent: 'text-amber-400',
  },
  {
    slug: 'family-lifestyle',
    label: 'Family Living',
    description: 'Building a home and a legacy that actually lasts.',
    icon: '🏡',
    color: 'from-rose-900/40 to-pink-900/20',
    border: 'border-rose-800/40',
    accent: 'text-rose-400',
  },
] as const

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export function getCategoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)
}

export function getCategoryLabel(slug: string) {
  return getCategoryBySlug(slug)?.label ?? slug
}
