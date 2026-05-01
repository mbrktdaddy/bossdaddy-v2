export const CATEGORIES = [
  {
    slug: 'kids-family',
    label: 'Kids & Family',
    description: 'Baby gear, toddler stuff, parenting tools, and everything tested by real kids with zero mercy.',
    icon: '👨‍👧‍👦',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1200,
  },
  {
    slug: 'tools-diy',
    label: 'Tools & DIY',
    description: 'Power tools, hand tools, home repair, yard maintenance, and projects that actually get done.',
    icon: '🔧',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1500,
  },
  {
    slug: 'grilling-cooking',
    label: 'Grilling & Cooking',
    description: 'Grills, smokers, knives, cookware, and everything that makes a meal worth eating.',
    icon: '🔥',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1400,
  },
  {
    slug: 'outdoors-adventure',
    label: 'Outdoors & Adventure',
    description: 'Camping, hiking, fishing, and gear that gets the family off the couch and into the wild.',
    icon: '🏕️',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1300,
  },
  {
    slug: 'tech-edc',
    label: 'Tech & EDC',
    description: 'Gadgets, everyday carry, and the gear that keeps a dad productive and prepared.',
    icon: '📱',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1300,
  },
  {
    slug: 'vehicles-garage',
    label: 'Vehicles & Garage',
    description: 'Cars, trucks, motorcycles, and the tools that keep them running right.',
    icon: '🚗',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1400,
  },
  {
    slug: 'health-wellness',
    label: 'Health & Wellness',
    description: 'Physical and mental wellness — supplements, fitness gear, sleep, mindfulness, and personal growth.',
    icon: '💪',
    color: 'from-gray-800/50 to-gray-900/40',
    border: 'border-gray-700/40',
    accent: 'text-orange-500',
    targetWords: 1300,
  },
  {
    slug: 'home-lifestyle',
    label: 'Home & Lifestyle',
    description: 'Furniture, organization, comfort, and the stuff that makes a house feel like home.',
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
