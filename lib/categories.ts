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
] as const

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export function getCategoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)
}

export function getCategoryLabel(slug: string) {
  return getCategoryBySlug(slug)?.label ?? slug
}
