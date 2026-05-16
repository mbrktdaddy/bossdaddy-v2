import type { Occasion } from '@/lib/gift-occasions'

/**
 * Outlined SVG icon for a gift occasion. Replaces the legacy `occ.emoji`
 * field on public surfaces per the brand "no emoji on web" rule. Email
 * templates and the PickForm admin <option> dropdown are exempt — HTML
 * <option> can't render SVG and email clients drop SVG markup, so those
 * keep the `emoji` string. Visual weight matches CategoryIcon: stroke 1.5,
 * currentColor, sized via className.
 */
export default function OccasionIcon({
  value,
  className,
}: {
  value: Occasion
  className?: string
}) {
  const cls = className ?? 'w-8 h-8'
  const path = ICON_BY_OCCASION[value] ?? PATHS.cake
  return (
    <svg
      className={cls}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      {path}
    </svg>
  )
}

// ── Path vocabulary (Heroicons-style outlined) ─────────────────────────────
// Kept compact: ~18 distinct icons reused across the 28 occasion entries.

const PATHS = {
  mustache: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13c2 1 4 1.5 6 .5.8-.4 1.5-1 3-1s2.2.6 3 1c2 1 4 .5 6-.5M4 13c0 2 1.5 4 4 4s3-1.5 4-3m4 0c1 1.5 1.5 3 4 3s4-2 4-4"
    />
  ),
  flower: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 11c-2 0-3.5-1.5-3.5-3.5S10 4 12 4s3.5 1.5 3.5 3.5S14 11 12 11zM12 11v10M9 21h6M8 16c1 1 2.5 1 3.5 0M16 16c-1 1-2.5 1-3.5 0"
    />
  ),
  christmasTree: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 2l3 4h-1.5L16 10h-1.5L17 14H7l2.5-4H8l2.5-4H9l3-4zM10 14v4h4v-4M11 20.5h2"
    />
  ),
  heart: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
    />
  ),
  sparkles: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
    />
  ),
  egg: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3c-3.5 0-7 5-7 11s3 7 7 7 7-1 7-7-3.5-11-7-11zM8.5 12c.5-1.5 1.5-2.5 3-2.5M9 16c1 .8 2.5.8 3.5 0"
    />
  ),
  leaf: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14 4c-5 0-9 4-9 9 0 1.5.3 3 1 4 5 0 9-4 9-9 0-1.5-.3-3-1-4zM5 17c2-3 5-5 9-6"
    />
  ),
  flag: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3v18M3 4h13l-2 4 2 4H3"
    />
  ),
  moon: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
    />
  ),
  cake: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v3M9.5 5L12 3l2.5 2M5 12c0-2 1.5-3 3-3h8c1.5 0 3 1 3 3v3H5v-3zM5 15h14v6H5v-6zM3 18h18"
    />
  ),
  academicCap: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
    />
  ),
  ring: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 4l1.5 3h3L15 4M12 7v3M7 15a5 5 0 1010 0 5 5 0 00-10 0z"
    />
  ),
  bottle: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 3h4v2h-4zM9 5h6v2H9zM8 7h8v13a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM8 12h8M11 9v1M13 9v1"
    />
  ),
  baby: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12c0 1 1 2 3 2s3-1 3-2M9 9.5h.01M15 9.5h.01M5 12a7 7 0 1014 0 7 7 0 00-14 0zM12 3v2M10 18l2 3 2-3"
    />
  ),
  home: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
    />
  ),
  sun: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
    />
  ),
  flame: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
    />
  ),
  tent: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2 20h20M4 20L12 4l8 16M12 4v16M9 20l3-5 3 5"
    />
  ),
  wrench: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437"
    />
  ),
  football: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 12c0-4 2-8 8-8s8 4 8 8-2 8-8 8-8-4-8-8zM9 12h6M12 9v6M10 9.5L8 7.5M14 14.5l2 2"
    />
  ),
  dollar: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.5-4-3.5S9.79 5 12 5s4 1.5 4 3.5"
    />
  ),
}

const ICON_BY_OCCASION: Record<Occasion, React.ReactNode> = {
  // Holidays
  fathers_day:    PATHS.mustache,
  mothers_day:    PATHS.flower,
  christmas:      PATHS.christmasTree,
  valentines_day: PATHS.heart,
  new_year:       PATHS.sparkles,
  easter:         PATHS.egg,
  thanksgiving:   PATHS.leaf,
  fourth_of_july: PATHS.flag,
  halloween:      PATHS.moon,
  memorial_day:   PATHS.flag,
  // Life milestones
  birthday:       PATHS.cake,
  graduation:     PATHS.academicCap,
  wedding:        PATHS.ring,
  anniversary:    PATHS.heart,
  baby_shower:    PATHS.bottle,
  new_dad:        PATHS.baby,
  housewarming:   PATHS.home,
  retirement:     PATHS.sun,
  // Brand-themed seasons
  grilling_season: PATHS.flame,
  camping_season:  PATHS.tent,
  workshop:        PATHS.wrench,
  back_to_school:  PATHS.academicCap,
  summer_kickoff:  PATHS.sun,
  super_bowl:      PATHS.football,
  // Budget tiers — currency for the dollar bands, sparkles for splurge
  under_25:  PATHS.dollar,
  under_50:  PATHS.dollar,
  under_100: PATHS.dollar,
  splurge:   PATHS.sparkles,
}

